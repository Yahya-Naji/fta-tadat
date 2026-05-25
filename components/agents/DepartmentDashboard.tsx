"use client";

/**
 * DepartmentDashboard — each non-Karim agent's full department view.
 *
 *   ┌────────────────────────────────────────────────────────────────────┐
 *   │ Top bar — Home · QTax wordmark · ThemeToggle                       │
 *   ├────────────────────────────────────────────────────────────────────┤
 *   │ Department banner — persona · "Department of {X}" · score · Run    │
 *   │ KPI strip (3 KPIs)                                                 │
 *   ├──────────────────────────────────────────────┬─────────────────────┤
 *   │ MAIN COLUMN                                   │ DepartmentChat       │
 *   │  • Signature chart (per persona)              │  • streamed LLM      │
 *   │  • Indicators table (clickable → IndicatorPanel)                    │
 *   │  • Flagged records                            │                     │
 *   │  • Recommendations                            │                     │
 *   └──────────────────────────────────────────────┴─────────────────────┘
 *
 * Fetches /api/agents/{id}/preview on mount for pre-aggregate inputs.
 * Click Run → POST /api/agents/{id}/run → live data replaces fixture.
 * Chat consumes parsed + inputs as context (full LLM mode).
 */
import * as React from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Play,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  Upload,
  FileSpreadsheet,
  FileJson,
  X,
  MessageSquareText,
  Paperclip,
  ListChecks,
  Clock,
  UserCheck,
  Check,
  FileSearch,
} from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { QTaskWordmark } from "@/components/QTaskLogo";
import { ScoreBadge } from "@/components/ScoreBadge";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { PERSONAS, type AgentId } from "@/lib/personas";
import type { SampleStage } from "@/lib/fixtures/sample-run";
import {
  IndicatorPanel,
  type IndicatorPanelData,
} from "@/components/upload/IndicatorPanel";

import { DepartmentChat, type ChatTurn } from "@/components/agents/DepartmentChat";
import {
  EvidenceIntake,
  type EvidenceBundle,
} from "@/components/agents/EvidenceIntake";
import { hasPlaybook } from "@/lib/tadat/evidence-requests";
import { RiskHeatmap } from "@/components/agents/charts/RiskHeatmap";
import { EmirateDonut } from "@/components/charts/EmirateDonut";
import { ArrearsAgingStrip } from "@/components/charts/ArrearsAgingStrip";
import { Gauge } from "@/components/charts/Gauge";
import { UserSwitcher } from "@/components/workspace/UserSwitcher";
import { NotificationBell } from "@/components/workspace/NotificationBell";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { downstreamOf } from "@/lib/workflow/types";
import { ArrowRight } from "lucide-react";

interface AgentRunResp {
  success: boolean;
  agent?: string;
  poa?: number;
  duration_ms?: number;
  inputs?: unknown;
  parsed?: Record<string, unknown>;
  parse_error?: string | null;
  error?: string;
}

interface SnapshotResp {
  distributions?: {
    by_emirate?: Array<{ emirate: string; count: number }>;
    arrears_by_bucket?: Array<{ age_bucket: string; cases: number; amount_aed: number }>;
  };
  poa1?: {
    registry_stats?: {
      total_records: number;
      missing_either_contact_count: number;
      soft_duplicate_pairs_count: number;
      active_with_no_recent_filing_count: number;
    };
  };
  poa5?: {
    vat_on_time_pct_v?: number;
    e_payment_pct?: number;
  };
}

// ─── Component ────────────────────────────────────────────────────────────

interface DepartmentDashboardProps {
  stage: SampleStage;
}

export function DepartmentDashboard({ stage }: DepartmentDashboardProps) {
  const persona = PERSONAS[stage.id];
  const { state: wsState, setCurrentUser } = useWorkspace();

  // Sync URL → workspace currentUser when the user navigates directly to a
  // department (so the switcher, notifications, and intro fire for the
  // persona whose page we're on).
  React.useEffect(() => {
    if (wsState.currentUser !== stage.id) {
      setCurrentUser(stage.id);
    }
  }, [stage.id, wsState.currentUser, setCurrentUser]);

  const [run, setRun] = React.useState<AgentRunResp | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [ingesting, setIngesting] = React.useState(false);
  const [preview, setPreview] = React.useState<unknown>(null);
  const [snapshot, setSnapshot] = React.useState<SnapshotResp | null>(null);
  const [openIndicator, setOpenIndicator] =
    React.useState<IndicatorPanelData | null>(null);
  // Evidence-intake flow for any POA with an authored playbook (Layla, Hamad…).
  const evidenceFlow = hasPlaybook(stage.poa);
  const [picked, setPicked] = React.useState<PickedFile | null>(() =>
    hasPlaybook(stage.poa) ? null : defaultSampleFor(stage.id),
  );
  /** Parsed contents of an uploaded (non-sample) file. Lets the dataset
   *  preview show real rows + apply heuristic red-flagging. */
  const [uploadedPreview, setUploadedPreview] =
    React.useState<DeptSamplePreview | null>(null);
  const [parsingUpload, setParsingUpload] = React.useState(false);
  /** TADAT evidence intake bundle (answers + attachments) collected from the
   *  reviewer — passed into the scoring run for the registry agent. */
  const [evidenceBundle, setEvidenceBundle] =
    React.useState<EvidenceBundle | null>(null);
  /** Layla's chat interview transcript — fed into scoring alongside the
   *  checklist bundle so answers given in chat also count. */
  const [chatTranscript, setChatTranscript] = React.useState<ChatTurn[]>([]);
  /** One-shot result summary injected into the chat after a scoring run. */
  const runSeqRef = React.useRef(0);
  const [chatInjection, setChatInjection] =
    React.useState<{ seq: number; text: string } | null>(null);

  // Pull pre-aggregate inputs + snapshot on mount
  React.useEffect(() => {
    fetch(`/api/agents/${stage.id}/preview`)
      .then((r) => r.json())
      .then((j) => setPreview(j.inputs ?? j))
      .catch(() => {});
    fetch("/api/dashboard/snapshot")
      .then((r) => r.json())
      .then((j) => setSnapshot(j))
      .catch(() => {});
  }, [stage.id]);

  async function runLive() {
    setLoading(true);
    setRun(null);

    // Brief ingest beat so the read feels real before the agent fires.
    if (picked || evidenceFlow) {
      setIngesting(true);
      await new Promise((r) => setTimeout(r, 650));
      setIngesting(false);
    }

    try {
      const r = await fetch(`/api/agents/${stage.id}/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Registry (Layla) scores from the evidence bundle + chat interview
        // transcript when present; other agents post an empty body.
        body: JSON.stringify({
          ...(evidenceBundle ? { evidenceBundle } : {}),
          ...(evidenceFlow && chatTranscript.length
            ? { chatTranscript }
            : {}),
        }),
      });
      const j = (await r.json()) as AgentRunResp;
      setRun(j);
      // Inject a result summary into the chat channel (registry/evidence flow).
      if (evidenceFlow && j.success && j.parsed) {
        runSeqRef.current += 1;
        setChatInjection({
          seq: runSeqRef.current,
          text: buildResultSummary(j.parsed),
        });
      }
    } catch (e) {
      setRun({ success: false, error: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  // Effective fields: live response > fixture defaults
  const parsed = run?.parsed ?? null;
  const inputs = run?.inputs ?? preview;
  const effectiveScore =
    (parsed?.poa_aggregate_score as string | undefined) ??
    (parsed?.aggregate_score as string | undefined) ??
    stage.aggregate_score;
  const effectiveOutcome =
    (parsed?.business_outcome as string | undefined) ??
    (parsed?.recommendations as string[] | undefined)?.[0] ??
    stage.business_outcome;

  // Indicator rows — normalised across v1/v2 schemas
  const rawIndicators =
    (parsed?.indicators as Array<Record<string, unknown>> | undefined) ?? null;

  // Build indicator list (live > fixture)
  const indicatorRows = rawIndicators ?? stage.indicators.map((ind) => ({
    indicator_id: ind.code,
    indicator_name: ind.name,
    aggregate_score: ind.score,
    scoring_method: ind.scoring_method,
    tadat_reference: ind.tadat_reference,
  }));

  // Recommendations
  const recommendations =
    (parsed?.recommendations as string[] | undefined) ?? [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#282C34]">
      <div className="page-accent-bar" />

      {/* Top bar */}
      <header className="border-b border-gray-200/60 bg-white/80 backdrop-blur dark:border-white/5 dark:bg-[#1e2128]/80 sticky top-0 z-30">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white shrink-0"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Home
            </Link>
            <QTaskWordmark />
            <span className="hidden md:inline text-gray-300 dark:text-white/20">|</span>
            <div className="hidden md:flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-400">
                {persona.poaName}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <NotificationBell />
            <UserSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 md:px-6 py-6 space-y-5">
        {/* Department banner */}
        <DepartmentBanner
          stage={stage}
          score={effectiveScore}
          outcome={effectiveOutcome}
          loading={loading}
          ingesting={ingesting}
          run={run}
          picked={picked}
          onRun={runLive}
          evidenceMode={evidenceFlow}
        />

        {/* Engagement + pending-tasks strip (evidence flow) */}
        {evidenceFlow && (
          <AssessmentStatusStrip bundle={evidenceBundle} parsed={parsed} run={run} />
        )}

        {/* TADAT evidence intake — Layla asks, the reviewer uploads */}
        {hasPlaybook(stage.poa) && (
          <EvidenceIntake
            agentId={stage.id}
            poa={stage.poa}
            onBundleChange={setEvidenceBundle}
          />
        )}

        {/* Old prepared-dataset flow — kept for the non-evidence agents only */}
        {!evidenceFlow && (
          <>
            <DepartmentSource
              stage={stage}
              picked={picked}
              onPick={(p) => {
                setPicked(p);
                if (!p || p.source !== "drop") setUploadedPreview(null);
              }}
              onUploadedParsed={setUploadedPreview}
              onParsingChange={setParsingUpload}
              disabled={loading}
            />
            {picked && (
              <SamplePreviewPanel
                stage={stage}
                picked={picked}
                uploadedPreview={uploadedPreview}
                parsingUpload={parsingUpload}
              />
            )}
          </>
        )}

        {/* Main 2-col grid */}
        <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)] gap-5">
          {/* MAIN COLUMN */}
          <div className="space-y-5 min-w-0">
            {/* Signature chart */}
            <SignatureChart
              stage={stage}
              parsed={parsed}
              snapshot={snapshot}
            />

            {/* Indicators table */}
            <IndicatorsBlock
              rows={indicatorRows}
              onPick={setOpenIndicator}
            />

            {/* Layla's per-evidence appraisal (evidence flow) */}
            {evidenceFlow && <EvidenceReviewPanel parsed={parsed} />}

            {/* Human reviewer lane (evidence flow) */}
            {evidenceFlow && <ReviewerLane parsed={parsed} />}

            {/* Flagged records */}
            <FlaggedBlock id={stage.id} parsed={parsed} />

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <section className="glass-panel p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
                  <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-400">
                    Recommendations
                  </p>
                </div>
                <ul className="space-y-2">
                  {recommendations.map((r, i) => (
                    <li
                      key={i}
                      className="flex gap-2 text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed"
                    >
                      <span className="text-indigo-500 dark:text-indigo-400 shrink-0">→</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* CHAT RAIL */}
          <div className="min-w-0 xl:sticky xl:top-24 self-start">
            <DepartmentChat
              agentId={stage.id}
              parsed={parsed}
              inputs={inputs}
              interviewMode={evidenceFlow}
              onTranscriptChange={setChatTranscript}
              injection={chatInjection}
            />
          </div>
        </div>

        {/* Footer */}
        <footer className="pt-6 border-t border-gray-200 dark:border-white/5 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
          <span>Field Guide 2025 · TADAT POA {stage.poa}</span>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 hover:text-gray-900 dark:hover:text-white"
          >
            Back to dashboard
            <ExternalLink className="h-3 w-3" />
          </Link>
        </footer>
      </main>

      <IndicatorPanel
        open={openIndicator !== null}
        data={openIndicator}
        onClose={() => setOpenIndicator(null)}
      />
    </div>
  );
}

// ─── Banner ───────────────────────────────────────────────────────────────

function DepartmentBanner({
  stage,
  score,
  outcome,
  loading,
  ingesting,
  run,
  picked,
  onRun,
  evidenceMode = false,
}: {
  stage: SampleStage;
  score: string;
  outcome: string;
  loading: boolean;
  ingesting: boolean;
  run: AgentRunResp | null;
  picked: PickedFile | null;
  onRun: () => void;
  evidenceMode?: boolean;
}) {
  const persona = PERSONAS[stage.id];
  const { state: wsState, handoffFromAgent } = useWorkspace();
  const downId = downstreamOf(stage.id);
  const downPersona = downId ? PERSONAS[downId] : null;
  const myWorkspaceState = wsState.agents[stage.id];
  const handedOff = myWorkspaceState?.status === "handed_off";
  const canHandoff = run?.success === true && downPersona !== null;

  function onHandoff() {
    if (!run?.success) return;
    handoffFromAgent(stage.id, { score, outcome });
  }
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-7 md:p-8 shadow-2xl shadow-indigo-500/20 animate-fade-up">
      <div className="absolute -left-16 -top-16 h-56 w-56 rounded-full bg-white/5" />
      <div className="absolute -right-20 -bottom-20 h-64 w-64 rounded-full bg-white/5" />
      <div className="relative">
        <div className="flex flex-wrap items-start gap-6 justify-between">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <PersonaAvatar persona={persona} size={64} />
            <div className="min-w-0">
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/65 mb-1">
                POA {stage.poa}
              </p>
              <h1 className="text-3xl md:text-[40px] font-bold tracking-tight text-white leading-tight">
                {persona.poaName}
              </h1>
              <p className="mt-1.5 text-[13px] text-white/80">
                Led by{" "}
                <span className="font-semibold text-white">{persona.name}</span>
                <span className="text-white/65"> · {persona.role}</span>
              </p>
              {evidenceMode && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {[
                    "Evidence-based",
                    "M1 · lowest-wins",
                    "No evidence = D",
                    "Field Guide 2025 · POA 1",
                  ].map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-white/85"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-3 shrink-0">
            <BigScore score={score} />
            {run?.success === false && (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-300/40 bg-red-300/10 px-2.5 py-1 text-[11px] text-red-200">
                <AlertCircle className="h-3 w-3" />
                Run failed
              </span>
            )}
            {run?.success && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/40 bg-emerald-300/10 px-2.5 py-1 text-[11px] text-emerald-200">
                <CheckCircle2 className="h-3 w-3" />
                Live · {((run.duration_ms ?? 0) / 1000).toFixed(1)}s
              </span>
            )}
            <button
              onClick={onRun}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-indigo-700 hover:opacity-90 transition disabled:opacity-60 disabled:cursor-wait shadow-md shadow-black/20"
            >
              {ingesting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {evidenceMode
                    ? "Reading evidence…"
                    : `Reading ${picked?.name?.slice(0, 24) ?? "file"}…`}
                </>
              ) : loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Scoring…
                </>
              ) : run ? (
                <>
                  <RefreshCw className="h-4 w-4" />
                  {evidenceMode ? "Re-assess" : `Re-run ${picked ? "on this file" : ""}`}
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  {evidenceMode
                    ? "Process evidence & score"
                    : picked
                      ? "Run on this file"
                      : "Run my agent"}
                </>
              )}
            </button>

            {/* Handover — appears once the run is successful */}
            {downPersona && (
              <>
                {canHandoff && !handedOff && (
                  <Link
                    href={`/agents/${downId}`}
                    onClick={onHandoff}
                    className="inline-flex items-center gap-2 rounded-full border-2 border-white/40 bg-white/10 backdrop-blur-md px-5 py-2.5 text-sm font-bold text-white hover:bg-white/20 transition shadow-md shadow-black/20"
                  >
                    Hand over to {downPersona.name}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
                {handedOff && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-300/15 px-4 py-2 text-[12px] font-semibold text-emerald-100">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Handed off to {downPersona.name}
                  </span>
                )}
                {!canHandoff && !handedOff && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/5 px-3 py-1.5 text-[11px] text-white/65">
                    Run first to hand off → {downPersona.name}
                  </span>
                )}
              </>
            )}
            {!downPersona && run?.success && (
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-300/15 px-4 py-2 text-[12px] font-semibold text-emerald-100">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Lifecycle complete · {persona.name} is last
              </span>
            )}
          </div>
        </div>

        {/* Outcome + KPIs */}
        <div className="mt-6 pt-6 border-t border-white/15">
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/60 mb-2">
            Business outcome
          </p>
          <p className="text-base md:text-lg leading-relaxed text-white/90 max-w-3xl">
            {outcome}
          </p>

          <div className="mt-5 grid grid-cols-3 gap-2 max-w-2xl">
            {stage.kpis.map((k, i) => (
              <div
                key={i}
                className="rounded-xl border border-white/15 bg-white/10 backdrop-blur-sm px-3 py-2.5"
              >
                <p className="text-[9px] font-mono uppercase tracking-wider text-white/55 leading-tight">
                  {k.label}
                </p>
                <p className="mt-1 text-base font-bold text-white tabular-nums leading-tight">
                  {k.value}
                </p>
                {k.caption && (
                  <p className="text-[9px] text-white/55 leading-tight mt-0.5">
                    {k.caption}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Assessment status strip — engagement + pending tasks (evidence flow) ──

function AssessmentStatusStrip({
  bundle,
  parsed,
  run,
}: {
  bundle: EvidenceBundle | null;
  parsed: Record<string, unknown> | null;
  run: AgentRunResp | null;
}) {
  const qa = bundle?.totals.questions_answered ?? 0;
  const qt = bundle?.totals.questions ?? 0;
  const ea = bundle?.totals.evidence_provided ?? 0;
  const et = bundle?.totals.evidence ?? 0;
  const inds =
    (parsed?.indicators as Array<Record<string, unknown>> | undefined) ?? [];
  const scored = inds.filter((i) => typeof i.score === "string").length;
  const scoredTotal = inds.length || 3;
  const status = run?.success
    ? "Awaiting reviewer sign-off"
    : run?.success === false
      ? "Last run failed"
      : "Not yet scored";

  const items: Array<{ icon: React.ReactNode; label: string; value: string; wide?: boolean }> = [
    { icon: <MessageSquareText className="h-3.5 w-3.5" />, label: "Questions answered", value: `${qa}/${qt}` },
    { icon: <Paperclip className="h-3.5 w-3.5" />, label: "Evidence provided", value: `${ea}/${et}` },
    { icon: <ListChecks className="h-3.5 w-3.5" />, label: "Dimensions scored", value: `${scored}/${scoredTotal}` },
    { icon: <Clock className="h-3.5 w-3.5" />, label: "Status", value: status, wide: true },
  ];

  return (
    <section className="glass-panel px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-400">
          Engagement · pending tasks
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {items.map((it) => (
          <div
            key={it.label}
            className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] px-3 py-2"
          >
            <p className="flex items-center gap-1.5 text-[9.5px] font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {it.icon}
              {it.label}
            </p>
            <p
              className={`mt-1 font-bold text-gray-900 dark:text-white ${
                it.wide ? "text-[12.5px] leading-tight" : "text-base tabular-nums"
              }`}
            >
              {it.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Assessment scorecard — evidence-based result (replaces RegistryChart) ──

function AssessmentScorecard({
  parsed,
}: {
  parsed: Record<string, unknown> | null;
}) {
  const inds =
    (parsed?.indicators as Array<Record<string, unknown>> | undefined) ?? [];
  const p11 = parsed?.p1_1_aggregate as string | undefined;
  const poa = parsed?.aggregate_score as string | undefined;
  const poaNum = (parsed?.poa as number | undefined) ?? undefined;

  return (
    <section className="glass-panel p-5">
      <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-indigo-500 dark:text-indigo-400 mb-1">
        Evidence-based assessment{poaNum ? ` · POA ${poaNum}` : ""}
      </p>
      <h3 className="text-base font-bold text-gray-900 dark:text-white">
        Dimension scorecard — graded from the evidence provided
      </h3>

      {inds.length === 0 ? (
        <p className="mt-4 text-[12.5px] text-gray-500 dark:text-gray-400 italic leading-relaxed">
          Provide evidence above, then click{" "}
          <span className="font-semibold">Process evidence &amp; score</span>. Each
          dimension is graded against the TADAT criteria — anything with no
          evidence scores D.
        </p>
      ) : (
        <>
          <div className="mt-4 space-y-2">
            {inds.map((i, idx) => {
              const id = (i.id as string) ?? "—";
              const score = (i.score as string) ?? undefined;
              const kind = (i.dim_kind as string) ?? null;
              const finding = (i.finding as string) ?? "";
              return (
                <div
                  key={`${id}-${idx}`}
                  className="flex items-start gap-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] px-3 py-2.5"
                >
                  <div className="shrink-0 pt-0.5">
                    {score ? (
                      <ScoreBadge score={score} />
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-300">
                        {id}
                      </span>
                      {kind && (
                        <span className="rounded-sm bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                          {kind}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[12px] text-gray-700 dark:text-gray-300 leading-snug line-clamp-2">
                      {finding}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* M1 rollup */}
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-500/[0.06] px-4 py-3">
            {p11 && (
              <>
                <Rollup label="P1-1 · lowest of dims" score={p11} />
                <span className="text-gray-300 dark:text-white/20">→</span>
              </>
            )}
            <Rollup
              label={`POA${poaNum ? " " + poaNum : ""} · lowest of all dimensions`}
              score={poa}
            />
            <span className="ml-auto text-[10px] font-mono text-gray-500 dark:text-gray-400">
              M1 aggregation · Field Guide p.13
            </span>
          </div>
        </>
      )}
    </section>
  );
}

function Rollup({ label, score }: { label: string; score?: string }) {
  return (
    <div className="flex items-center gap-2">
      {score ? <ScoreBadge score={score} /> : <span className="text-gray-400">—</span>}
      <span className="text-[11px] text-gray-600 dark:text-gray-300">{label}</span>
    </div>
  );
}

// ─── Reviewer lane — human accept/override (visual in this POC) ─────────────

function ReviewerLane({ parsed }: { parsed: Record<string, unknown> | null }) {
  const inds =
    (parsed?.indicators as Array<Record<string, unknown>> | undefined) ?? [];
  const [decisions, setDecisions] = React.useState<
    Record<string, "accepted" | "overridden">
  >({});

  return (
    <section className="glass-panel p-5">
      <div className="flex items-center justify-between mb-1">
        <p className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
          <UserCheck className="h-3.5 w-3.5" /> Human reviewer · sign-off
        </p>
        <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">
          visual in this POC
        </span>
      </div>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
        Layla proposes each score from the evidence; a TADAT reviewer accepts or
        overrides it before the assessment is final.
      </p>
      {inds.length === 0 ? (
        <p className="text-[12.5px] text-gray-500 dark:text-gray-400 italic">
          Scores appear here for review once Layla has run.
        </p>
      ) : (
        <ul className="space-y-2">
          {inds.map((i, idx) => {
            const id = (i.id as string) ?? "—";
            const score = (i.score as string) ?? undefined;
            const d = decisions[id];
            return (
              <li
                key={`${id}-${idx}`}
                className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] px-3 py-2"
              >
                <span className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-300 w-14 shrink-0">
                  {id}
                </span>
                {score ? (
                  <ScoreBadge score={score} />
                ) : (
                  <span className="text-gray-400">—</span>
                )}
                <div className="ml-auto flex items-center gap-1.5">
                  {d === "accepted" && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/50 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                      <Check className="h-3 w-3" /> Accepted
                    </span>
                  )}
                  {d === "overridden" && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/50 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                      Overridden
                    </span>
                  )}
                  <button
                    onClick={() =>
                      setDecisions((s) => ({ ...s, [id]: "accepted" }))
                    }
                    className="rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-2.5 py-1 text-[11px] font-medium text-gray-700 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() =>
                      setDecisions((s) => ({ ...s, [id]: "overridden" }))
                    }
                    className="rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-2.5 py-1 text-[11px] font-medium text-gray-700 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition"
                  >
                    Override
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ─── Evidence review — Layla's per-item appraisal ──────────────────────────

function EvidenceReviewPanel({
  parsed,
}: {
  parsed: Record<string, unknown> | null;
}) {
  const inds =
    (parsed?.indicators as Array<Record<string, unknown>> | undefined) ?? [];
  const groups = inds
    .map((i) => ({
      id: (i.id as string) ?? "—",
      reviews:
        (i.evidence_review as Array<Record<string, unknown>> | undefined) ?? [],
    }))
    .filter((g) => g.reviews.length > 0);
  if (groups.length === 0) return null;

  return (
    <section className="glass-panel p-5">
      <p className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-400 mb-1">
        <FileSearch className="h-3.5 w-3.5" /> Layla&apos;s evidence review
      </p>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
        What each piece of evidence was worth — and whether it was relevant to the score.
      </p>
      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.id}>
            <p className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-300 mb-1.5">
              {g.id}
            </p>
            <ul className="space-y-1.5">
              {g.reviews.map((r, i) => {
                const rel = (r.relevance as string) ?? "relevant";
                const item = (r.item as string) ?? "—";
                const comment = (r.comment as string) ?? "";
                return (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] px-3 py-2"
                  >
                    <RelevanceChip relevance={rel} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium text-gray-800 dark:text-gray-200 leading-snug">
                        {item}
                      </p>
                      {comment && (
                        <p className="text-[11.5px] text-gray-600 dark:text-gray-400 leading-snug mt-0.5">
                          {comment}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function RelevanceChip({ relevance }: { relevance: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    relevant: {
      label: "Relevant",
      cls: "border-emerald-300/50 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
    },
    partial: {
      label: "Partial",
      cls: "border-sky-300/50 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300",
    },
    insufficient: {
      label: "Insufficient",
      cls: "border-amber-300/50 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
    },
    not_relevant: {
      label: "Not relevant",
      cls: "border-gray-300 bg-gray-100 text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-400",
    },
  };
  const c = map[relevance] ?? map.relevant;
  return (
    <span
      className={`shrink-0 mt-0.5 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${c.cls}`}
    >
      {c.label}
    </span>
  );
}

// ─── Result summary posted into the chat after a scoring run ───────────────

function buildResultSummary(parsed: Record<string, unknown>): string {
  const inds =
    (parsed.indicators as Array<Record<string, unknown>> | undefined) ?? [];
  const poaNum = (parsed.poa as number | undefined) ?? "";
  const lines: string[] = [`I've scored POA ${poaNum} from your evidence:`];
  for (const i of inds) {
    lines.push(
      `• ${(i.id as string) ?? "?"}: ${(i.score as string) ?? "?"} — ${(i.finding as string) ?? ""}`,
    );
  }
  const p11 = parsed.p1_1_aggregate as string | undefined;
  const agg = (parsed.aggregate_score as string) ?? "—";
  lines.push(
    p11
      ? `Overall: P1-1 ${p11} → POA ${poaNum} ${agg} (M1, lowest-wins).`
      : `Overall: POA ${poaNum} ${agg} (M1, lowest of all dimensions).`,
  );

  const highlights: string[] = [];
  for (const i of inds) {
    const rev =
      (i.evidence_review as Array<Record<string, unknown>> | undefined) ?? [];
    for (const r of rev) {
      if (highlights.length >= 3) break;
      highlights.push(
        `• [${(r.relevance as string) ?? "?"}] ${(r.item as string) ?? ""}`,
      );
    }
    if (highlights.length >= 3) break;
  }
  if (highlights.length) {
    lines.push("", "Evidence review (sample):", ...highlights);
  }

  const rec = (parsed.recommendations as string[] | undefined)?.[0];
  if (rec) lines.push("", `Top recommendation: ${rec}`);
  lines.push(
    "",
    "Ask me why any band, which evidence was relevant, or to list the data.",
  );
  return lines.join("\n");
}

// ─── BigScore ─ prominent aggregate-score block for the banner ────────────

function BigScore({ score }: { score: string | undefined }) {
  const letter = (score ?? "—").toString();
  const head = letter.charAt(0).toUpperCase();
  // Color the accent bar + label to match the TADAT band.
  const band =
    head === "A"
      ? { bar: "bg-emerald-400", text: "text-emerald-300", label: "Excellent" }
      : head === "B"
        ? { bar: "bg-sky-400", text: "text-sky-300", label: "Broadly compliant" }
        : head === "C"
          ? { bar: "bg-amber-400", text: "text-amber-300", label: "Partial" }
          : head === "D"
            ? { bar: "bg-red-400", text: "text-red-300", label: "Non-compliant" }
            : { bar: "bg-white/30", text: "text-white/65", label: "Not yet scored" };
  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-white/30 bg-white/[0.14] backdrop-blur-md min-w-[140px]">
      <div className={`absolute inset-x-0 top-0 h-1 ${band.bar}`} aria-hidden />
      <div className="px-4 pt-3 pb-3 text-right">
        <p className="text-[9px] font-mono uppercase tracking-[0.22em] text-white/65">
          Aggregate score
        </p>
        <p className="mt-1 font-display text-[56px] leading-none font-black tracking-tight text-white tabular-nums">
          {letter}
        </p>
        <p className={`mt-1 text-[10px] font-semibold uppercase tracking-wider ${band.text}`}>
          {band.label}
        </p>
      </div>
    </div>
  );
}

// ─── Per-persona signature chart ──────────────────────────────────────────

function SignatureChart({
  stage,
  parsed,
  snapshot,
}: {
  stage: SampleStage;
  parsed: Record<string, unknown> | null;
  snapshot: SnapshotResp | null;
}) {
  if (hasPlaybook(stage.poa)) {
    // Evidence-based result card replaces the per-POA chart for playbook POAs
    // (the old DB-driven charts remain below for non-evidence POAs).
    return <AssessmentScorecard parsed={parsed} />;
  }
  if (stage.id === "risk") {
    const risks =
      (parsed?.risk_register_top as
        | Array<{
            name: string;
            segment?: string;
            likelihood?: string;
            impact?: string;
            estimated_aed_at_risk?: number | null;
            source?: string;
          }>
        | undefined) ?? FALLBACK_RISKS;
    return <RiskHeatmap risks={risks} />;
  }
  if (stage.id === "service") {
    return <ServiceChart parsed={parsed} />;
  }
  if (stage.id === "payments") {
    return <PaymentsChart parsed={parsed} snapshot={snapshot} />;
  }
  return null;
}

const FALLBACK_RISKS = [
  {
    name: "CT large-segment non-filers",
    segment: "Large",
    likelihood: "High",
    impact: "High",
    estimated_aed_at_risk: 50_000_000,
    source: "data-derived",
  },
  {
    name: "VAT refund-fraud (registry duplicates)",
    segment: "Medium",
    likelihood: "Medium",
    impact: "High",
    estimated_aed_at_risk: 12_000_000,
    source: "data-derived",
  },
  {
    name: "Excise — high-AED arrears",
    segment: "Medium",
    likelihood: "Medium",
    impact: "Medium",
    estimated_aed_at_risk: 18_500_000,
    source: "data-derived",
  },
  {
    name: "Transfer pricing",
    segment: "Large",
    likelihood: "Low",
    impact: "High",
    estimated_aed_at_risk: null,
    source: "tadat-illustrative",
  },
  {
    name: "Hidden economy",
    segment: "Micro-Small",
    likelihood: "High",
    impact: "Medium",
    estimated_aed_at_risk: null,
    source: "tadat-illustrative",
  },
];

function RegistryChart({ snapshot }: { snapshot: SnapshotResp | null }) {
  const dist = snapshot?.distributions?.by_emirate ?? [];
  const stats = snapshot?.poa1?.registry_stats;
  const total = stats?.total_records ?? 0;
  const issues =
    (stats?.missing_either_contact_count ?? 0) +
    (stats?.soft_duplicate_pairs_count ?? 0) +
    (stats?.active_with_no_recent_filing_count ?? 0);
  const healthPct =
    total > 0 ? Math.max(0, Math.round(100 - (issues / total) * 100)) : 0;
  return (
    <section className="glass-panel p-5">
      <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-indigo-500 dark:text-indigo-400 mb-1">
        Registry footprint
      </p>
      <h3 className="text-base font-bold text-gray-900 dark:text-white">
        Distribution by emirate · registry-health gauge
      </h3>
      <div className="mt-4 grid md:grid-cols-[minmax(0,1fr)_auto] gap-4 items-center">
        {dist.length > 0 ? (
          <EmirateDonut data={dist} />
        ) : (
          <div className="text-[12px] text-gray-500 dark:text-gray-400 italic">
            Loading distribution…
          </div>
        )}
        {stats ? (
          <div className="flex flex-col items-center gap-2">
            <Gauge value={healthPct} label="Health" />
            <div className="text-[10px] font-mono text-gray-500 dark:text-gray-400 text-center">
              {issues.toLocaleString()} issues / {total.toLocaleString()}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ServiceChart({
  parsed: _parsed,
}: {
  parsed: Record<string, unknown> | null;
}) {
  // Service channel mix is illustrative (real channel data not yet wired).
  const CHANNELS = [
    { ch: "EmaraTax portal", pct: 62, color: "from-fuchsia-500 to-pink-500" },
    { ch: "Telephone", pct: 22, color: "from-violet-500 to-indigo-500" },
    { ch: "Email / chat", pct: 11, color: "from-blue-500 to-cyan-500" },
    { ch: "Walk-in / Tasheel", pct: 5, color: "from-emerald-500 to-teal-500" },
  ];
  return (
    <section className="glass-panel p-5">
      <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-indigo-500 dark:text-indigo-400 mb-1">
        Service channel mix
      </p>
      <h3 className="text-base font-bold text-gray-900 dark:text-white">
        Where taxpayers reach Maya — and how long they wait
      </h3>
      <div className="mt-4 grid md:grid-cols-[minmax(0,1fr)_auto] gap-5 items-center">
        <div className="space-y-2">
          {CHANNELS.map((c) => (
            <div key={c.ch}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[12px] text-gray-700 dark:text-gray-300">
                  {c.ch}
                </span>
                <span className="font-mono text-[11px] text-gray-900 dark:text-white tabular-nums">
                  {c.pct}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-200 dark:bg-white/5 overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${c.color}`}
                  style={{ width: `${c.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center gap-1">
          <Gauge value={64} label="On-time SLA" thresholds={[50, 70, 85]} />
          <div className="text-[10px] font-mono text-gray-500 dark:text-gray-400 text-center">
            P50 telephone wait 7.4 min
          </div>
        </div>
      </div>
    </section>
  );
}

function PaymentsChart({
  parsed,
  snapshot,
}: {
  parsed: Record<string, unknown> | null;
  snapshot: SnapshotResp | null;
}) {
  const buckets = snapshot?.distributions?.arrears_by_bucket ?? [];
  const onTimePct = (parsed?.vat_on_time_pct_v as number | undefined) ??
    snapshot?.poa5?.vat_on_time_pct_v ?? 88;
  const ePayPct = (parsed?.e_payment_pct as number | undefined) ??
    snapshot?.poa5?.e_payment_pct ?? 78;
  return (
    <section className="glass-panel p-5">
      <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-indigo-500 dark:text-indigo-400 mb-1">
        Arrears aging + payment timeliness
      </p>
      <h3 className="text-base font-bold text-gray-900 dark:text-white">
        AED 195M outstanding — broken down by age + collectibility
      </h3>
      <div className="mt-4 space-y-4">
        {buckets.length > 0 ? (
          <ArrearsAgingStrip data={buckets} />
        ) : (
          <div className="text-[12px] text-gray-500 dark:text-gray-400 italic">
            Loading arrears aging…
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <div className="flex flex-col items-center">
            <Gauge value={onTimePct} label="VAT on-time" />
            <div className="text-[10px] font-mono text-gray-500 dark:text-gray-400 mt-1">by value</div>
          </div>
          <div className="flex flex-col items-center">
            <Gauge value={ePayPct} label="e-payment" thresholds={[40, 60, 80]} />
            <div className="text-[10px] font-mono text-gray-500 dark:text-gray-400 mt-1">% of payments</div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Indicators block ─────────────────────────────────────────────────────

function IndicatorsBlock({
  rows,
  onPick,
}: {
  rows: Array<Record<string, unknown>>;
  onPick: (d: IndicatorPanelData) => void;
}) {
  return (
    <section className="glass-panel p-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-indigo-500 dark:text-indigo-400">
          TADAT indicators · click any row
        </p>
        <p className="text-[10px] font-mono text-gray-500 dark:text-gray-400">
          {rows.length} total
        </p>
      </div>
      <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead className="bg-gray-50/80 dark:bg-white/[0.03]">
            <tr>
              <th className="px-3 py-2 text-left font-mono uppercase tracking-wider text-[9.5px] text-gray-500 dark:text-gray-400">
                Code
              </th>
              <th className="px-3 py-2 text-left font-mono uppercase tracking-wider text-[9.5px] text-gray-500 dark:text-gray-400">
                Method
              </th>
              <th className="px-3 py-2 text-left font-mono uppercase tracking-wider text-[9.5px] text-gray-500 dark:text-gray-400">
                Indicator
              </th>
              <th className="px-3 py-2 text-center font-mono uppercase tracking-wider text-[9.5px] text-gray-500 dark:text-gray-400">
                Score
              </th>
              <th className="px-3 py-2 text-right font-mono uppercase tracking-wider text-[9.5px] text-gray-500 dark:text-gray-400">
                Evidence
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((raw, i) => {
              const code =
                (raw.indicator_id as string) ??
                (raw.id as string) ??
                (raw.code as string) ??
                "—";
              const name =
                (raw.indicator_name as string) ??
                (raw.name as string) ??
                "";
              const score =
                (raw.aggregate_score as string) ??
                (raw.score as string) ??
                undefined;
              const method = raw.scoring_method as string | undefined;
              const finding = raw.finding as string | undefined;
              const detail = raw.detail as string | undefined;
              const evidence =
                ((raw.evidence as string[]) ?? []).concat(
                  ((raw.dimension_scores as Array<Record<string, unknown>>) ?? []).flatMap(
                    (d) => (d.evidence as string[]) ?? [],
                  ),
                );
              const dimensionScores =
                (raw.dimension_scores as Array<Record<string, unknown>>) ?? [];
              const ref = raw.tadat_reference as string | undefined;
              const data: IndicatorPanelData = {
                id: code,
                name,
                score,
                scoring_method: method,
                finding,
                detail,
                evidence,
                tadat_reference: ref,
                dimension_scores: dimensionScores.map((d) => ({
                  dim_id: (d.dim_id as string) ?? "—",
                  dim_name: d.dim_name as string | undefined,
                  score:
                    (d.score as string) ??
                    (d.aggregate_score as string) ??
                    undefined,
                  finding: d.finding as string | undefined,
                  detail: d.detail as string | undefined,
                  evidence: d.evidence as string[] | undefined,
                })),
              };
              return (
                <tr
                  key={`${code}-${i}`}
                  onClick={() => onPick(data)}
                  className="border-t border-gray-200 dark:border-white/5 cursor-pointer hover:bg-indigo-50/40 dark:hover:bg-indigo-500/[0.06] transition focus:outline-none focus-visible:bg-indigo-50/60 dark:focus-visible:bg-indigo-500/10"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onPick(data);
                    }
                  }}
                >
                  <td className="px-3 py-2.5 font-mono text-[11.5px] font-bold text-indigo-600 dark:text-indigo-300 whitespace-nowrap align-top">
                    {code}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap align-top">
                    {method && (
                      <span className="inline-flex items-center rounded-sm bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-gray-600 dark:text-gray-400">
                        {method}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-gray-900 dark:text-white leading-snug align-top">
                    <div className="line-clamp-2">
                      {name || (
                        <span className="text-gray-400 dark:text-gray-500 italic">
                          —
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center whitespace-nowrap align-top">
                    {score ? (
                      <ScoreBadge score={score} />
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap align-top">
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-mono text-indigo-600 dark:text-indigo-300">
                      {evidence.length > 0 ? `${evidence.length} · view` : "view"}
                      <span aria-hidden>→</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── Flagged records block ────────────────────────────────────────────────

function FlaggedBlock({
  id,
  parsed,
}: {
  id: AgentId;
  parsed: Record<string, unknown> | null;
}) {
  if (!parsed) return null;
  const data = extractFlagged(id, parsed);
  if (!data || data.rows.length === 0) return null;

  return (
    <section className="glass-panel p-5">
      <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400 mb-1">
        {data.title} ({data.rows.length})
      </p>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
        {data.subtitle}
      </p>
      <div className="rounded-lg border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-500/[0.03] overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-emerald-100/30 dark:bg-emerald-500/[0.06]">
            <tr>
              {data.columns.map((c) => (
                <th
                  key={c}
                  className="px-3 py-2 text-left font-mono uppercase tracking-wider text-[9.5px] text-emerald-700 dark:text-emerald-300 whitespace-nowrap"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, ri) => (
              <tr
                key={ri}
                className="border-t border-emerald-200/40 dark:border-emerald-500/10"
              >
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className="px-3 py-2 text-gray-800 dark:text-gray-200 font-mono tabular-nums whitespace-nowrap"
                  >
                    {String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function extractFlagged(
  id: AgentId,
  parsed: Record<string, unknown>,
): {
  title: string;
  subtitle: string;
  columns: string[];
  rows: Array<Array<string | number>>;
} | null {
  if (id === "risk") {
    const top =
      (parsed.risk_register_top as Array<Record<string, unknown>> | undefined) ??
      [];
    if (!top.length) return null;
    return {
      title: "Risks flagged",
      subtitle: `Top ${top.length} compliance risks ranked by AED at risk.`,
      columns: ["Risk", "Segment", "Source", "AED at risk"],
      rows: top.slice(0, 8).map((r) => [
        (r.name as string) ?? "—",
        (r.segment as string) ?? "—",
        (r.source as string) ?? "data-derived",
        typeof r.estimated_aed_at_risk === "number"
          ? fmtAed(r.estimated_aed_at_risk as number)
          : "—",
      ]),
    };
  }
  if (id === "service") {
    const list =
      (parsed.make_it_easier_backlog as Array<Record<string, unknown>> | undefined) ??
      [];
    if (!list.length) return null;
    return {
      title: "Backlog flagged",
      subtitle: `Top ${list.length} friction-reduction items ranked by priority.`,
      columns: ["Action", "Priority", "Owner", "ETA"],
      rows: list.slice(0, 8).map((b) => [
        (b.action as string) ?? "—",
        (b.priority as string) ?? "—",
        (b.owner as string) ?? "—",
        (b.eta as string) ?? "—",
      ]),
    };
  }
  if (id === "filing") {
    const wl = parsed.non_filer_worklist as
      | { top_non_filers?: Array<Record<string, unknown>> }
      | undefined;
    const list = wl?.top_non_filers ?? [];
    if (!list.length) return null;
    return {
      title: "Non-filers flagged",
      subtitle: `Top ${list.length} non-filers sorted by AED outstanding.`,
      columns: ["TRN", "Name", "Tax", "AED outstanding"],
      rows: list.slice(0, 8).map((d) => [
        mask((d.trn as string) ?? "—"),
        clip((d.name as string) ?? "—", 32),
        (d.tax_type as string) ?? "—",
        typeof d.aed_outstanding === "number"
          ? fmtAed(d.aed_outstanding as number)
          : "—",
      ]),
    };
  }
  if (id === "payments") {
    const list =
      (parsed.high_risk_debtors as Array<Record<string, unknown>> | undefined) ??
      [];
    if (!list.length) return null;
    return {
      title: "High-risk debtors flagged",
      subtitle: `Top ${list.length} debtors by AED × age × collectibility.`,
      columns: ["TRN", "Name", "Tax", "Age", "AED outstanding"],
      rows: list.slice(0, 8).map((d) => [
        mask((d.trn as string) ?? "—"),
        clip((d.legal_name_en as string) ?? "—", 30),
        (d.tax_type as string) ?? "—",
        (d.age_bucket as string) ?? "—",
        typeof d.outstanding_aed === "number"
          ? fmtAed(d.outstanding_aed as number)
          : "—",
      ]),
    };
  }
  if (id === "registry") {
    const indicators =
      (parsed.indicators as Array<Record<string, unknown>> | undefined) ?? [];
    const items: Array<Array<string | number>> = [];
    for (const ind of indicators) {
      const evidence = (ind.evidence as string[] | undefined) ?? [];
      const code = (ind.id as string) ?? (ind.indicator_id as string) ?? "—";
      for (const e of evidence.slice(0, 2)) {
        items.push([code, clip(e, 90)]);
        if (items.length >= 8) break;
      }
      if (items.length >= 8) break;
    }
    if (!items.length) return null;
    return {
      title: "Registry issues flagged",
      subtitle: "Issues raised across indicators.",
      columns: ["Indicator", "Evidence"],
      rows: items,
    };
  }
  return null;
}

// ─── DepartmentSource ─ drop a file or pick a sample, scoped to this dept ──

interface PickedFile {
  name: string;
  size: string;
  source: "drop" | "sample";
}

/** A single row in a section's preview. `flag` carries an optional reason
 *  string — when present the row is rendered in red with the reason as a
 *  cell suffix / title attribute. */
interface SampleDataRow {
  cells: Array<string | number>;
  flag?: string;
}

interface DeptSamplePreview {
  period?: { start: string; end: string };
  sections: Array<{
    label: string;
    rows: number;
    summary: string;
    columns: string[];
    sample_rows: SampleDataRow[];
  }>;
  headlines: Array<{ label: string; value: string }>;
}

/** Helper — wraps cells in a plain row. */
function R(cells: Array<string | number>, flag?: string): SampleDataRow {
  return flag ? { cells, flag } : { cells };
}

interface DeptSample {
  filename: string;
  label: string;
  size: string;
  blurb: string;
  preview?: DeptSamplePreview;
}

const DEPT_SAMPLES: Record<AgentId, DeptSample[]> = {
  registry: [
    {
      filename: "Open data 2025 full year - final.xlsx",
      label: "FTA Open Data — 2025 full year",
      size: "~15 KB",
      blurb: "Default · monthly registrations by emirate + segment.",
      preview: {
        period: { start: "2025-01-01", end: "2025-12-31" },
        sections: [
          {
            label: "VAT registrations",
            rows: 1024,
            summary: "active TRNs · status + contact integrity",
            columns: ["TRN", "Legal name", "Emirate", "Segment", "Status"],
            sample_rows: [
              R(["100123456700003", "Al Futtaim Trading LLC", "Dubai", "Large", "Active"]),
              R(["100887654300001", "Emirates Steel Industries", "Abu Dhabi", "Large", "Active"]),
              R(["100665432100005", "Sharjah Electric Co.", "Sharjah", "Medium", "Suspended"], "Suspended >180d"),
              R(["100221144900008", "Marina Logistics Co.", "Dubai", "Medium", "Active"], "Missing phone"),
              R(["100558800100004", "ADNOC Distribution PJSC", "Abu Dhabi", "Large", "Active"]),
              R(["100994412100002", "Al Wahda Trading", "Sharjah", "Small", "Active"], "Missing email"),
              R(["100339911200007", "Yas Holdings LLC", "Abu Dhabi", "Medium", "Active"]),
              R(["100447782200006", "Tobacco Distributors LLC", "Dubai", "Medium", "Active"]),
              R(["100992210400002", "Carbonated Bottling Co.", "Sharjah", "Medium", "Active"]),
              R(["100665432100013", "Sharjah Electric Trading", "Sharjah", "Medium", "Active"], "Soft duplicate of …100005"),
              R(["100665432100025", "Sharjah Electric Co - Branch", "Sharjah", "Small", "Active"], "Soft duplicate of …100005"),
              R(["100112233400001", "Etisalat by e&", "Abu Dhabi", "Large", "Active"]),
              R(["100334455600002", "Majid Al Futtaim Retail", "Dubai", "Large", "Active"]),
              R(["100778899100003", "Energy Drinks UAE", "Ajman", "Small", "Active"], "Dormant 14m · status Active"),
              R(["100662112300004", "Ras Hardware Trading", "Ras Al Khaimah", "Small", "Active"], "Dormant 9m · status Active"),
            ],
          },
          {
            label: "CT registrations",
            rows: 856,
            summary: "Corporate Tax registrations · segment + FY end checks",
            columns: ["TRN", "Legal name", "Segment", "FY end", "Registered"],
            sample_rows: [
              R(["100558800100004", "ADNOC Distribution PJSC", "Large", "2025-12-31", "2023-06-01"]),
              R(["100339911200007", "Yas Holdings LLC", "Medium", "2025-12-31", "2024-01-15"]),
              R(["100112233400001", "Etisalat by e&", "Large", "2025-12-31", "2023-08-01"]),
              R(["100334455600002", "Majid Al Futtaim Retail", "Large", "2025-12-31", "2023-09-12"]),
              R(["100990011200002", "Dubai Holding Investments", "Large", "2025-12-31", "2024-02-28"], "Segment unverified"),
              R(["100221144900008", "Marina Logistics Co.", "Medium", "—", "2025-04-11"], "FY end missing"),
              R(["100994412100002", "Al Wahda Trading", "Small", "2025-12-31", "2025-01-08"]),
              R(["100447782200006", "Tobacco Distributors LLC", "Medium", "2025-12-31", "2024-03-22"]),
              R(["100339911200099", "Yas Holdings LLC - Branch", "Medium", "2025-12-31", "2024-01-15"], "Soft duplicate of …200007"),
              R(["100776655400001", "Al Tayer Insignia", "Large", "2025-12-31", "2023-10-19"]),
              R(["100665432100099", "Sharjah Electric - Subsidiary", "Small", "—", "2024-11-30"], "FY end missing · linked"),
              R(["100118822700001", "Borouge PLC", "Large", "2025-12-31", "2023-12-01"]),
            ],
          },
          {
            label: "Contact-info gaps",
            rows: 62,
            summary: "every row here is flagged — Layla's headline finding",
            columns: ["TRN", "Legal name", "Missing", "Last verified"],
            sample_rows: [
              R(["100221144900008", "Marina Logistics Co.", "phone", "2023-08-14"], "Missing required field"),
              R(["100994412100002", "Al Wahda Trading", "email", "2024-02-22"], "Missing required field"),
              R(["100665432100099", "Sharjah Electric - Subsidiary", "phone, email", "2022-11-04"], "Missing 2 fields"),
              R(["100778899100003", "Energy Drinks UAE", "address", "2023-01-30"], "Address blank"),
              R(["100662112300004", "Ras Hardware Trading", "phone", "2024-06-12"], "Missing required field"),
              R(["100118822700199", "Borouge PLC - Office 2", "email", "2024-09-01"], "Missing required field"),
              R(["100776655400099", "Al Tayer Insignia - Annex", "phone, email", "2023-04-18"], "Missing 2 fields"),
            ],
          },
        ],
        headlines: [
          { label: "Active TRNs", value: "1,024" },
          { label: "Missing contact", value: "62" },
          { label: "Soft duplicates", value: "24" },
          { label: "Dormant mismatch", value: "38" },
        ],
      },
    },
    {
      filename: "VAT Registeration.xlsx",
      label: "VAT registrations (active TRNs)",
      size: "~12 KB",
      blurb: "Layla's headline source — active VAT registrations + segments.",
    },
  ],
  risk: [
    {
      filename: "Open data 2025 full year - final.xlsx",
      label: "FTA Open Data — 2025 full year",
      size: "~15 KB",
      blurb: "Default · feeds Hamad's risk register.",
      preview: {
        period: { start: "2025-01-01", end: "2025-12-31" },
        sections: [
          {
            label: "CT non-filers · by AED outstanding",
            rows: 312,
            summary: "Corporate Tax cases past due — ranked by exposure",
            columns: ["TRN", "Name", "Segment", "Days late", "AED outstanding"],
            sample_rows: [
              R(["…700003", "Al Futtaim Trading LLC", "Large", "147", "AED 18.9M"], "Top single risk"),
              R(["…612200", "Gulf Energy Holdings", "Large", "94", "AED 9.4M"], "Large + >90d"),
              R(["…612201", "Gulf Energy Subsidiary", "Large", "94", "AED 7.1M"], "Large + >90d"),
              R(["…558800", "ADNOC Distribution PJSC", "Large", "42", "AED 4.8M"]),
              R(["…776655", "Al Tayer Insignia", "Large", "31", "AED 3.2M"]),
              R(["…331199", "Marina Logistics Co.", "Medium", "61", "AED 2.1M"]),
              R(["…118822", "Borouge PLC", "Large", "22", "AED 1.9M"]),
              R(["…339911", "Yas Holdings LLC", "Medium", "118", "AED 1.6M"], "Medium + >90d"),
              R(["…990011", "Dubai Holding Investments", "Large", "8", "AED 1.4M"]),
              R(["…447782", "Tobacco Distributors LLC", "Medium", "55", "AED 0.9M"]),
              R(["…994412", "Al Wahda Trading", "Small", "210", "AED 0.6M"], "Stale >180d"),
              R(["…992210", "Carbonated Bottling Co.", "Medium", "44", "AED 0.5M"]),
            ],
          },
          {
            label: "Reconsideration volume · quarterly",
            rows: 119,
            summary: "taxpayer disputes — trend up means service or assessment friction",
            columns: ["Tax", "Q1", "Q2", "Q3", "Q4", "Trend"],
            sample_rows: [
              R(["VAT — refund denial", "22", "18", "31", "27", "+23% YoY"], "Upward trend"),
              R(["CT — assessment notice", "4", "7", "5", "5", "+5% YoY"]),
              R(["Excise — refund denial", "9", "12", "8", "10", "+1% YoY"]),
              R(["VAT — registration", "3", "4", "3", "5", "flat"]),
              R(["VAT — penalty", "8", "11", "14", "16", "+58% YoY"], "Sharp upward trend"),
              R(["CT — transfer pricing", "1", "2", "4", "6", "+200% YoY"], "Emerging risk"),
              R(["Excise — registration", "2", "1", "2", "1", "flat"]),
              R(["VAT — group de-registration", "5", "6", "4", "5", "flat"]),
            ],
          },
          {
            label: "Duplicate-pair refund-fraud risk",
            rows: 24,
            summary: "soft-duplicates from registry — every pair flagged",
            columns: ["TRN A", "TRN B", "Similarity", "Linked refunds"],
            sample_rows: [
              R(["…700003", "…700013", "94%", "AED 412K"], "Linked refunds"),
              R(["…665432100005", "…665432100013", "96%", "AED 28K"], "Same legal-name root"),
              R(["…665432100005", "…665432100025", "92%", "AED 0"], "Same legal-name root"),
              R(["…339911200007", "…339911200099", "98%", "AED 184K"], "Branch pattern"),
              R(["…776655400001", "…776655400099", "97%", "AED 0"], "Branch pattern"),
              R(["…118822700001", "…118822700199", "95%", "AED 56K"], "Office sub-entity"),
              R(["…558800100004", "…558800200004", "91%", "AED 0"], "Sequential TRN"),
            ],
          },
          {
            label: "Operational + HCR signals",
            rows: 14,
            summary: "institutional and human-capital risks (P2-6, P2-7)",
            columns: ["Risk", "Owner", "BCP tested", "Last review"],
            sample_rows: [
              R(["EmaraTax outage > 4h", "IT", "Yes", "2025-08"]),
              R(["Senior analyst turnover", "HR", "—", "2025-06"], "No owner assigned"),
              R(["Skills gap · risk modelling", "—", "—", "2024-11"], "No owner · stale"),
              R(["Data-classification audit", "Compliance", "—", "2025-09"]),
              R(["Vendor concentration · Azure", "IT", "Yes", "2025-04"]),
              R(["Succession · Head of Risk", "—", "—", "2024-08"], "No owner · stale"),
            ],
          },
        ],
        headlines: [
          { label: "Risks flagged", value: "8" },
          { label: "AED at risk", value: "92.5M" },
          { label: "Top single risk", value: "18.9M" },
          { label: "Owners unset", value: "2" },
        ],
      },
    },
    {
      filename: "Reconsideration Request approved by the FTA.xlsx",
      label: "Reconsideration requests",
      size: "~16 KB",
      blurb: "Re-opens by taxpayer — signal of compliance friction.",
    },
  ],
  service: [
    {
      filename: "Open data 2025 full year - final.xlsx",
      label: "FTA Open Data — 2025 full year",
      size: "~15 KB",
      blurb: "Default · inquiry + complaint volumes.",
      preview: {
        period: { start: "2025-01-01", end: "2025-12-31" },
        sections: [
          {
            label: "Inquiries by channel · monthly",
            rows: 459_182,
            summary: "annual volume + wait time per channel (P50 / P95)",
            columns: ["Channel", "Month", "Volume", "P50 wait", "P95 wait", "Abandoned"],
            sample_rows: [
              R(["EmaraTax portal", "Jan", "21,118", "1.1 min", "4.6 min", "0.4%"]),
              R(["EmaraTax portal", "Jun", "24,840", "1.3 min", "5.1 min", "0.6%"]),
              R(["EmaraTax portal", "Dec", "27,602", "1.5 min", "6.8 min", "0.9%"]),
              R(["Phone", "Jan", "7,810", "6.8 min", "22.4 min", "8.1%"]),
              R(["Phone", "Mar", "8,418", "7.1 min", "24.9 min", "9.4%"]),
              R(["Phone", "Jun", "8,920", "7.6 min", "26.8 min", "11.2%"], "P50 > 6 min · drops P3-9 to C"),
              R(["Phone", "Sep", "9,114", "8.1 min", "28.5 min", "12.0%"], "P50 > 6 min · drops P3-9 to C"),
              R(["Phone", "Dec", "9,442", "8.8 min", "31.0 min", "13.6%"], "P50 > 6 min · drops P3-9 to C"),
              R(["Email", "Jan", "5,224", "—", "21d", "—"]),
              R(["Email", "Jun", "6,818", "—", "28d", "—"], "P95 > SLA · 21 days"),
              R(["Walk-in (Tasheel)", "All year", "8,420", "11 min", "38 min", "2.1%"]),
              R(["Chat (in-app)", "All year", "21,720", "0.8 min", "3.2 min", "0.2%"]),
            ],
          },
          {
            label: "Complaint cases",
            rows: 612,
            summary: "complaint cases · days to close + open backlog",
            columns: ["Case", "Channel", "Subject", "Days to close", "Status"],
            sample_rows: [
              R(["CMP-2025-0419", "Walk-in", "Refund delay", "9", "Closed"]),
              R(["CMP-2025-0511", "Phone", "Penalty assessment", "21", "Closed"]),
              R(["CMP-2025-0617", "Email", "Registration error", "38", "Open"], "Open >30 days"),
              R(["CMP-2025-0701", "Phone", "Refund denial", "44", "Open"], "Open >30 days"),
              R(["CMP-2025-0884", "Email", "Excise classification", "52", "Open"], "Open >30 days · escalated"),
              R(["CMP-2025-0102", "Walk-in", "TRN suspension", "5", "Closed"]),
              R(["CMP-2025-0928", "Phone", "VAT return rejected", "12", "Closed"]),
              R(["CMP-2025-1011", "Email", "Tax agent fees", "1", "Open"], "New · pending triage"),
              R(["CMP-2025-1042", "Phone", "Penalty waiver request", "67", "Open"], "Open >60 days · escalated"),
              R(["CMP-2025-1198", "Email", "Refund denial", "33", "Open"], "Open >30 days"),
            ],
          },
          {
            label: "Info products · refresh currency",
            rows: 47,
            summary: "TADAT P3-8-2 — currency · drops band if any major product is stale",
            columns: ["Product", "Tax", "Last refresh", "Days since"],
            sample_rows: [
              R(["VAT registration guide", "VAT", "2025-09-12", "60"]),
              R(["CT filing FAQ", "CT", "2025-03-18", "238"], "Stale >180 days"),
              R(["Excise classification guide", "Excise", "2024-11-04", "372"], "Stale >365 days"),
              R(["Refund process video", "VAT", "2025-02-20", "264"], "Stale >180 days"),
              R(["EmaraTax onboarding", "All", "2025-10-01", "42"]),
              R(["Penalty calculation guide", "All", "2025-08-15", "88"]),
              R(["Tax agent registration", "All", "2024-09-20", "418"], "Stale >365 days"),
              R(["VAT group registration", "VAT", "2025-06-10", "154"]),
              R(["CT transitional rules", "CT", "2024-05-30", "531"], "Stale >365 days · major legislative change"),
            ],
          },
          {
            label: "Cooperative-compliance arrangements",
            rows: 0,
            summary: "P3-12 — no formal CCAs in place yet (caps the POA at C)",
            columns: ["Large taxpayer", "CCA signed", "Refresh frequency"],
            sample_rows: [
              R(["—", "—", "—"], "No CCAs in market — full evidence gap"),
            ],
          },
        ],
        headlines: [
          { label: "Inquiries", value: "459K" },
          { label: "P50 phone wait", value: "7.4 min" },
          { label: "Open complaints >30d", value: "47" },
          { label: "Stale info products", value: "11" },
        ],
      },
    },
    {
      filename: "Total of Inquiry Request approved by FTA .xlsx",
      label: "Inquiry requests · approved",
      size: "~11 KB",
      blurb: "Maya's primary input — inquiry volumes by year.",
    },
    {
      filename: "Submit Complaints-META.xlsx",
      label: "Complaints register",
      size: "~16 KB",
      blurb: "Complaint cases with resolution time.",
    },
  ],
  filing: [
    {
      filename: "Open data 2025 full year - final.xlsx",
      label: "FTA Open Data — 2025 full year",
      size: "~15 KB",
      blurb: "Default · feeds Karim's filing rates.",
      preview: {
        period: { start: "2025-01-01", end: "2025-12-31" },
        sections: [
          {
            label: "On-time filing · VAT monthly",
            rows: 12_240,
            summary: "monthly expected vs filed-on-time, by core tax",
            columns: ["Month", "Expected", "On-time", "Rate", "Large-segment"],
            sample_rows: [
              R(["Jan 2025", "1,020", "898", "88.0%", "92.4%"]),
              R(["Feb 2025", "1,020", "865", "84.8%", "89.1%"], "Below 85%"),
              R(["Mar 2025", "1,020", "891", "87.4%", "91.2%"]),
              R(["Apr 2025", "1,020", "904", "88.6%", "92.0%"]),
              R(["May 2025", "1,020", "881", "86.4%", "90.4%"]),
              R(["Jun 2025", "1,020", "858", "84.1%", "88.0%"], "Below 85%"),
              R(["Jul 2025", "1,020", "899", "88.1%", "91.7%"]),
              R(["Aug 2025", "1,020", "830", "81.4%", "86.2%"], "Below 85% by both segments"),
              R(["Sep 2025", "1,020", "890", "87.2%", "91.0%"]),
              R(["Oct 2025", "1,020", "905", "88.7%", "92.4%"]),
              R(["Nov 2025", "1,020", "841", "82.5%", "87.1%"], "Below 85%"),
              R(["Dec 2025", "1,020", "812", "79.6%", "84.4%"], "Below 85% · drops P4-13 band"),
            ],
          },
          {
            label: "On-time filing · CT + Excise",
            rows: 1_368,
            summary: "Corporate Tax and Excise · annual",
            columns: ["Tax", "Period", "Expected", "On-time", "Rate"],
            sample_rows: [
              R(["CT", "2025 FY", "856", "646", "75.4%"], "14.6pp from TADAT-A"),
              R(["CT", "Large-segment", "412", "362", "87.9%"]),
              R(["CT", "Medium-segment", "289", "187", "64.7%"], "Below 70%"),
              R(["CT", "Small-segment", "155", "97", "62.6%"], "Below 70%"),
              R(["Excise", "2025 monthly", "312", "290", "93.0%"]),
              R(["Excise", "Tobacco", "84", "82", "97.6%"]),
              R(["Excise", "Carbonated drinks", "108", "98", "90.7%"]),
              R(["Excise", "Energy drinks", "60", "52", "86.7%"], "Below 90%"),
            ],
          },
          {
            label: "Non-filer worklist · top by AED outstanding",
            rows: 300,
            summary: "every row here is past due — Karim's enforcement queue",
            columns: ["TRN", "Name", "Tax", "Days late", "AED outstanding"],
            sample_rows: [
              R(["…700003", "Al Futtaim Trading LLC", "CT", "147", "AED 18.9M"], "Top single non-filer"),
              R(["…612200", "Gulf Energy Holdings", "CT", "94", "AED 9.4M"], "Large + >90d"),
              R(["…612201", "Gulf Energy Subsidiary", "CT", "94", "AED 7.1M"], "Large + >90d"),
              R(["…558800", "ADNOC Distribution PJSC", "CT", "42", "AED 4.8M"], "Past due"),
              R(["…776655", "Al Tayer Insignia", "CT", "31", "AED 3.2M"], "Past due"),
              R(["…331199", "Marina Logistics Co.", "VAT", "61", "AED 2.1M"], "Past due"),
              R(["…118822", "Borouge PLC", "CT", "22", "AED 1.9M"], "Past due"),
              R(["…339911", "Yas Holdings LLC", "CT", "118", "AED 1.6M"], ">90d"),
              R(["…990011", "Dubai Holding Investments", "CT", "8", "AED 1.4M"], "Past due"),
              R(["…447782", "Tobacco Distributors LLC", "Excise", "55", "AED 0.9M"], "Past due"),
              R(["…994412", "Al Wahda Trading", "VAT", "210", "AED 0.6M"], "Stale >180d"),
              R(["…992210", "Carbonated Bottling Co.", "Excise", "44", "AED 0.5M"], "Past due"),
            ],
          },
          {
            label: "e-Filing adoption",
            rows: 14_876,
            summary: "P4-15 · share of declarations filed electronically",
            columns: ["Tax", "Period", "e-filed", "Manual", "Adoption"],
            sample_rows: [
              R(["VAT", "2025", "14,124", "184", "98.7%"]),
              R(["CT", "2025", "832", "24", "97.2%"]),
              R(["Excise", "2025", "295", "17", "94.6%"]),
            ],
          },
        ],
        headlines: [
          { label: "VAT on-time", value: "87.2%" },
          { label: "CT on-time", value: "75.4%" },
          { label: "Non-filers", value: "300" },
          { label: "Recoverable", value: "AED 92.5M" },
        ],
      },
    },
    {
      filename: "VAT 2023.xlsx",
      label: "VAT 2023 declarations",
      size: "~33 KB",
      blurb: "YoY benchmark for Karim's on-time rate.",
    },
  ],
  payments: [
    {
      filename: "Open data 2025 full year - final.xlsx",
      label: "FTA Open Data — 2025 full year",
      size: "~15 KB",
      blurb: "Default · feeds Salma's arrears + e-payment view.",
      preview: {
        period: { start: "2025-01-01", end: "2025-12-31" },
        sections: [
          {
            label: "VAT payments · timeliness by month",
            rows: 11_982,
            summary: "P5-18 · on-time by number AND by value (both ≥85% for B)",
            columns: ["Month", "On-time (#)", "On-time (value)", "Late >30d"],
            sample_rows: [
              R(["Jan 2025", "89.2%", "87.8%", "84"]),
              R(["Feb 2025", "86.4%", "88.1%", "112"]),
              R(["Mar 2025", "87.9%", "88.3%", "104"]),
              R(["Apr 2025", "88.0%", "89.4%", "98"]),
              R(["May 2025", "87.1%", "87.0%", "118"]),
              R(["Jun 2025", "84.6%", "85.2%", "164"], "Below 85% by # · drops P5-18-1 to C"),
              R(["Jul 2025", "88.4%", "89.0%", "96"]),
              R(["Aug 2025", "85.2%", "85.0%", "144"]),
              R(["Sep 2025", "84.0%", "84.8%", "172"], "Below 85% by both"),
              R(["Oct 2025", "88.8%", "89.6%", "88"]),
              R(["Nov 2025", "87.6%", "88.0%", "108"]),
              R(["Dec 2025", "83.2%", "82.6%", "204"], "Below 85% by both · drops band"),
            ],
          },
          {
            label: "Arrears stock by age",
            rows: 1_840,
            summary: "P5-19-2 · old-arrears share (>365d should be ≤25% of stock)",
            columns: ["Age bucket", "Cases", "AED outstanding", "Collectible"],
            sample_rows: [
              R(["0-30 days", "612", "AED 38.4M", "94%"]),
              R(["31-90 days", "488", "AED 52.1M", "82%"]),
              R(["91-180 days", "260", "AED 18.4M", "64%"]),
              R(["181-365 days", "162", "AED 7.5M", "52%"]),
              R(["366-730 days", "208", "AED 41.2M", "38%"], "Old arrears · low collectibility"),
              R([">730 days", "110", "AED 37.4M", "12%"], "Old arrears · write-off candidate"),
            ],
          },
          {
            label: "Top high-risk debtors",
            rows: 25,
            summary: "every row here is in Salma's pursue/payment-plan/write-off queue",
            columns: ["TRN", "Name", "Tax", "Age", "AED", "Decision"],
            sample_rows: [
              R(["…700003", "Al Futtaim Trading LLC", "VAT", ">730d", "AED 4.2M", "Pursue · collectible"], "Top debtor · pursue"),
              R(["…612200", "Gulf Energy Holdings", "CT", "91-365", "AED 3.1M", "Payment plan"], "Pursue · plan"),
              R(["…612201", "Gulf Energy Subsidiary", "CT", "91-365", "AED 2.7M", "Payment plan"], "Pursue · plan"),
              R(["…331199", "Marina Logistics Co.", "VAT", "91-365", "AED 1.8M", "Pursue"], "Pursue"),
              R(["…558800", "ADNOC Distribution PJSC", "VAT", "31-90", "AED 1.4M", "Pursue · collectible"]),
              R(["…776655", "Al Tayer Insignia", "VAT", "31-90", "AED 1.1M", "Pursue · collectible"]),
              R(["…118822", "Borouge PLC", "CT", "31-90", "AED 0.9M", "Pursue · collectible"]),
              R(["…339911", "Yas Holdings LLC", "CT", "366-730", "AED 0.7M", "Pursue · old"], "Old + low collectibility"),
              R(["…447782", "Tobacco Distributors LLC", "Excise", ">730d", "AED 0.6M", "Write-off candidate"], "Write-off"),
              R(["…994412", "Al Wahda Trading", "VAT", ">730d", "AED 0.4M", "Write-off candidate"], "Write-off"),
            ],
          },
          {
            label: "e-Payment adoption",
            rows: 13_822,
            summary: "P5-16 · share of payments made electronically",
            columns: ["Channel", "Count", "AED collected", "Share"],
            sample_rows: [
              R(["EmaraTax e-payment", "10,781", "AED 81.4B", "78.0%"]),
              R(["Bank transfer (manual)", "2,288", "AED 19.6B", "16.6%"]),
              R(["Cheque", "753", "AED 4.2B", "5.4%"]),
            ],
          },
        ],
        headlines: [
          { label: "VAT on-time pay", value: "88.0%" },
          { label: "Arrears stock", value: "AED 195M" },
          { label: "E-payment", value: "78.0%" },
          { label: "Old arrears", value: "31.4%" },
        ],
      },
    },
    {
      filename: "Tax Refund Approved for UAE Nationals Building New Residences.xlsx",
      label: "Refund volumes — homebuilders",
      size: "~18 KB",
      blurb: "Refund-side signal for collection efficiency.",
    },
  ],
};

function defaultSampleFor(id: AgentId): PickedFile | null {
  const list = DEPT_SAMPLES[id];
  if (!list || list.length === 0) return null;
  const s = list[0];
  return { name: s.filename, size: s.size, source: "sample" };
}

function DepartmentSource({
  stage,
  picked,
  onPick,
  onUploadedParsed,
  onParsingChange,
  disabled,
}: {
  stage: SampleStage;
  picked: PickedFile | null;
  onPick: (p: PickedFile | null) => void;
  onUploadedParsed?: (parsed: DeptSamplePreview | null) => void;
  onParsingChange?: (parsing: boolean) => void;
  disabled?: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const samples = DEPT_SAMPLES[stage.id] ?? [];

  async function pickDroppedFile(f: File) {
    onPick({ name: f.name, size: humanBytes(f.size), source: "drop" });
    if (!onUploadedParsed) return;
    onParsingChange?.(true);
    try {
      const body = new FormData();
      body.set("file", f);
      const r = await fetch("/api/upload/parse", { method: "POST", body });
      const j = (await r.json()) as {
        success: boolean;
        parsed?: import("@/lib/upload/parse-fta-excel").ParsedFile;
        error?: string;
      };
      if (j.success && j.parsed) {
        onUploadedParsed(convertParsedToDeptPreview(j.parsed));
      } else {
        onUploadedParsed(null);
      }
    } catch {
      onUploadedParsed(null);
    } finally {
      onParsingChange?.(false);
    }
  }

  return (
    <section className="glass-panel p-4 md:p-5">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv,.json,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          void pickDroppedFile(f);
        }}
      />
      <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4 items-stretch">
        {/* Left — drop zone / current file */}
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-400 mb-2">
            Source · for this department
          </p>
          {!picked ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
              className="w-full flex items-center gap-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-white/15 bg-gray-50/50 dark:bg-white/[0.02] hover:border-violet-400/60 dark:hover:border-violet-400/60 px-4 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 transition"
            >
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-500 flex items-center justify-center shadow-md shadow-violet-500/30 shrink-0">
                <Upload className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-gray-900 dark:text-white">
                  Drop Excel / CSV / JSON
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400">
                  or pick a sample on the right
                </div>
              </div>
            </button>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-500/10 px-4 py-3">
              <div className="h-9 w-9 rounded-lg bg-white dark:bg-white/10 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center shrink-0">
                {picked.source === "sample" ? (
                  <FileSpreadsheet className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                ) : (
                  <FileJson className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-bold text-gray-900 dark:text-white truncate">
                  {picked.name}
                </div>
                <div className="text-[10.5px] text-gray-500 dark:text-gray-400 font-mono">
                  {picked.size} · {picked.source === "sample" ? "sample" : "uploaded"}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={disabled}
                  className="text-[10.5px] font-mono text-indigo-600 dark:text-indigo-300 hover:underline px-2 py-1"
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={() => onPick(null)}
                  disabled={disabled}
                  className="inline-flex items-center justify-center h-7 w-7 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10"
                  aria-label="Clear file"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right — sample picker */}
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-400 mb-2">
            Packaged samples · {samples.length}
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            {samples.map((s) => {
              const isActive = picked?.name === s.filename;
              return (
                <button
                  key={s.filename}
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    onPick({
                      name: s.filename,
                      size: s.size,
                      source: "sample",
                    })
                  }
                  className={`text-left rounded-lg border px-3 py-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 ${
                    isActive
                      ? "border-indigo-400 dark:border-indigo-500/60 bg-indigo-50 dark:bg-indigo-500/15"
                      : "border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] hover:border-violet-400/40"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[12px] font-bold text-gray-900 dark:text-white truncate flex-1">
                      {s.label}
                    </span>
                    <span className="font-mono text-[9px] text-gray-400 dark:text-gray-500 shrink-0">
                      {s.size}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-gray-600 dark:text-gray-400 leading-snug line-clamp-2">
                    {s.blurb}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── SamplePreviewPanel ─ shows actual rows + headlines from the picked file

function SamplePreviewPanel({
  stage,
  picked,
  uploadedPreview,
  parsingUpload,
}: {
  stage: SampleStage;
  picked: PickedFile;
  uploadedPreview?: DeptSamplePreview | null;
  parsingUpload?: boolean;
}) {
  const samples = DEPT_SAMPLES[stage.id] ?? [];
  const sample =
    picked.source === "sample"
      ? samples.find((s) => s.filename === picked.name) ?? null
      : null;
  // Prefer the actual parsed payload for uploaded files; fall back to the
  // hardcoded sample preview for packaged samples.
  const preview =
    picked.source === "drop" ? uploadedPreview ?? null : sample?.preview ?? null;

  if (parsingUpload && picked.source === "drop") {
    return (
      <section className="glass-panel p-4 md:p-5">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-400 mb-2">
          Dataset preview · parsing your file
        </p>
        <p className="text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Parsing <strong className="px-1">{picked.name}</strong> — sheets,
          rows, and red-flag heuristics…
        </p>
      </section>
    );
  }

  // Uploaded file but parser returned nothing — graceful empty state.
  if (!preview) {
    return (
      <section className="glass-panel p-4 md:p-5">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-400 mb-2">
          Dataset preview · before running
        </p>
        <p className="text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed">
          <strong>{picked.name}</strong> queued. The agent will read it when
          you click Run. Pick a packaged sample on the right if you want to
          see the canonical preview first.
        </p>
      </section>
    );
  }

  return (
    <section className="glass-panel overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200 dark:border-white/5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-400">
            Dataset · what {PERSONAS[stage.id].name} reads
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 text-[9.5px] font-mono uppercase tracking-wider text-red-700 dark:text-red-300">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 dark:bg-red-400" />
            Red rows = flagged by {PERSONAS[stage.id].name}
          </span>
        </div>
        <p className="text-[10.5px] font-mono text-gray-500 dark:text-gray-400">
          {picked.name}
          {preview.period &&
            ` · ${preview.period.start} → ${preview.period.end}`}
        </p>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-0">
        {/* Sections — click to peek */}
        <div className="p-5 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-white/5">
          <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2.5">
            Sections in file · click any row to see sample rows
          </p>
          <ul className="space-y-1.5">
            {preview.sections.map((s) => (
              <PreviewSectionRow key={s.label} section={s} />
            ))}
          </ul>
        </div>

        {/* Headline figures */}
        <div className="p-5">
          <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2.5">
            Headlines · what {PERSONAS[stage.id].name} will see
          </p>
          <div className="grid grid-cols-2 gap-2">
            {preview.headlines.map((h) => (
              <div
                key={h.label}
                className="rounded-lg border border-gray-200 dark:border-white/10 bg-gradient-to-br from-gray-50 to-white dark:from-white/[0.04] dark:to-white/[0.01] px-3 py-2"
              >
                <div className="text-[9px] font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400 leading-tight">
                  {h.label}
                </div>
                <div className="mt-1 font-mono text-[14px] font-bold tabular-nums text-gray-900 dark:text-white leading-tight">
                  {h.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviewSectionRow({
  section,
}: {
  section: DeptSamplePreview["sections"][number];
}) {
  const [open, setOpen] = React.useState(false);
  // Derive from the sample we render — never hardcoded.
  const flaggedInSample = section.sample_rows.filter((r) => r.flag).length;
  const sampleSize = section.sample_rows.length;
  return (
    <li className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start justify-between gap-3 px-3 py-2 text-left hover:bg-gray-100/60 dark:hover:bg-white/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-semibold text-gray-900 dark:text-white truncate">
            {section.label}
          </div>
          <div className="text-[10.5px] text-gray-500 dark:text-gray-400 truncate">
            {section.summary}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {flaggedInSample > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 text-[9.5px] font-mono uppercase tracking-wider text-red-700 dark:text-red-300"
              title={`${flaggedInSample} of the ${sampleSize} rows shown are flagged`}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 dark:bg-red-400" />
              {flaggedInSample}/{sampleSize} flagged
            </span>
          )}
          <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-300 tabular-nums">
            {section.rows.toLocaleString()} rows
          </span>
          <span
            className={`text-gray-400 transition-transform inline-block ${
              open ? "rotate-180" : ""
            }`}
            aria-hidden
          >
            ▾
          </span>
        </div>
      </button>
      {open && (
        <div className="border-t border-gray-200 dark:border-white/5 max-h-[480px] overflow-auto">
          <table className="w-full text-[11px]">
            <thead className="bg-gray-100/60 dark:bg-black/30 sticky top-0 z-10">
              <tr>
                <th className="w-1 px-2 py-1.5" aria-hidden />
                {section.columns.map((c) => (
                  <th
                    key={c}
                    className="px-2.5 py-1.5 text-left font-mono uppercase tracking-wider text-[9px] text-gray-500 dark:text-gray-400 whitespace-nowrap"
                  >
                    {c}
                  </th>
                ))}
                <th className="px-2.5 py-1.5 text-left font-mono uppercase tracking-wider text-[9px] text-red-500 dark:text-red-400 whitespace-nowrap">
                  Flag
                </th>
              </tr>
            </thead>
            <tbody>
              {section.sample_rows.map((row, ri) => {
                const flagged = Boolean(row.flag);
                return (
                  <tr
                    key={ri}
                    className={`border-t border-gray-200 dark:border-white/5 ${
                      flagged
                        ? "bg-red-50/70 dark:bg-red-500/[0.08] hover:bg-red-50 dark:hover:bg-red-500/10"
                        : "hover:bg-gray-100/30 dark:hover:bg-white/[0.04]"
                    }`}
                    title={row.flag ?? ""}
                  >
                    <td
                      className={`w-1 ${
                        flagged
                          ? "bg-red-500 dark:bg-red-400"
                          : "bg-transparent"
                      }`}
                      aria-hidden
                    />
                    {row.cells.map((cell, ci) => (
                      <td
                        key={ci}
                        className={`px-2.5 py-1.5 font-mono tabular-nums whitespace-nowrap ${
                          flagged
                            ? "text-red-900 dark:text-red-200 font-medium"
                            : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {String(cell)}
                      </td>
                    ))}
                    <td className="px-2.5 py-1.5 whitespace-nowrap">
                      {flagged && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-red-700 dark:text-red-300">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 dark:bg-red-400" />
                          {row.flag}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="px-2.5 py-1.5 text-[9.5px] text-gray-500 dark:text-gray-400 italic bg-gray-100/40 dark:bg-black/20 border-t border-gray-200 dark:border-white/5">
            Showing {sampleSize} of {section.rows.toLocaleString()} rows
            {flaggedInSample > 0 &&
              ` · ${flaggedInSample} flagged in this sample`}
            .
          </p>
        </div>
      )}
    </li>
  );
}

function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Convert a server-parsed `ParsedFile` into the `DeptSamplePreview` shape
 * the SamplePreviewPanel renders, applying lightweight heuristic flags
 * so suspicious rows highlight in red just like packaged-sample rows.
 *
 * Heuristics (intentionally generic — no schema knowledge required):
 *   • Row contains any null / empty / "—" / "missing" cell → "Missing field"
 *   • Row contains the strings "Suspended" / "Deregistered" / "Dormant" → "Status flagged"
 *   • Row contains a negative number → "Negative value"
 *   • Row contains a 4-digit year > current year → "Future date"
 *   • Duplicate first-cell value (TRN / ID style) → "Soft duplicate"
 */
function convertParsedToDeptPreview(
  parsed: import("@/lib/upload/parse-fta-excel").ParsedFile,
): DeptSamplePreview {
  const currentYear = new Date().getFullYear();
  const sections = parsed.sections.map((s) => {
    // Track first-cell occurrences within a section for duplicate detection
    const firstCellCount = new Map<string, number>();
    for (const row of s.sample_rows) {
      const k = String(row[0] ?? "");
      firstCellCount.set(k, (firstCellCount.get(k) ?? 0) + 1);
    }
    const rows: SampleDataRow[] = s.sample_rows.map((row) => {
      const flag = detectRowFlag(row, firstCellCount, currentYear);
      return flag ? { cells: row, flag } : { cells: row };
    });
    return {
      label: s.label,
      rows: s.rows,
      summary: s.summary,
      columns: s.columns,
      sample_rows: rows,
    };
  });
  return {
    period: parsed.period,
    sections,
    headlines: parsed.headlines,
  };
}

function detectRowFlag(
  row: Array<string | number>,
  firstCellCount: Map<string, number>,
  currentYear: number,
): string | undefined {
  // Missing / empty
  for (const cell of row) {
    if (cell === null || cell === undefined) return "Missing field";
    const s = String(cell).trim().toLowerCase();
    if (s === "" || s === "—" || s === "-" || s === "n/a" || s === "null" || s === "missing") {
      return "Missing field";
    }
  }
  // Duplicate first cell (e.g. duplicate TRN)
  const first = String(row[0] ?? "");
  if (first && (firstCellCount.get(first) ?? 0) > 1) return "Soft duplicate";
  // Status flags
  for (const cell of row) {
    const s = String(cell);
    if (/suspended|deregistered|dormant|inactive|failed/i.test(s)) {
      return "Status flagged";
    }
  }
  // Negative numbers
  for (const cell of row) {
    if (typeof cell === "number" && cell < 0) return "Negative value";
  }
  // Future year
  for (const cell of row) {
    const m = String(cell).match(/(19|20)\d{2}/);
    if (m && Number(m[0]) > currentYear) return "Future date";
  }
  return undefined;
}

function fmtAed(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `AED ${(n / 1_000).toFixed(0)}K`;
  return `AED ${n}`;
}
function mask(trn: string): string {
  if (trn.length <= 6) return trn;
  return `…${trn.slice(-6)}`;
}
function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}
