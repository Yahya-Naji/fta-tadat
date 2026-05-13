"use client";

/**
 * AgentDetailView — full assessment surface for the four agents that
 * don't have a custom view (Layla, Hamad, Maya, Salma). Karim still uses
 * the bespoke KarimView.
 *
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │ Top bar — Home · QTaskWordmark · ThemeToggle                 │
 *   ├──────────────────────────────────────────────────────────────┤
 *   │ Banner — gradient header with persona + POA chip + score     │
 *   │ Business outcome (large body copy)                           │
 *   │ KPI strip (3 sparks)                                         │
 *   ├──────────────────────────────────────────────────────────────┤
 *   │ Indicators — accordion with dim breakdown                     │
 *   ├──────────────────────────────────────────────────────────────┤
 *   │ Recommendations · pre-aggregate inputs · raw response         │
 *   └──────────────────────────────────────────────────────────────┘
 */
import * as React from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronDown,
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ExternalLink,
  Database,
} from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { QTaskWordmark } from "@/components/QTaskLogo";
import { ScoreBadge } from "@/components/ScoreBadge";
import type { SampleStage } from "@/lib/fixtures/sample-run";

// ─── Live-run shapes ─────────────────────────────────────────────────────

interface LiveDimension {
  dim_id: string;
  dim_name: string;
  dim_kind: "quantitative" | "qualitative" | "mixed";
  score: string;
  finding: string;
  detail: string;
  evidence?: string[];
  value?: number | null;
  value_label?: string | null;
  tadat_reference: string;
}

interface LiveIndicator {
  id?: string;
  code?: string;
  name: string;
  score: string;
  finding?: string;
  detail?: string;
  evidence?: string[];
  scoring_method?: "M1" | "M2";
  tadat_reference?: string;
  dimension_scores?: LiveDimension[];
  value?: number | null;
  value_all?: number | null;
  value_large?: number | null;
  value_label?: string;
}

interface LiveParsed {
  aggregate_score?: string;
  poa_aggregate_score?: string;
  business_outcome?: string;
  indicators?: LiveIndicator[];
  recommendations?: string[];
  not_applicable?: Array<{ id: string; reason: string }>;
  is_tadat_defined?: boolean;
  [k: string]: unknown;
}

interface AgentRunResp {
  success: boolean;
  agent?: string;
  poa?: number;
  duration_ms?: number;
  inputs?: unknown;
  raw_response?: string;
  parsed?: LiveParsed;
  parse_error?: string | null;
  error?: string;
}

// ─── Component ────────────────────────────────────────────────────────────

interface AgentDetailViewProps {
  stage: SampleStage;
}

export function AgentDetailView({ stage }: AgentDetailViewProps) {
  const [run, setRun] = React.useState<AgentRunResp | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [preview, setPreview] = React.useState<unknown>(null);
  const [previewError, setPreviewError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch(`/api/agents/${stage.id}/preview`)
      .then((r) => r.json())
      .then((j) => setPreview(j.inputs ?? j))
      .catch((e) => setPreviewError((e as Error).message));
  }, [stage.id]);

  async function runLive() {
    setLoading(true);
    setRun(null);
    try {
      const r = await fetch(`/api/agents/${stage.id}/run`, { method: "POST" });
      const j = (await r.json()) as AgentRunResp;
      setRun(j);
    } catch (e) {
      setRun({ success: false, error: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  const effectiveScore =
    run?.parsed?.poa_aggregate_score ??
    run?.parsed?.aggregate_score ??
    stage.aggregate_score;
  const effectiveOutcome =
    run?.parsed?.business_outcome ??
    run?.parsed?.recommendations?.[0] ??
    stage.business_outcome;
  const liveIndicators = run?.parsed?.indicators ?? null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#282C34]">
      <div className="page-accent-bar" />

      {/* Top bar */}
      <header className="border-b border-gray-200/60 bg-white/80 backdrop-blur dark:border-white/5 dark:bg-[#1e2128]/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Home
            </Link>
            <QTaskWordmark />
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 md:px-6 py-8">
        {/* Hero / banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-8 md:p-10 shadow-2xl shadow-indigo-500/20 animate-fade-up">
          <div className="absolute -left-16 -top-16 h-56 w-56 rounded-full bg-white/5" />
          <div className="absolute -right-20 -bottom-20 h-64 w-64 rounded-full bg-white/5" />
          <div className="relative">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="flex items-start gap-4 min-w-0 flex-1">
                <PersonaCircle gradient={stage.gradient} initial={stage.persona[0]} />
                <div className="min-w-0">
                  <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/65 mb-1">
                    POA {stage.poa} · {stage.poa_name}
                  </p>
                  <h1 className="text-3xl md:text-[40px] font-bold tracking-tight text-white leading-tight">
                    {stage.step_label}
                  </h1>
                  <p className="mt-1 text-sm text-white/80">
                    <span className="font-semibold text-white">{stage.persona}</span>
                    <span className="text-white/65"> · {stage.persona_role}</span>
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-3 shrink-0">
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
                {!run && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 backdrop-blur px-2.5 py-1 text-[11px] text-white/85">
                    <Database className="h-3 w-3" />
                    Sample
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-white/65">
                    Aggregate
                  </span>
                  <ScoreBadge score={effectiveScore} />
                </div>
                <button
                  onClick={runLive}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-bold text-indigo-700 hover:opacity-90 transition disabled:opacity-60 disabled:cursor-wait"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Scoring…
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      {run ? "Re-run agent" : "Run live"}
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Business outcome */}
            <div className="mt-6 pt-6 border-t border-white/15">
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/60 mb-2">
                Business outcome
              </p>
              <p className="text-base md:text-lg leading-relaxed text-white/90 max-w-3xl">
                {effectiveOutcome}
              </p>
            </div>

            {/* KPI strip */}
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

        {/* Indicators */}
        <section className="mt-6 animate-fade-up-delay-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              TADAT indicators
            </h2>
            <span className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
              {liveIndicators?.length ?? stage.indicators.length} indicators
            </span>
          </div>
          <div className="space-y-3">
            {liveIndicators
              ? liveIndicators.map((ind) => (
                  <IndicatorAccordion key={ind.id ?? ind.code} indicator={ind} />
                ))
              : stage.indicators.map((ind) => (
                  <FixtureIndicatorRow key={ind.code} indicator={ind} />
                ))}
          </div>
        </section>

        {/* Recommendations */}
        {run?.parsed?.recommendations && run.parsed.recommendations.length > 0 && (
          <section className="mt-6 glass-panel p-5 animate-fade-up-delay-2">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-400">
                Recommendations
              </h3>
            </div>
            <ul className="space-y-2">
              {run.parsed.recommendations.map((r, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-sm text-gray-700 dark:text-gray-300 leading-relaxed"
                >
                  <span className="text-indigo-500 dark:text-indigo-400 shrink-0">→</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {run?.parsed?.not_applicable && run.parsed.not_applicable.length > 0 && (
          <section className="mt-4 glass-panel p-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400 mb-2">
              Not applicable to UAE
            </h3>
            <ul className="text-[11px] text-gray-600 dark:text-gray-400 space-y-1">
              {run.parsed.not_applicable.map((na) => (
                <li key={na.id}>
                  <span className="font-mono text-gray-700 dark:text-gray-300">{na.id}</span>{" "}
                  — {na.reason}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Pre-aggregate inputs */}
        <CollapsibleSection
          title="Pre-aggregated inputs"
          subtitle="Deterministic SQL roll-up that drives the LLM scoring"
        >
          {previewError && (
            <p className="text-[11px] text-red-500 mb-2">{previewError}</p>
          )}
          {preview ? (
            <pre className="max-h-72 overflow-auto rounded-md bg-gray-50 dark:bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/5">
              {JSON.stringify(preview, null, 2)}
            </pre>
          ) : (
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Loading…</p>
          )}
        </CollapsibleSection>

        {run?.raw_response && (
          <CollapsibleSection
            title="Raw agent response"
            subtitle={
              run.parse_error
                ? `Parse error: ${run.parse_error}`
                : "Verbatim JSON returned by gpt-4o-mini"
            }
          >
            <pre className="max-h-72 overflow-auto rounded-md bg-gray-50 dark:bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/5">
              {run.raw_response}
            </pre>
          </CollapsibleSection>
        )}

        {/* Footer */}
        <footer className="mt-10 pt-6 border-t border-gray-200 dark:border-white/5 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
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
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────

function PersonaCircle({
  gradient,
  initial,
}: {
  gradient: string;
  initial: string;
}) {
  return (
    <div
      className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${gradient} ring-4 ring-white/15 flex items-center justify-center shrink-0`}
    >
      <span className="text-2xl font-bold text-white">{initial}</span>
    </div>
  );
}

function FixtureIndicatorRow({
  indicator,
}: {
  indicator: SampleStage["indicators"][number];
}) {
  return (
    <div className="glass-panel p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
          {indicator.code}
        </span>
        {indicator.scoring_method && (
          <span className="inline-flex items-center rounded-sm bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-gray-600 dark:text-gray-400">
            {indicator.scoring_method}
          </span>
        )}
        <span className="flex-1 text-sm font-semibold text-gray-900 dark:text-white">
          {indicator.name}
        </span>
        <ScoreBadge score={indicator.score} />
      </div>
      {indicator.dimensions && indicator.dimensions.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-white/5 flex flex-wrap gap-2">
          {indicator.dimensions.map((d) => (
            <div
              key={d.id}
              className="inline-flex items-center gap-2 rounded-md bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/5 px-2 py-1"
            >
              <span className="font-mono text-[10px] text-gray-500 dark:text-gray-400">
                {d.id}
              </span>
              <ScoreBadge score={d.score} />
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400">
        Field-guide reference: {indicator.tadat_reference}
      </p>
    </div>
  );
}

function IndicatorAccordion({ indicator }: { indicator: LiveIndicator }) {
  const id = indicator.id ?? indicator.code ?? "—";
  const hasDims =
    indicator.dimension_scores && indicator.dimension_scores.length > 0;
  const [open, setOpen] = React.useState(true);

  return (
    <div className="glass-panel overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex flex-wrap items-center gap-3 px-4 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        {hasDims && (
          <ChevronDown
            className={`h-3.5 w-3.5 text-gray-500 dark:text-gray-400 transition-transform ${
              !open ? "-rotate-90" : ""
            }`}
          />
        )}
        <span className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
          {id}
        </span>
        {indicator.scoring_method && (
          <span className="inline-flex items-center rounded-sm bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-gray-600 dark:text-gray-400">
            {indicator.scoring_method}
          </span>
        )}
        <span className="flex-1 text-sm font-semibold text-gray-900 dark:text-white">
          {indicator.name}
        </span>
        <ScoreBadge score={indicator.score} />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          {!hasDims && (indicator.finding || indicator.detail) && (
            <div className="space-y-2 pt-3 border-t border-gray-200 dark:border-white/5">
              {indicator.finding && (
                <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">
                  {indicator.finding}
                </p>
              )}
              {indicator.detail && (
                <p className="text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed">
                  {indicator.detail}
                </p>
              )}
              {indicator.evidence && indicator.evidence.length > 0 && (
                <ul className="space-y-1 pt-1">
                  {indicator.evidence.map((e, i) => (
                    <li
                      key={i}
                      className="flex gap-2 text-[12px] text-gray-600 dark:text-gray-400"
                    >
                      <span className="text-indigo-500 dark:text-indigo-400 shrink-0">•</span>
                      <span>{e}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {hasDims && (
            <div className="space-y-2 pt-3 border-t border-gray-200 dark:border-white/5">
              {indicator.dimension_scores!.map((d) => (
                <DimRow key={d.dim_id} dim={d} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DimRow({ dim }: { dim: LiveDimension }) {
  const showNumber =
    (dim.dim_kind === "quantitative" || dim.dim_kind === "mixed") &&
    dim.value != null;
  const kindColor =
    dim.dim_kind === "quantitative"
      ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"
      : dim.dim_kind === "qualitative"
        ? "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300"
        : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300";
  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <span className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
          {dim.dim_id}
        </span>
        <span
          className={`rounded-sm px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider ${kindColor}`}
        >
          {dim.dim_kind}
        </span>
        <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white">
          {dim.dim_name}
        </span>
        <ScoreBadge score={dim.score} />
      </div>
      <div className="flex gap-4">
        {showNumber && (
          <div className="shrink-0 rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-2 min-w-[72px] text-center">
            <div className="font-mono text-lg font-bold tabular-nums text-gray-900 dark:text-white">
              {formatDimValue(dim.value!, dim.value_label)}
            </div>
            {dim.value_label && (
              <div className="text-[9px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">
                {dim.value_label}
              </div>
            )}
          </div>
        )}
        <div className="flex-1 space-y-2">
          {dim.finding && (
            <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">
              {dim.finding}
            </p>
          )}
          {dim.detail && (
            <p className="text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed">
              {dim.detail}
            </p>
          )}
          {dim.evidence && dim.evidence.length > 0 && (
            <ul className="space-y-1 pt-1">
              {dim.evidence.map((e, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-[12px] text-gray-600 dark:text-gray-400"
                >
                  <span className="text-indigo-500 dark:text-indigo-400 shrink-0">•</span>
                  <span>{e}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <section className="mt-4 glass-panel">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <div className="text-left">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-400">
            {title}
          </div>
          {subtitle && (
            <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              {subtitle}
            </div>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-gray-500 dark:text-gray-400 transition-transform ${
            !open ? "-rotate-90" : ""
          }`}
        />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}

function formatDimValue(n: number, label?: string | null): string {
  const isPct =
    label?.toLowerCase().includes("%") ||
    label?.toLowerCase().includes("percent") ||
    (n < 100 && n >= 0 && Math.floor(n) !== n);
  if (isPct) return `${n.toFixed(1)}%`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}
