/**
 * TADAT agent runner using the OpenAI Agents SDK (@openai/agents).
 *
 * Each TADAT workflow is implemented as an `Agent` with:
 *   • A system prompt (instructions) — encodes the TADAT rubric
 *   • An `outputType` schema enforced by the SDK (structured JSON)
 *   • Backing Azure OpenAI client via setDefaultOpenAIClient
 *
 * The SDK gives us traces for free (visible in OPENAI_AGENTS_DISABLE_TRACING=0
 * mode) and clean error handling. Once we're happy, we can swap to the
 * Autogen team JSONs unchanged — the prompts are already aligned.
 */
import {
  Agent,
  run,
  setDefaultOpenAIClient,
  setOpenAIAPI,
  setTracingDisabled,
} from "@openai/agents";
import { OpenAI } from "openai";
import { z } from "zod";

import {
  AZURE_OPENAI_API_KEY,
  AZURE_OPENAI_API_VERSION,
  AZURE_OPENAI_BASE_URL,
  AZURE_OPENAI_DEPLOYMENT_NAME,
} from "@/lib/config";
import {
  aggregateRegistry,
  aggregateFiling,
  aggregatePayments,
  aggregateRiskMgmt,
  aggregateFacilitation,
} from "@/lib/tadat/aggregations";
import {
  SYSTEM_PROMPT_REGISTRY,
  SYSTEM_PROMPT_FILING,
  SYSTEM_PROMPT_PAYMENTS,
  SYSTEM_PROMPT_RISK,
  SYSTEM_PROMPT_SERVICE,
} from "@/lib/agents/system-prompts";

// ─── Configure SDK once for Azure OpenAI ──────────────────────────────────
let _configured = false;
function configureSDK() {
  if (_configured) return;

  const client = new OpenAI({
    apiKey: AZURE_OPENAI_API_KEY,
    baseURL: AZURE_OPENAI_BASE_URL,
    defaultQuery: { "api-version": AZURE_OPENAI_API_VERSION },
    defaultHeaders: { "api-key": AZURE_OPENAI_API_KEY },
  });
  setDefaultOpenAIClient(client);

  // Azure doesn't support the Responses API → must use chat completions
  setOpenAIAPI("chat_completions");

  // Disable tracing (we'd otherwise need an OpenAI org key). We can
  // re-enable selectively once a tracing destination is wired up.
  setTracingDisabled(true);

  _configured = true;
}

// ─── Output schemas (one per workflow) ────────────────────────────────────
// Loose schemas — we want the SDK to enforce JSON-validity but tolerate
// minor field variation while we iterate on prompts.

const Indicator = z.object({
  id: z.string(),
  name: z.string(),
  score: z.string(),
  finding: z.string(),
  detail: z.string(),
  evidence: z.array(z.string()).nullable(),
  value: z.number().nullable(),
  value_label: z.string().nullable(),
  value_all: z.number().nullable(),
  value_large: z.number().nullable(),
});

// Registry indicators carry the evidence-based extras (dim_kind + ref) on top
// of the shared flat Indicator shape.
const RegistryIndicator = Indicator.extend({
  dim_kind: z.enum(["qualitative", "quantitative", "mixed"]).nullable().optional(),
  tadat_reference: z.string().nullable().optional(),
  // Registry indicators don't use the all/large split — make them optional so
  // omitting them isn't flagged as a schema warning.
  value_all: z.number().nullish(),
  value_large: z.number().nullish(),
  // Per-evidence appraisal — Layla's verdict on each item the FTA provided.
  evidence_review: z
    .array(
      z.object({
        item: z.string(),
        relevance: z
          .enum(["relevant", "partial", "not_relevant", "insufficient"])
          .nullable()
          .optional(),
        comment: z.string(),
      }),
    )
    .nullish(),
});

const RegistryOutput = z.object({
  poa: z.literal(1),
  poa_name: z.string(),
  indicators: z.array(RegistryIndicator),
  aggregate_method: z.string(),
  p1_1_aggregate: z.string().nullable().optional(),
  aggregate_score: z.string(),
  recommendations: z.array(z.string()),
  // Loosened — the evidence flow reports group coverage, not record counts.
  data_coverage: z.record(z.string(), z.unknown()).nullable(),
});

const FilingOutput = z.object({
  poa: z.literal(4),
  poa_name: z.string(),
  indicators: z.array(Indicator),
  not_applicable: z.array(z.object({ id: z.string(), reason: z.string() })).nullable(),
  aggregate_method: z.string(),
  p4_13_aggregate: z.string(),
  aggregate_score: z.string(),
  non_filer_worklist: z
    .object({
      total_cases: z.number(),
      by_tax_type: z.record(z.string(), z.number()),
      highest_value_aed: z.number(),
    })
    .nullable(),
  recommendations: z.array(z.string()),
});

const PaymentsOutput = z.object({
  poa: z.literal(5),
  poa_name: z.string(),
  indicators: z.array(Indicator),
  not_applicable: z.array(z.object({ id: z.string(), reason: z.string() })).nullable(),
  p5_18_aggregate: z.string(),
  p5_19_aggregate: z.string(),
  aggregate_score: z.string(),
  high_risk_debtors: z
    .array(
      z.object({
        trn: z.string(),
        outstanding_aed: z.number(),
        age_bucket: z.string(),
        collectible: z.boolean(),
      })
    )
    .nullable(),
  recommendations: z.array(z.string()),
});

// =========================================================================
// POA 2 (Risk Management) + POA 3 (Facilitating Compliance) schemas
// =========================================================================
//
// These are dimension-level schemas — every TADAT dimension gets its own
// score, evidence, and field-guide reference. Distinct from the earlier
// flat `Indicator` schema (kept above for Layla / Karim / Salma so we don't
// modify their tested contracts).
//
// Locked design choices (do not relax without revisiting eval):
//   • Dimension scores are plain ABCD; only indicator aggregates can be "+".
//   • If `dim_kind === "qualitative"`, `value` MUST be null. Enforced in the
//     prompt; eval will reject hallucinated numbers on qualitative dims.
//   • POA aggregate is our convenience metric — `is_tadat_defined: false`
//     is hard-coded so reviewers reading raw JSON can't mistake it for a
//     TADAT-defined output.

const DimKind = z.enum(["quantitative", "qualitative", "mixed"]);
const PlainScore = z.enum(["A", "B", "C", "D"]);
const ModScore = z.enum(["A", "B+", "B", "C+", "C", "D+", "D"]);
const ScoringMethod = z.enum(["M1", "M2"]);

const DimensionScore = z.object({
  dim_id: z.string(),                              // "P2-3-1"
  dim_name: z.string(),
  dim_kind: DimKind,
  score: PlainScore,                               // dims always plain ABCD
  finding: z.string(),                             // one-sentence topic statement
  detail: z.string(),                              // 2–4 sentences with numbers cited
  evidence: z.array(z.string()).default([]),       // never null — defaults to []
  value: z.number().nullable(),                    // null when dim_kind === "qualitative"
  value_label: z.string().nullable(),
  tadat_reference: z.string(),                     // "Field Guide 2025, Ch IV, pg 48–49"
});

const IndicatorScoreV2 = z.object({
  indicator_id: z.string(),                        // "P2-3"
  indicator_name: z.string(),
  scoring_method: ScoringMethod,
  dimensions: z.array(DimensionScore),
  aggregate_score: ModScore,                       // M1=plain, M2 may yield "+"
  aggregate_rationale: z.string(),                 // "M1: lowest of dims" / "M2: 2-dim conv"
  tadat_reference: z.string(),                     // chapter-level
});

const RiskLevel = z.enum(["Low", "Medium", "High"]);
const Confidence = z.enum(["Low", "Medium", "High"]);
const Segment = z.enum([
  "Individuals",
  "Micro-Small",
  "Medium",
  "Large",
  "HNWI",
  "Non-profit",
  "Government",
  "Cross-cutting",
]);
const TaxType = z.enum(["VAT", "CIT", "Excise", "PIT", "Cross-cutting"]);
const MitigationStatus = z.enum([
  "Not started",
  "In progress",
  "Implemented",
  "Monitor",
]);
const RiskSource = z.enum([
  "data-derived",        // computed from POA 1/4/5 outputs
  "tadat-illustrative",  // from field guide background (toggle-gated in UI)
  "fta-internal",        // future-proof for when FTA connects their register
]);

const RiskItem = z.object({
  risk_id: z.string(),
  name: z.string(),
  segment: Segment,
  tax_type: TaxType,
  likelihood: RiskLevel,
  impact: RiskLevel,
  estimated_aed_at_risk: z.number().nullable(),
  confidence: Confidence,                          // accompanies AED estimate
  source: RiskSource,
  mitigation_status: MitigationStatus,
  owner: z.string().nullable(),                    // null = unassigned
  tadat_dimensions: z.array(z.string()),           // a single risk often informs multiple dims
});

const BacklogItem = z.object({
  name: z.string(),
  taxpayer_segment: z.string(),
  expected_impact: z.string(),
  effort_estimate: z.enum(["S", "M", "L"]),
  tadat_dimensions: z.array(z.string()),
});

const DataCoverage = z.object({
  period_start: z.string(),                        // ISO date — not free text
  period_end: z.string(),
  sources: z.array(z.string()),
});

const RiskOutput = z.object({
  poa: z.literal(2),
  poa_name: z.literal("Effective Risk Management"),
  indicators: z.array(IndicatorScoreV2),           // exactly 5: P2-3 .. P2-7
  poa_aggregate_score: ModScore,
  poa_aggregate_method: z.literal("lowest-of-indicators"),
  is_tadat_defined: z.literal(false),              // loud disclaimer in JSON itself
  business_outcome: z.string(),                    // 1–2 sentence plain English
  recommendations: z.array(z.string()),
  risk_register_top: z.array(RiskItem),            // top 5 by likelihood × impact
  data_coverage: DataCoverage,
});

const ServiceOutput = z.object({
  poa: z.literal(3),
  poa_name: z.literal("Supporting and Facilitating Compliance"),
  indicators: z.array(IndicatorScoreV2),           // exactly 5: P3-8 .. P3-12
  poa_aggregate_score: ModScore,
  poa_aggregate_method: z.literal("lowest-of-indicators"),
  is_tadat_defined: z.literal(false),
  business_outcome: z.string(),
  recommendations: z.array(z.string()),
  make_it_easier_backlog: z.array(BacklogItem),    // ranked
  data_coverage: DataCoverage,
});

// Inferred TS types — exported for the lifecycle UI / aggregator helpers.
export type DimKindT = z.infer<typeof DimKind>;
export type DimensionScoreT = z.infer<typeof DimensionScore>;
export type IndicatorScoreV2T = z.infer<typeof IndicatorScoreV2>;
export type RiskItemT = z.infer<typeof RiskItem>;
export type BacklogItemT = z.infer<typeof BacklogItem>;
export type RiskOutputT = z.infer<typeof RiskOutput>;
export type ServiceOutputT = z.infer<typeof ServiceOutput>;

// ─── Build the 3 agents ───────────────────────────────────────────────────
function buildAgents() {
  configureSDK();

  return {
    registry: new Agent({
      name: "Registry Health Auditor",
      instructions: SYSTEM_PROMPT_REGISTRY,
      model: AZURE_OPENAI_DEPLOYMENT_NAME,
      modelSettings: { temperature: 0.1 },
      // We rely on prompt + chat completions JSON mode for output rather than
      // outputType schema, since the schema would balloon the system prompt.
      // The runner parses raw text → JSON below.
    }),
    filing: new Agent({
      name: "Non-Filer Triage Agent",
      instructions: SYSTEM_PROMPT_FILING,
      model: AZURE_OPENAI_DEPLOYMENT_NAME,
      modelSettings: { temperature: 0.1 },
    }),
    payments: new Agent({
      name: "Arrears Risk Stratification Agent",
      instructions: SYSTEM_PROMPT_PAYMENTS,
      model: AZURE_OPENAI_DEPLOYMENT_NAME,
      modelSettings: { temperature: 0.1 },
    }),
    risk: new Agent({
      name: "Compliance & Risk Officer",
      instructions: SYSTEM_PROMPT_RISK,
      model: AZURE_OPENAI_DEPLOYMENT_NAME,
      modelSettings: { temperature: 0.1 },
    }),
    service: new Agent({
      name: "Service & Facilitation Lead",
      instructions: SYSTEM_PROMPT_SERVICE,
      model: AZURE_OPENAI_DEPLOYMENT_NAME,
      modelSettings: { temperature: 0.1 },
    }),
  };
}

let _agents: ReturnType<typeof buildAgents> | null = null;
function agents() {
  if (!_agents) _agents = buildAgents();
  return _agents;
}

// ─── Workflow registry ────────────────────────────────────────────────────
export type WorkflowId = "registry" | "filing" | "payments" | "risk" | "service";

const WORKFLOWS: Record<
  WorkflowId,
  {
    poa: number;
    name: string;
    aggregator: () => Promise<unknown>;
    instruction: string;
    schema: z.ZodTypeAny;
  }
> = {
  registry: {
    poa: 1,
    name: "Registry Health Audit",
    aggregator: aggregateRegistry,
    instruction:
      "Score TADAT POA 1 (Integrity of the Registered Taxpayer Base) for the UAE FTA based on the registry statistics below. Apply the rubric in your system message and return one valid JSON object only.",
    schema: RegistryOutput,
  },
  filing: {
    poa: 4,
    name: "Non-Filer Triage",
    aggregator: aggregateFiling,
    instruction:
      "Score TADAT POA 4 (Timely Filing of Tax Declarations) for the UAE FTA based on the filing statistics below. Apply the rubric in your system message and return one valid JSON object only.",
    schema: FilingOutput,
  },
  payments: {
    poa: 5,
    name: "Arrears Risk Stratification",
    aggregator: aggregatePayments,
    instruction:
      "Score TADAT POA 5 (Timely Payment of Taxes) for the UAE FTA based on the payment + arrears statistics below. Apply the rubric in your system message and return one valid JSON object only.",
    schema: PaymentsOutput,
  },
  risk: {
    poa: 2,
    name: "Effective Risk Management",
    aggregator: aggregateRiskMgmt,
    instruction:
      "Score TADAT POA 2 (Effective Risk Management) for the UAE FTA. Apply the dimension-level rubric in your system message. Honour the dim_kind constraint — qualitative dims must have value: null. Preserve risk source labels (data-derived / tadat-illustrative / fta-internal) exactly as supplied. Return one valid JSON object only.",
    schema: RiskOutput,
  },
  service: {
    poa: 3,
    name: "Supporting and Facilitating Compliance",
    aggregator: aggregateFacilitation,
    instruction:
      "Score TADAT POA 3 (Supporting and Facilitating Compliance) for the UAE FTA. Apply the dimension-level rubric in your system message. P3-9 uses M2 — apply the 2-dim conversion table and record the conversion in aggregate_rationale. Honour dim_kind: qualitative dims must have value: null; quantitative dims must cite the input number. Return one valid JSON object only.",
    schema: ServiceOutput,
  },
};

// ─── Public runner ────────────────────────────────────────────────────────
export interface AgentRunResult {
  workflow: WorkflowId;
  poa: number;
  workflow_name: string;
  ok: boolean;
  duration_ms: number;
  inputs: unknown;
  raw_response: string;
  parsed: Record<string, unknown> | null;
  parse_error: string | null;
}

/** Optional extras forwarded by the upload pipeline so the LLM sees the
 *  reviewer's actual file alongside the Supabase aggregates. */
export interface RunAgentOptions {
  /** Parsed payload from /api/upload/parse — sheet headers + sample rows
   *  + headline figures from whatever was dropped. Null if no upload. */
  uploadedFile?: unknown;
  /** TADAT evidence intake bundle (answers + attachments per dimension),
   *  collected on the agent page. When present, the registry agent scores
   *  FROM this evidence rather than inferring from the database. */
  evidenceBundle?: unknown;
  /** Layla's chat interview transcript ([{role, content}]). Scored as
   *  evidence alongside the bundle. */
  chatTranscript?: unknown;
}

export async function runAgent(
  workflow: WorkflowId,
  options: RunAgentOptions = {},
): Promise<AgentRunResult> {
  const spec = WORKFLOWS[workflow];
  if (!spec) throw new Error(`Unknown workflow: ${workflow}`);

  const t0 = Date.now();

  const hasTranscript =
    Array.isArray(options.chatTranscript) && options.chatTranscript.length > 0;
  const evidenceMode =
    workflow === "registry" &&
    (options.evidenceBundle != null || hasTranscript);

  // 1. Pre-aggregate (Supabase). In evidence mode the slice only corroborates
  // P1-1-2, so a DB outage must NOT block an evidence-based assessment — we
  // proceed with a clearly-marked unavailable slice instead.
  let baseInputs: unknown;
  if (evidenceMode) {
    try {
      baseInputs = await spec.aggregator();
    } catch (e) {
      baseInputs = {
        unavailable: true,
        reason: `registry_data_slice unavailable (DB not reachable): ${(e as Error).message}`,
      };
    }
  } else {
    baseInputs = await spec.aggregator();
  }

  // 1b. Compose inputs. Three paths:
  //   • registry + evidence bundle → evidence-based (bundle primary, DB slice corroborates)
  //   • uploaded file               → file context alongside the aggregates
  //   • otherwise                    → the aggregates alone
  let inputs: unknown;
  if (evidenceMode) {
    inputs = {
      evidence_bundle: options.evidenceBundle ?? null,
      interview_transcript: hasTranscript ? options.chatTranscript : null,
      registry_data_slice: baseInputs,
    };
  } else if (options.uploadedFile != null) {
    inputs = {
      supabase_aggregates: baseInputs,
      uploaded_file: options.uploadedFile,
    };
  } else {
    inputs = baseInputs;
  }

  // 2. Build user message.
  const evidenceHint = evidenceMode
    ? `\n\nThis is an EVIDENCE-BASED assessment. Score each dimension ONLY from the evidence the FTA provided — that means BOTH evidence_bundle (checklist answers + attachments) AND interview_transcript (Layla's chat interview). Treat an answer given in the chat exactly like a checklist answer. Any dimension with no evidence in EITHER source is 'D' (insufficient evidence). Use registry_data_slice solely to corroborate P1-1-2. Cite the specific answer/file you relied on.`
    : "";
  const fileHint =
    options.uploadedFile != null && !evidenceMode
      ? `\n\nNOTE: The reviewer just dropped a file (see uploaded_file in the input). When the file's headlines + sections clearly differ from the Supabase aggregates, prefer the uploaded figures for the business_outcome narrative and call out the source. The TADAT band scoring remains rubric-driven on whichever signal is most defensible.`
      : "";
  const userMessage = `${spec.instruction}${evidenceHint}${fileHint}\n\nINPUT JSON:\n${JSON.stringify(
    inputs,
    null,
    2,
  )}\n\nReturn ONLY a valid JSON object — no markdown, no prose.`;

  // 3. Run the SDK agent
  const ag = agents()[workflow];
  let raw = "";
  let parsed: Record<string, unknown> | null = null;
  let parseError: string | null = null;
  try {
    const result = await run(ag, userMessage);
    raw = String(result.finalOutput ?? "").trim();

    // Strip ```json fences if model added them despite instructions
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    // Find first { and last } for safety
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    const sliced = first >= 0 && last > first ? cleaned.slice(first, last + 1) : cleaned;

    const obj = JSON.parse(sliced);

    // Soft-validate with the schema; we don't fail hard — just record errors
    const safe = spec.schema.safeParse(obj);
    if (!safe.success) {
      // Still return the parsed object — schema mismatches are signal not failure
      parseError = `schema warnings: ${safe.error.issues.length} issues`;
    }
    parsed = obj;
  } catch (e) {
    parseError = (e as Error).message;
  }

  return {
    workflow,
    poa: spec.poa,
    workflow_name: spec.name,
    ok: parsed !== null,
    duration_ms: Date.now() - t0,
    inputs,
    raw_response: raw,
    parsed,
    parse_error: parseError,
  };
}
