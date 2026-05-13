/**
 * Canonical sample run — pre-baked 5-agent assessment used for SSR on
 * /lifecycle and /upload. Replaced by live data the moment the user
 * clicks "Run lifecycle" or drops a file.
 *
 * Numbers are drawn from real end-to-end agent runs we executed against
 * the seeded SQLite database (POA 1: registry; POA 2: risk; POA 3:
 * service; POA 4: Karim; POA 5: Salma). Where the agent emission was
 * lengthy we condensed; where it was qualitative we kept the LLM's
 * topic-style sentence.
 *
 * `sample_run: true` is shipped on every stage so reviewers reading the
 * raw JSON cannot mistake this for a fresh assessment.
 */

export interface SampleStageKpi {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "warning" | "alarm" | "gold";
  caption?: string;
}

export interface SampleStageIndicator {
  code: string;                 // "P1-1", "P2-3", ...
  name: string;
  score: string;                // aggregate
  scoring_method?: "M1" | "M2";
  tadat_reference: string;
  dimensions?: Array<{ id: string; score: string }>;
}

export interface SampleStage {
  id: "registry" | "risk" | "service" | "filing" | "payments";
  poa: 1 | 2 | 3 | 4 | 5;
  poa_name: string;
  step_label: string;           // "Register", "Identify Risk", etc.
  persona: string;              // "Layla", "Hamad", "Maya", "Karim", "Salma"
  persona_role: string;
  /** gradient classes for the persona avatar fill */
  gradient: string;
  aggregate_score: string;
  business_outcome: string;     // one-sentence FTA-grade summary
  kpis: SampleStageKpi[];       // 3 micro-tiles per stage
  indicators: SampleStageIndicator[];
  /** Caption above the arrow flowing INTO the next stage. */
  handoff_to_next: string | null;
  detail_href: string;
  sample_run: true;
}

export interface SampleRun {
  generated_at: string;
  period_start: string;
  period_end: string;
  sources: string[];
  stages: SampleStage[];
  /** Aggregated revenue impact rolled up across stages. */
  aggregate_revenue_impact_aed: number;
  sample_run: true;
}

export const SAMPLE_RUN: SampleRun = {
  generated_at: "2025-12-31T23:59:00Z",
  period_start: "2025-01-01",
  period_end: "2025-12-31",
  sources: [
    "FTA Open Data 2024–2025",
    "EmaraTax service-channel telemetry (synth)",
    "Seeded SQLite (POA 1/4/5 row-level)",
  ],
  aggregate_revenue_impact_aed: 92_500_000,

  stages: [
    // ── POA 1 ─────────────────────────────────────────────────────────
    {
      id: "registry",
      poa: 1,
      poa_name: "Integrity of the Registered Taxpayer Base",
      step_label: "Register",
      persona: "Layla",
      persona_role: "Registry Integrity Auditor",
      gradient: "from-indigo-500 to-violet-500",
      aggregate_score: "B",
      business_outcome:
        "Registry covers 1,024 active taxpayers across all core taxes; 24 soft-duplicate pairs + 62 missing-contact records create roughly AED 12M of latent refund-fraud exposure.",
      kpis: [
        { label: "Records", value: "1,024", tone: "neutral" },
        { label: "Duplicates", value: "24", tone: "warning" },
        { label: "Missing contact", value: "62", tone: "warning" },
      ],
      indicators: [
        {
          code: "P1-1",
          name: "Accurate and reliable taxpayer information",
          score: "B",
          scoring_method: "M1",
          tadat_reference: "Field Guide 2025, Ch III, pg 27, 32–34",
          dimensions: [
            { id: "P1-1-1", score: "B" },
            { id: "P1-1-2", score: "B" },
          ],
        },
        {
          code: "P1-2",
          name: "Knowledge of the potential taxpayer base",
          score: "B",
          scoring_method: "M1",
          tadat_reference: "Field Guide 2025, Ch III, pg 31, 34",
        },
      ],
      handoff_to_next: "clean, segmented taxpayer base",
      detail_href: "/agents/registry",
      sample_run: true,
    },

    // ── POA 2 ─────────────────────────────────────────────────────────
    {
      id: "risk",
      poa: 2,
      poa_name: "Effective Risk Management",
      step_label: "Identify Risk",
      persona: "Hamad",
      persona_role: "Compliance Risk Officer",
      gradient: "from-rose-500 to-amber-500",
      aggregate_score: "C",
      business_outcome:
        "AED 92.5M outstanding from 300 non-filers concentrated in CT large-segment; P2-3-1 caps the POA at C because predictive modelling is not yet routine in case selection.",
      kpis: [
        { label: "Risks flagged", value: "8", tone: "warning" },
        { label: "AED at risk", value: "92.5M", tone: "alarm" },
        { label: "Owners unassigned", value: "2", tone: "warning" },
      ],
      indicators: [
        {
          code: "P2-3",
          name: "Identification, assessment, ranking & quantification of compliance risks",
          score: "C",
          scoring_method: "M1",
          tadat_reference: "Field Guide 2025, Ch IV, pg 41–44, 48–49",
          dimensions: [
            { id: "P2-3-1", score: "C" },
            { id: "P2-3-2", score: "A" },
          ],
        },
        {
          code: "P2-4",
          name: "Mitigation via Compliance Improvement Plan",
          score: "B",
          scoring_method: "M1",
          tadat_reference: "Field Guide 2025, Ch IV, pg 44, 49 + Box 2 pg 37",
        },
        {
          code: "P2-5",
          name: "Monitoring & evaluation of mitigation activities",
          score: "A",
          scoring_method: "M1",
          tadat_reference: "Field Guide 2025, Ch IV, pg 45, 49–50",
        },
        {
          code: "P2-6",
          name: "Management of operational risks",
          score: "A",
          scoring_method: "M1",
          tadat_reference: "Field Guide 2025, Ch IV, pg 45–46, 50–51",
          dimensions: [
            { id: "P2-6-1", score: "A" },
            { id: "P2-6-2", score: "A" },
          ],
        },
        {
          code: "P2-7",
          name: "Management of human capital risks",
          score: "B",
          scoring_method: "M1",
          tadat_reference: "Field Guide 2025, Ch IV, pg 47, 51–52",
          dimensions: [
            { id: "P2-7-1", score: "A" },
            { id: "P2-7-2", score: "B" },
          ],
        },
      ],
      handoff_to_next: "risk-prioritized targets to nudge or audit",
      detail_href: "/agents/risk",
      sample_run: true,
    },

    // ── POA 3 ─────────────────────────────────────────────────────────
    {
      id: "service",
      poa: 3,
      poa_name: "Supporting and Facilitating Compliance",
      step_label: "Make it Easy",
      persona: "Maya",
      persona_role: "Service & Facilitation Lead",
      gradient: "from-fuchsia-500 to-pink-500",
      aggregate_score: "C",
      business_outcome:
        "Median telephone wait 7.4 min puts P3-9 at C+ via M2; cooperative-compliance arrangements are not yet in place, holding P3-12 at C and the POA aggregate at C.",
      kpis: [
        { label: "Wait", value: "7.4 min", tone: "warning", caption: "P50 telephone" },
        { label: "Inquiries", value: "459K", tone: "neutral", caption: "FY24" },
        { label: "Backlog items", value: "5", tone: "gold" },
      ],
      indicators: [
        {
          code: "P3-8",
          name: "Scope, currency & accessibility of information",
          score: "B",
          scoring_method: "M1",
          tadat_reference: "Field Guide 2025, Ch V, pg 56–58, 62–63",
          dimensions: [
            { id: "P3-8-1", score: "B" },
            { id: "P3-8-2", score: "A" },
            { id: "P3-8-3", score: "B" },
          ],
        },
        {
          code: "P3-9",
          name: "Responding to information requests",
          score: "C+",
          scoring_method: "M2",
          tadat_reference: "Field Guide 2025, Ch V, pg 58–59, 63–64",
          dimensions: [
            { id: "P3-9-1", score: "C" },
            { id: "P3-9-2", score: "B" },
          ],
        },
        {
          code: "P3-10",
          name: "Initiatives to reduce taxpayer compliance costs",
          score: "C",
          scoring_method: "M1",
          tadat_reference: "Field Guide 2025, Ch V, pg 59, 64–65",
        },
        {
          code: "P3-11",
          name: "Obtaining taxpayer feedback",
          score: "B",
          scoring_method: "M1",
          tadat_reference: "Field Guide 2025, Ch V, pg 60, 65–66",
          dimensions: [
            { id: "P3-11-1", score: "A" },
            { id: "P3-11-2", score: "B" },
          ],
        },
        {
          code: "P3-12",
          name: "Initiatives to encourage accurate reporting",
          score: "C",
          scoring_method: "M1",
          tadat_reference: "Field Guide 2025, Ch V, pg 61, 66",
        },
      ],
      handoff_to_next: "easier filing → more on-time submissions",
      detail_href: "/agents/service",
      sample_run: true,
    },

    // ── POA 4 ─────────────────────────────────────────────────────────
    {
      id: "filing",
      poa: 4,
      poa_name: "Timely Filing of Tax Declarations",
      step_label: "File on Time",
      persona: "Karim",
      persona_role: "Filing Compliance Officer",
      gradient: "from-blue-500 to-cyan-500",
      aggregate_score: "B+",
      business_outcome:
        "VAT 87.2% / CT 75.4% / Excise 93.0% — Corporate Tax sits 14.6pp from TADAT-A. The top 10 non-filers carry AED 50M+ recoverable; the largest single case is AED 18.9M.",
      kpis: [
        { label: "VAT on-time", value: "87.2%", tone: "warning" },
        { label: "Non-filers", value: "300", tone: "alarm" },
        { label: "Recoverable", value: "AED 92.5M", tone: "gold" },
      ],
      indicators: [
        {
          code: "P4-13",
          name: "On-time filing rate (VAT, CT, Excise)",
          score: "B+",
          scoring_method: "M2",
          tadat_reference: "Field Guide 2025, Ch VI, pg 73",
        },
        {
          code: "P4-14",
          name: "Management of non-filers",
          score: "B",
          scoring_method: "M1",
          tadat_reference: "Field Guide 2025, Ch VI, pg 75",
        },
        {
          code: "P4-15",
          name: "Use of electronic filing facilities",
          score: "A",
          scoring_method: "M1",
          tadat_reference: "Field Guide 2025, Ch VI, pg 76",
        },
      ],
      handoff_to_next: "filed declarations → payable amounts",
      detail_href: "/agents/filing",
      sample_run: true,
    },

    // ── POA 5 ─────────────────────────────────────────────────────────
    {
      id: "payments",
      poa: 5,
      poa_name: "Timely Payment of Taxes",
      step_label: "Pay on Time",
      persona: "Salma",
      persona_role: "Arrears Risk Strategist",
      gradient: "from-emerald-500 to-teal-500",
      aggregate_score: "B",
      business_outcome:
        "VAT on-time payment 88.0% by value (B); arrears stock 18% of collections (B). AED 195M outstanding — 60% collectible — and the 3-year arrears trend is declining.",
      kpis: [
        { label: "On-time pay", value: "88.0%", tone: "warning", caption: "by value" },
        { label: "Arrears", value: "AED 195M", tone: "alarm" },
        { label: "E-payment", value: "78.0%", tone: "positive" },
      ],
      indicators: [
        {
          code: "P5-16",
          name: "Use of electronic payment methods",
          score: "B",
          scoring_method: "M1",
          tadat_reference: "Field Guide 2025, Ch VII, pg 84",
        },
        {
          code: "P5-18",
          name: "Timeliness of payments",
          score: "B",
          scoring_method: "M1",
          tadat_reference: "Field Guide 2025, Ch VII, pg 85",
          dimensions: [
            { id: "P5-18-1", score: "B" },
            { id: "P5-18-2", score: "B" },
          ],
        },
        {
          code: "P5-19",
          name: "Stock and flow of tax arrears (3-year average)",
          score: "B",
          scoring_method: "M2",
          tadat_reference: "Field Guide 2025, Ch VII, pg 86–87",
          dimensions: [
            { id: "P5-19-1", score: "B" },
            { id: "P5-19-2", score: "B" },
            { id: "P5-19-3", score: "B" },
          ],
        },
      ],
      handoff_to_next: null,
      detail_href: "/agents/payments",
      sample_run: true,
    },
  ],

  sample_run: true,
};

/** Convenience: aggregate KPIs for the bottom-of-lifecycle panel. */
export const SAMPLE_AGGREGATE = {
  total_recoverable_aed: 92_500_000,
  on_time_filing_pct: 87.2,
  on_time_payment_pct: 88.0,
  arrears_stock_aed: 195_000_000,
  risks_flagged: 8,
  backlog_items: 5,
} as const;
