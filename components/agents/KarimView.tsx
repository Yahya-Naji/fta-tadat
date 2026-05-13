"use client";

/**
 * Karim — Filing Compliance Officer (TADAT POA 4)
 *
 * Business-first redesign of /agents/filing.
 * The page is useful pre-run (SQL aggregations only) and *upgrades*
 * when the LLM scores it (band overlays, evidence, recommendations).
 *
 * Six sections: PersonaHeader, HeroStrip, FilingRatesPanel,
 * WorklistPanel + Drawer, EFiling + Management side-by-side,
 * Recommendations, TadatFooter.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Zap,
  Send,
  Download,
  Phone,
  FileText,
  CheckCircle2,
  XCircle,
  Sparkles,
} from "lucide-react";

import { ScoreBadge } from "@/components/ScoreBadge";

// ─── Types ────────────────────────────────────────────────────────────────

interface NonFilerCase {
  declaration_id: string;
  trn: string;
  legal_name_en: string;
  tax_type: string;
  period_label: string;
  due_date: string;
  days_overdue: number;
  tax_due: number;
  industry: string;
  segment: string;
}

interface FilingPreview {
  filing_rates: Record<
    string,
    {
      expected: number;
      on_time: number;
      late: number;
      not_filed: number;
      rate_all_pct: number;
      rate_large_pct: number;
    }
  >;
  e_filing_rate_pct_overall: number;
  e_filing_rate_pct_by_tax: Record<string, number>;
  non_filer_worklist: {
    total_cases: number;
    by_tax_type: Record<string, number>;
    highest_value_aed: number;
    total_aed_outstanding: number;
    sample_cases: NonFilerCase[];
  };
  p4_14_management_practices: {
    predictive_modelling_used: boolean;
    automated_identification: boolean;
    auto_penalties: boolean;
    documented_procedures: boolean;
    follow_up_within_days: number;
    register_routinely_updated: boolean;
  };
  period_assessed: string;
}

interface FilingRun {
  success: boolean;
  parsed?: {
    aggregate_score?: string;
    p4_13_aggregate?: string;
    indicators?: Array<{
      id: string;
      name: string;
      score: string;
      finding: string;
      detail: string;
      evidence?: string[] | null;
      value_all?: number | null;
      value_large?: number | null;
    }>;
    recommendations?: string[];
    not_applicable?: Array<{ id: string; reason: string }>;
  };
  parse_error?: string | null;
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatAed(n: number): string {
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `AED ${(n / 1_000).toFixed(0)}K`;
  return `AED ${n.toFixed(0)}`;
}

function maskTrn(trn: string): string {
  if (!trn || trn.length < 4) return trn;
  return `••${trn.slice(-4)}`;
}

// TADAT P4-13 thresholds (Field Guide 2025 pg 73)
//   A: ≥90% all + 100% large
//   B: 75-90% all + ≥95% large
//   C: 50-75% all + ≥90% large
//   D: below C
function bandForRateAll(rate: number): "A" | "B" | "C" | "D" {
  if (rate >= 90) return "A";
  if (rate >= 75) return "B";
  if (rate >= 50) return "C";
  return "D";
}

function bandForRateLarge(rate: number): "A" | "B" | "C" | "D" {
  if (rate >= 100) return "A";
  if (rate >= 95) return "B";
  if (rate >= 90) return "C";
  return "D";
}

function distanceToA(rate: number, expected: number, on_time: number) {
  const ppGap = Math.max(0, 90 - rate);
  if (ppGap <= 0) return { ppGap: 0, filingsNeeded: 0 };
  const targetOnTime = Math.ceil(expected * 0.9);
  return { ppGap, filingsNeeded: Math.max(0, targetOnTime - on_time) };
}

const BAND_TEXT: Record<"A" | "B" | "C" | "D", string> = {
  A: "text-emerald-700 dark:text-emerald-300",
  B: "text-blue-700 dark:text-blue-300",
  C: "text-amber-700 dark:text-amber-300",
  D: "text-red-700 dark:text-red-300",
};

const BAND_BG: Record<"A" | "B" | "C" | "D", string> = {
  A: "bg-emerald-500/10 border-emerald-500/30 dark:bg-emerald-500/10 dark:border-emerald-500/20",
  B: "bg-blue-500/10 border-blue-500/30 dark:bg-blue-500/10 dark:border-blue-500/20",
  C: "bg-amber-500/10 border-amber-500/30 dark:bg-amber-500/10 dark:border-amber-500/20",
  D: "bg-red-500/10 border-red-500/30 dark:bg-red-500/10 dark:border-red-500/20",
};

function ageStyle(days: number) {
  if (days > 90)
    return {
      text: "text-red-700 dark:text-red-300",
      emoji: "🔴",
      label: "high risk",
    };
  if (days > 30)
    return {
      text: "text-amber-700 dark:text-amber-300",
      emoji: "🟠",
      label: "aging",
    };
  return {
    text: "text-blue-700 dark:text-blue-300",
    emoji: "🔵",
    label: "recent",
  };
}

const SCORE_RANK: Record<string, number> = {
  A: 7,
  "B+": 6,
  B: 5,
  "C+": 4,
  C: 3,
  "D+": 2,
  D: 1,
};
function scoreRank(s: string | undefined): number {
  return SCORE_RANK[s ?? "D"] ?? 0;
}

// ─── Main view ─────────────────────────────────────────────────────────────

export function KarimView() {
  const [preview, setPreview] = useState<FilingPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [run, setRun] = useState<FilingRun | null>(null);
  const [loadingRun, setLoadingRun] = useState(false);
  const [lastRunAt, setLastRunAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/agents/filing/preview")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        if (!j.success || !j.inputs) throw new Error("Empty response");
        if (!cancelled) setPreview(j.inputs as FilingPreview);
      })
      .catch((e) => {
        console.error("[Karim] preview fetch failed", e);
        if (!cancelled) setPreviewError((e as Error).message || "Fetch failed");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function runAgent() {
    setLoadingRun(true);
    setRun(null);
    try {
      const resp = await fetch("/api/agents/filing/run", { method: "POST" });
      const json = (await resp.json()) as FilingRun;
      setRun(json);
      setLastRunAt(new Date());
    } catch (e) {
      setRun({ success: false, error: (e as Error).message });
    } finally {
      setLoadingRun(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f1115]">
      <div className="h-[3px] bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-400" />
      <main className="mx-auto max-w-7xl px-4 md:px-6 py-6">
        <Link
          href="/dashboard"
          className="mb-5 inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to dashboard
        </Link>

        <PersonaHeader
          run={run}
          loadingRun={loadingRun}
          onRun={runAgent}
          lastRunAt={lastRunAt}
          period={preview?.period_assessed}
        />

        {previewError && (
          <div className="mb-4 rounded-xl border border-red-300/60 bg-red-50 dark:border-red-500/30 dark:bg-red-500/[0.08] px-4 py-3 text-xs text-red-800 dark:text-red-200">
            <strong className="font-bold">Could not load preview data:</strong>{" "}
            {previewError}. Check that the dev server is running and the SQLite
            database has been seeded (<code className="font-mono">npm run db:seed</code>).
          </div>
        )}

        <HeroStrip preview={preview} run={run} />

        <KarimVerdict run={run} loadingRun={loadingRun} onRun={runAgent} />

        <FilingRatesPanel preview={preview} />

        <WorklistPanel preview={preview} />

        <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <EFilingPanel preview={preview} />
          <ManagementPracticesPanel preview={preview} />
        </div>

        <RecommendationsPanel run={run} loadingRun={loadingRun} />

        <TadatFooter run={run} />
      </main>
    </div>
  );
}

// ─── Section 1: Persona header ────────────────────────────────────────────

function PersonaHeader({
  run,
  loadingRun,
  onRun,
  lastRunAt,
  period,
}: {
  run: FilingRun | null;
  loadingRun: boolean;
  onRun: () => void;
  lastRunAt: Date | null;
  period?: string;
}) {
  return (
    <header className="mb-6 flex items-start justify-between gap-6">
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 shrink-0 rounded-2xl bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-400 flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-blue-500/20">
          K
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-1">
            Quanterra · TADAT POA 4 · Timely Filing
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Karim · Filing Compliance Officer
          </h1>
          <p className="mt-1 text-sm italic text-gray-600 dark:text-gray-400">
            “I find the AED you’re owed before it ages out.”
          </p>
        </div>
      </div>

      <div className="flex flex-col items-end gap-2">
        <button
          onClick={onRun}
          disabled={loadingRun}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-500/30 transition hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-50 disabled:cursor-wait"
        >
          {loadingRun ? (
            <>
              <Sparkles className="h-3.5 w-3.5 animate-pulse" />
              Karim is scoring…
            </>
          ) : (
            <>
              <Zap className="h-3.5 w-3.5" />
              {run ? "Run again" : "Run agent"}
            </>
          )}
        </button>
        <div className="text-[10px] text-gray-500 dark:text-gray-500 text-right">
          {lastRunAt ? (
            <>Last run: <span className="text-gray-700 dark:text-gray-300">{relativeTime(lastRunAt)}</span></>
          ) : (
            <>Not yet scored</>
          )}
        </div>
        {period && (
          <div className="text-[10px] text-gray-500 max-w-[200px] text-right">
            {period}
          </div>
        )}
      </div>
    </header>
  );
}

function relativeTime(d: Date): string {
  const sec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

// ─── Section 2: Hero strip ────────────────────────────────────────────────

function HeroStrip({
  preview,
  run,
}: {
  preview: FilingPreview | null;
  run: FilingRun | null;
}) {
  if (!preview) {
    return (
      <section className="mb-6 rounded-3xl bg-gradient-to-br from-blue-700 via-indigo-700 to-purple-800 p-7 md:p-9">
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-blue-200/80 mb-3">
          Recoverable revenue · loading
        </div>
        <div className="h-14 w-72 bg-white/15 rounded-md animate-pulse mb-3" />
        <div className="h-4 w-96 bg-white/10 rounded-md animate-pulse" />
      </section>
    );
  }

  const total = preview.non_filer_worklist.total_aed_outstanding;
  const totalCases = preview.non_filer_worklist.total_cases;
  const top = preview.non_filer_worklist.sample_cases[0];

  return (
    <section className="mb-6 rounded-3xl bg-gradient-to-br from-blue-700 via-indigo-700 to-purple-800 p-7 md:p-9 relative overflow-hidden shadow-lg">
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-400/20 blur-3xl" />
      <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-cyan-400/15 blur-3xl" />

      <div className="relative z-10 flex flex-col md:flex-row items-start justify-between gap-6">
        <div className="flex-1">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-blue-200 mb-3">
            Recoverable revenue · current snapshot
          </div>
          <div className="text-5xl md:text-6xl font-bold text-white mb-2 tabular-nums leading-none">
            {formatAed(total)}
          </div>
          <div className="text-base text-blue-100">
            recoverable from{" "}
            <span className="font-semibold text-white">{totalCases}</span>{" "}
            non-filers across VAT, CT and Excise
          </div>

          {top && (
            <div className="mt-5 inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-amber-300/40 bg-amber-400/15 px-4 py-2 text-xs backdrop-blur-sm">
              <span className="text-amber-200 font-semibold uppercase tracking-wider text-[10px]">
                Top case
              </span>
              <span className="text-white font-bold tabular-nums">
                {formatAed(top.tax_due)}
              </span>
              <span className="text-blue-200">·</span>
              <span className="text-white">{top.industry}</span>
              <span className="text-blue-200">·</span>
              <span className="text-amber-200">{top.days_overdue} days overdue</span>
              <span className="text-blue-200">·</span>
              <span className="font-mono text-blue-100">{maskTrn(top.trn)}</span>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            <button className="inline-flex items-center gap-1.5 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur border border-white/20 px-4 py-2 text-xs font-semibold text-white transition">
              <Download className="h-3.5 w-3.5" />
              Export worklist
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur border border-white/20 px-4 py-2 text-xs font-semibold text-white transition">
              <Send className="h-3.5 w-3.5" />
              Send to enforcement
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center shrink-0">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-blue-200 mb-2">
            POA 4 aggregate
          </div>
          <div className="rounded-2xl bg-white/10 backdrop-blur border border-white/20 px-7 py-5">
            {run?.parsed?.aggregate_score ? (
              <ScoreBadge score={run.parsed.aggregate_score} />
            ) : (
              <span className="text-3xl text-blue-200/80 font-mono tabular-nums">—</span>
            )}
          </div>
          <div className="mt-2 text-[10px] text-blue-200/80">
            {run?.parsed ? "Scored by Karim" : "Run agent to score"}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Section 2.5: Karim's verdict (score + summary) ───────────────────────

function KarimVerdict({
  run,
  loadingRun,
  onRun,
}: {
  run: FilingRun | null;
  loadingRun: boolean;
  onRun: () => void;
}) {
  // Empty / pre-run state — invite to run
  if (!run?.parsed && !loadingRun) {
    return (
      <section className="mb-6 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 px-6 py-5 dark:border-blue-500/20 dark:from-blue-950/40 dark:to-cyan-950/30">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300 mb-1">
              Karim’s verdict
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
              An IMF TADAT mission, in 7 seconds.
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 max-w-2xl">
              Get a scored verdict, the worst-performing tax type, the band-shift
              gap, and the single action that closes it — without the AED 1–3M
              and 3-week field mission.
            </p>
          </div>
          <button
            onClick={onRun}
            className="shrink-0 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-5 py-2.5 text-xs font-bold text-white shadow-md transition hover:-translate-y-0.5"
          >
            <Zap className="h-3.5 w-3.5" />
            Run Karim
          </button>
        </div>
      </section>
    );
  }

  // Loading state — running
  if (loadingRun) {
    return (
      <section className="mb-6 rounded-2xl border border-blue-300/40 bg-blue-50 px-6 py-5 dark:border-blue-500/30 dark:bg-blue-500/[0.06]">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 animate-pulse text-blue-600 dark:text-blue-300" />
          <div className="text-sm text-blue-900 dark:text-blue-100">
            Karim is scoring this period against the TADAT rubric. Usually 5–8 seconds.
          </div>
        </div>
      </section>
    );
  }

  // Scored state — the real verdict
  const parsed = run!.parsed!;
  const indicators = parsed.indicators ?? [];
  const recommendations = parsed.recommendations ?? [];

  // Per-indicator breakdown — group P4-13-* dimensions under one block,
  // then P4-14, P4-15
  const p413 = indicators.filter((i) => i.id?.startsWith("P4-13"));
  const p414 = indicators.find((i) => i.id === "P4-14");
  const p415 = indicators.find((i) => i.id === "P4-15");

  // Build the 1–2 sentence summary from the worst-scoring findings
  const worstFirst = [...indicators].sort(
    (a, b) => scoreRank(a.score) - scoreRank(b.score)
  );
  const summarySentences = worstFirst
    .slice(0, 2)
    .map((i) => i.finding?.trim())
    .filter((s): s is string => Boolean(s && s.length > 0));
  const summary =
    summarySentences.length > 0
      ? summarySentences.join(" ")
      : "POA 4 scoring complete. See per-indicator detail below for evidence and band rationale.";

  return (
    <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 md:p-6 dark:border-white/10 dark:bg-white/[0.02]">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-blue-700 dark:text-blue-400 mb-1">
            Karim’s verdict · POA 4 scored
          </div>
          <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-200 max-w-3xl">
            {summary}
          </p>
        </div>
        <div className="shrink-0 text-center">
          <div className="text-[10px] font-mono uppercase tracking-widest text-gray-500 mb-1.5">
            POA 4 score
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-3 dark:border-white/10 dark:bg-white/[0.04]">
            <ScoreBadge score={parsed.aggregate_score} />
          </div>
          <div className="mt-1.5 text-[10px] text-gray-500">scored in 7s</div>
        </div>
      </div>

      {/* Per-indicator strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
        <IndicatorMini
          code="P4-13"
          label="On-time filing"
          score={parsed.p4_13_aggregate}
          subtext={
            p413.length > 0
              ? `${p413.length} dim · M2 conversion`
              : "VAT / CT / Excise"
          }
        />
        <IndicatorMini
          code="P4-14"
          label="Non-filer management"
          score={p414?.score}
          subtext={p414?.finding ? truncate(p414.finding, 60) : undefined}
        />
        <IndicatorMini
          code="P4-15"
          label="E-filing adoption"
          score={p415?.score}
          subtext={p415?.finding ? truncate(p415.finding, 60) : undefined}
        />
      </div>

      {/* Top action callout */}
      {recommendations[0] && (
        <div className="rounded-lg border border-amber-300/40 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/[0.07] px-4 py-3 flex items-start gap-3">
          <span className="text-[10px] mt-0.5 font-mono uppercase tracking-widest text-amber-700 dark:text-amber-300 shrink-0">
            First action
          </span>
          <p className="text-xs leading-relaxed text-amber-900 dark:text-amber-100">
            {recommendations[0]}
          </p>
        </div>
      )}
    </section>
  );
}

function IndicatorMini({
  code,
  label,
  score,
  subtext,
}: {
  code: string;
  label: string;
  score?: string;
  subtext?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-white/5 dark:bg-white/[0.025]">
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-[10px] text-gray-500">{code}</span>
        {score ? (
          <ScoreBadge score={score} />
        ) : (
          <span className="text-[10px] font-mono text-gray-400">—</span>
        )}
      </div>
      <div className="text-xs font-semibold text-gray-900 dark:text-white">
        {label}
      </div>
      {subtext && (
        <div className="mt-1 text-[10px] text-gray-500 leading-snug">
          {subtext}
        </div>
      )}
    </div>
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

// ─── Section 3: Filing rates per core tax ────────────────────────────────

function FilingRatesPanel({ preview }: { preview: FilingPreview | null }) {
  const taxTypes = ["VAT", "CT", "EXCISE"] as const;

  return (
    <section className="mb-6">
      <h2 className="mb-3 text-[11px] font-mono uppercase tracking-[0.2em] text-gray-500">
        Filing rates per core tax · TADAT P4-13
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {taxTypes.map((t) => {
          const r = preview?.filing_rates[t];
          if (!r) return <FilingRateCardSkeleton key={t} taxType={t} />;
          return <FilingRateCard key={t} taxType={t} rate={r} />;
        })}
      </div>
    </section>
  );
}

function FilingRateCardSkeleton({ taxType }: { taxType: string }) {
  const taxLabel =
    taxType === "EXCISE" ? "Excise" : taxType === "CT" ? "Corporate Tax" : "VAT";
  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.02] p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-bold text-gray-900 dark:text-white">
          {taxLabel}
        </div>
        <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400 dark:text-gray-600">
          loading
        </span>
      </div>
      <div className="h-10 w-24 bg-gray-100 dark:bg-white/[0.04] rounded animate-pulse mb-3" />
      <div className="h-2.5 w-full bg-gray-100 dark:bg-white/[0.04] rounded-full animate-pulse" />
      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-white/5">
        <div className="h-3 w-32 bg-gray-100 dark:bg-white/[0.03] rounded animate-pulse" />
      </div>
    </div>
  );
}

function FilingRateCard({
  taxType,
  rate,
}: {
  taxType: string;
  rate: {
    expected: number;
    on_time: number;
    rate_all_pct: number;
    rate_large_pct: number;
  };
}) {
  const allBand = bandForRateAll(rate.rate_all_pct);
  const largeBand = bandForRateLarge(rate.rate_large_pct);
  const dist = distanceToA(rate.rate_all_pct, rate.expected, rate.on_time);

  const taxLabel =
    taxType === "EXCISE" ? "Excise" : taxType === "CT" ? "Corporate Tax" : "VAT";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.02] p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-bold text-gray-900 dark:text-white">
          {taxLabel}
        </div>
        <span
          className={`rounded-md border px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest ${BAND_BG[allBand]} ${BAND_TEXT[allBand]}`}
        >
          band {allBand}
        </span>
      </div>

      <div className="mb-3">
        <div className={`text-4xl font-bold tabular-nums ${BAND_TEXT[allBand]}`}>
          {rate.rate_all_pct.toFixed(1)}%
        </div>
        <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-500">
          All taxpayers · {rate.on_time.toLocaleString()} of{" "}
          {rate.expected.toLocaleString()} on time
        </div>
      </div>

      <BandStrip rate={rate.rate_all_pct} />

      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-white/5 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-gray-600 dark:text-gray-400">Large taxpayers</span>
          <span className="flex items-center gap-2 font-mono tabular-nums">
            <span className={BAND_TEXT[largeBand]}>
              {rate.rate_large_pct.toFixed(1)}%
            </span>
            <ScoreBadge score={largeBand} />
          </span>
        </div>
        {dist.ppGap > 0 ? (
          <div className="text-[11px] text-amber-700 dark:text-amber-300">
            ▲ {dist.ppGap.toFixed(1)}pp from A · need{" "}
            <span className="font-semibold">{dist.filingsNeeded}</span> more on-time
            filings
          </div>
        ) : (
          <div className="text-[11px] text-emerald-700 dark:text-emerald-300">
            ✓ on TADAT-A band
          </div>
        )}
      </div>
    </div>
  );
}

function BandStrip({ rate }: { rate: number }) {
  const clamped = Math.max(0, Math.min(100, rate));
  return (
    <div className="relative h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-transparent">
      <div className="absolute inset-0 flex">
        <div className="flex-[50] bg-red-500/30 dark:bg-red-500/25" />
        <div className="flex-[25] bg-amber-500/30 dark:bg-amber-500/25" />
        <div className="flex-[15] bg-blue-500/30 dark:bg-blue-500/25" />
        <div className="flex-[10] bg-emerald-500/30 dark:bg-emerald-500/25" />
      </div>
      <div
        className="absolute inset-y-0 w-[2px] bg-gray-900 dark:bg-white shadow-[0_0_8px_rgba(0,0,0,0.5)] dark:shadow-[0_0_8px_rgba(255,255,255,0.6)]"
        style={{ left: `${clamped}%` }}
      />
      <div className="absolute inset-0 flex pointer-events-none text-[8px] font-mono uppercase tracking-widest text-gray-700/60 dark:text-white/40 items-center">
        <div className="flex-[50] text-center">D</div>
        <div className="flex-[25] text-center">C</div>
        <div className="flex-[15] text-center">B</div>
        <div className="flex-[10] text-center">A</div>
      </div>
    </div>
  );
}

// ─── Section 4: Worklist + Drawer ─────────────────────────────────────────

function WorklistPanel({ preview }: { preview: FilingPreview | null }) {
  const [selected, setSelected] = useState<NonFilerCase | null>(null);
  const [sortBy, setSortBy] = useState<"aed" | "days">("aed");
  const [filterTax, setFilterTax] = useState<"all" | "VAT" | "CT" | "EXCISE">(
    "all"
  );
  const [filterSegment, setFilterSegment] = useState<string>("all");
  const [filterSector, setFilterSector] = useState<string>("all");
  const [filterAging, setFilterAging] = useState<
    "all" | "0-30" | "31-90" | "91-365" | ">365"
  >("all");
  const [minAed, setMinAed] = useState<number>(0);

  if (!preview) {
    return (
      <section className="mb-6">
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.02] overflow-hidden">
          <header className="border-b border-gray-200 dark:border-white/5 px-5 py-4">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">
              Non-filer worklist
            </h2>
            <p className="mt-0.5 text-[11px] text-gray-500">
              Loading cases from FY2025 declarations…
            </p>
          </header>
          <div className="p-5 space-y-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-9 bg-gray-100 dark:bg-white/[0.025] rounded animate-pulse"
                style={{ animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  const all = preview.non_filer_worklist.sample_cases;
  const sectors = Array.from(new Set(all.map((c) => c.industry))).sort();
  const segments = Array.from(new Set(all.map((c) => c.segment))).sort();

  const filtered = all.filter((c) => {
    if (filterTax !== "all" && c.tax_type !== filterTax) return false;
    if (filterSegment !== "all" && c.segment !== filterSegment) return false;
    if (filterSector !== "all" && c.industry !== filterSector) return false;
    if (c.tax_due < minAed) return false;
    if (filterAging !== "all") {
      const d = c.days_overdue;
      if (filterAging === "0-30" && !(d <= 30)) return false;
      if (filterAging === "31-90" && !(d > 30 && d <= 90)) return false;
      if (filterAging === "91-365" && !(d > 90 && d <= 365)) return false;
      if (filterAging === ">365" && !(d > 365)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) =>
    sortBy === "aed" ? b.tax_due - a.tax_due : b.days_overdue - a.days_overdue
  );

  const total = preview.non_filer_worklist.total_aed_outstanding;
  const totalCases = preview.non_filer_worklist.total_cases;
  const sampleAed = sorted.reduce((sum, c) => sum + c.tax_due, 0);
  const filtersActive =
    filterTax !== "all" ||
    filterSegment !== "all" ||
    filterSector !== "all" ||
    filterAging !== "all" ||
    minAed > 0;

  function resetFilters() {
    setFilterTax("all");
    setFilterSegment("all");
    setFilterSector("all");
    setFilterAging("all");
    setMinAed(0);
  }

  return (
    <section className="mb-6">
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.02] overflow-hidden">
        <header className="border-b border-gray-200 dark:border-white/5 px-5 py-4">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                Non-filer worklist
              </h2>
              <p className="mt-0.5 text-[11px] text-gray-500">
                {totalCases} cases · {formatAed(total)} total · showing{" "}
                {sorted.length} ({formatAed(sampleAed)})
              </p>
            </div>
            {filtersActive && (
              <button
                onClick={resetFilters}
                className="text-[11px] font-medium text-blue-700 hover:underline dark:text-blue-300"
              >
                Reset filters
              </button>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <FilterSelect
              label="Tax"
              value={filterTax}
              onChange={(v) => setFilterTax(v as typeof filterTax)}
              options={[
                { v: "all", l: "All" },
                { v: "VAT", l: "VAT" },
                { v: "CT", l: "CT" },
                { v: "EXCISE", l: "Excise" },
              ]}
            />
            <FilterSelect
              label="Segment"
              value={filterSegment}
              onChange={setFilterSegment}
              options={[
                { v: "all", l: "All" },
                ...segments.map((s) => ({ v: s, l: s })),
              ]}
            />
            <FilterSelect
              label="Sector"
              value={filterSector}
              onChange={setFilterSector}
              options={[
                { v: "all", l: "All" },
                ...sectors.map((s) => ({ v: s, l: s })),
              ]}
            />
            <FilterSelect
              label="Aging"
              value={filterAging}
              onChange={(v) => setFilterAging(v as typeof filterAging)}
              options={[
                { v: "all", l: "All ages" },
                { v: ">365", l: ">365 days" },
                { v: "91-365", l: "91–365 days" },
                { v: "31-90", l: "31–90 days" },
                { v: "0-30", l: "0–30 days" },
              ]}
            />
            <FilterSelect
              label="Min AED"
              value={String(minAed)}
              onChange={(v) => setMinAed(Number(v))}
              options={[
                { v: "0", l: "Any" },
                { v: "100000", l: "≥ AED 100K" },
                { v: "500000", l: "≥ AED 500K" },
                { v: "1000000", l: "≥ AED 1M" },
                { v: "5000000", l: "≥ AED 5M" },
                { v: "10000000", l: "≥ AED 10M" },
              ]}
            />
            <div className="ml-auto">
              <FilterSelect
                label="Sort"
                value={sortBy}
                onChange={(v) => setSortBy(v as typeof sortBy)}
                options={[
                  { v: "aed", l: "AED ↓" },
                  { v: "days", l: "Days overdue ↓" },
                ]}
              />
            </div>
          </div>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-[10px] uppercase tracking-widest text-gray-500 dark:bg-white/[0.02] dark:text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">TRN</th>
                <th className="px-4 py-3 text-left">Taxpayer</th>
                <th className="px-4 py-3 text-left">Tax</th>
                <th className="px-4 py-3 text-left">Period</th>
                <th className="px-4 py-3 text-left">Days over</th>
                <th className="px-4 py-3 text-right">AED due</th>
                <th className="px-4 py-3 text-left">Sector</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center text-xs text-gray-500"
                  >
                    No cases match the active filters.{" "}
                    <button
                      onClick={resetFilters}
                      className="font-semibold text-blue-700 hover:underline dark:text-blue-300"
                    >
                      Reset
                    </button>
                  </td>
                </tr>
              )}
              {sorted.map((c, i) => {
                const age = ageStyle(c.days_overdue);
                return (
                  <tr
                    key={c.declaration_id}
                    onClick={() => setSelected(c)}
                    className="cursor-pointer border-t border-gray-200 dark:border-white/5 transition hover:bg-blue-50 dark:hover:bg-blue-500/[0.04]"
                  >
                    <td className="px-4 py-3 font-mono text-gray-500">
                      {i + 1}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-600 dark:text-gray-400">
                      {maskTrn(c.trn)}
                    </td>
                    <td className="px-4 py-3 text-gray-800 dark:text-gray-200">
                      {c.legal_name_en.length > 30
                        ? c.legal_name_en.slice(0, 30) + "…"
                        : c.legal_name_en}
                      {c.segment === "Large" && (
                        <span className="ml-2 rounded-md bg-purple-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                          large
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {c.tax_type}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-600 dark:text-gray-400">
                      {c.period_label}
                    </td>
                    <td className={`px-4 py-3 font-medium ${age.text}`}>
                      {age.emoji} {c.days_overdue}d
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-gray-900 dark:text-white">
                      {formatAed(c.tax_due)}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-gray-600 dark:text-gray-400">
                      {c.industry}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-1 text-[10px] font-semibold text-blue-700 dark:text-blue-300 transition">
                        <Zap className="h-3 w-3" />
                        Open
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <footer className="border-t border-gray-200 dark:border-white/5 px-5 py-3 text-[10px] text-gray-500 flex items-center justify-between">
          <span>Click a row to open case file with draft assessment notice.</span>
          <span className="font-mono tabular-nums">
            Selected: {sorted.length} of {totalCases}
          </span>
        </footer>
      </div>

      {selected && (
        <WorklistDrawer case_={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ v: string; l: string }>;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300">
      <span className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-xs text-gray-800 outline-none dark:text-gray-200 [&>option]:bg-white [&>option]:text-gray-900 dark:[&>option]:bg-[#0f1115] dark:[&>option]:text-gray-200"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </label>
  );
}

function WorklistDrawer({
  case_,
  onClose,
}: {
  case_: NonFilerCase;
  onClose: () => void;
}) {
  const age = ageStyle(case_.days_overdue);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 dark:bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg overflow-y-auto border-l border-gray-200 bg-white dark:border-white/10 dark:bg-[#1a1d24] shadow-2xl">
        <div className="p-6">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-blue-700 dark:text-blue-400 mb-1">
                Non-filer case · {case_.declaration_id}
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {case_.legal_name_en}
              </h2>
              <div className="mt-1 font-mono text-xs text-gray-600 dark:text-gray-400">
                TRN {case_.trn}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-2xl leading-none text-gray-400 hover:text-gray-900 dark:text-gray-500 dark:hover:text-white transition"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3">
            <Fact label="Tax type" value={case_.tax_type} />
            <Fact label="Period" value={case_.period_label} />
            <Fact label="Statutory due" value={case_.due_date} />
            <Fact
              label="Days overdue"
              value={`${case_.days_overdue} days · ${age.label}`}
              tone={case_.days_overdue > 90 ? "alarm" : "neutral"}
            />
            <Fact label="Sector" value={case_.industry} />
            <Fact label="Segment" value={case_.segment} />
          </div>

          <div className="mb-5 rounded-xl border border-amber-300/60 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/[0.07] p-4">
            <div className="text-[10px] font-mono uppercase tracking-widest text-amber-700 dark:text-amber-300 mb-1">
              Tax declared due
            </div>
            <div className="text-3xl font-bold tabular-nums text-gray-900 dark:text-white">
              {formatAed(case_.tax_due)}
            </div>
            <div className="mt-1 text-[11px] text-gray-700 dark:text-gray-400">
              Late penalty + interest accrue from due date per Cabinet Decision 40.
            </div>
          </div>

          <div className="mb-5 rounded-xl border border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/[0.02] p-5">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-gray-500">
              <FileText className="h-3 w-3" />
              Draft assessment notice
            </div>
            <div className="space-y-2.5 font-serif text-[13px] leading-relaxed text-gray-700 dark:text-gray-300">
              <p>
                <span className="font-sans text-[10px] uppercase tracking-widest text-gray-500">
                  To
                </span>
                <br />
                <span className="font-sans font-bold text-gray-900 dark:text-white">
                  {case_.legal_name_en}
                </span>{" "}
                <span className="font-sans font-mono text-xs text-gray-600 dark:text-gray-400">
                  · TRN {case_.trn}
                </span>
              </p>
              <p>
                Pursuant to UAE Federal Decree-Law No. 28 of 2022 on Tax
                Procedures, the Federal Tax Authority records that the{" "}
                <span className="font-sans font-bold">{case_.tax_type}</span>{" "}
                declaration for period{" "}
                <span className="font-sans font-bold">{case_.period_label}</span>,
                statutorily due on{" "}
                <span className="font-sans font-bold">{case_.due_date}</span>,
                remains unfiled.
              </p>
              <p>
                Estimated tax due:{" "}
                <span className="font-sans font-bold text-amber-700 dark:text-amber-300">
                  {formatAed(case_.tax_due)}
                </span>
                .
              </p>
              <p>
                You are required to file within{" "}
                <span className="font-sans font-bold">7 calendar days</span> of
                this notice. Failure will result in a default assessment plus
                administrative penalties.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <DrawerAction icon={Zap} label="Issue assessment notice" tone="primary" />
            <DrawerAction icon={Phone} label="Add to phone-call queue" />
            <DrawerAction icon={FileText} label="Note to file" />
          </div>

          <p className="mt-4 text-center text-[10px] text-gray-500">
            Demo mode · actions are not dispatched.
          </p>
        </div>
      </aside>
    </>
  );
}

function Fact({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "alarm";
}) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-gray-500 mb-0.5">
        {label}
      </div>
      <div
        className={`font-mono text-sm ${
          tone === "alarm"
            ? "text-red-700 dark:text-red-300"
            : "text-gray-800 dark:text-gray-200"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function DrawerAction({
  icon: Icon,
  label,
  tone = "secondary",
}: {
  icon: typeof Zap;
  label: string;
  tone?: "primary" | "secondary";
}) {
  const cls =
    tone === "primary"
      ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/30 hover:-translate-y-0.5"
      : "bg-gray-50 border border-gray-200 text-gray-800 hover:bg-gray-100 dark:bg-white/[0.03] dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/[0.06]";
  return (
    <button
      className={`w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition ${cls}`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

// ─── Section 5a: E-filing adoption ────────────────────────────────────────

function EFilingPanel({ preview }: { preview: FilingPreview | null }) {
  if (!preview) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.02] p-5">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
          E-filing adoption
        </h3>
        <p className="mb-4 text-[11px] text-gray-500">Loading…</p>
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-2 bg-gray-100 dark:bg-white/[0.04] rounded-full animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }
  const byTax = preview.e_filing_rate_pct_by_tax;
  const overall = preview.e_filing_rate_pct_overall;
  const overallA = overall >= 85;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.02] p-5">
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">
          E-filing adoption
        </h3>
        <span className="text-[10px] font-mono uppercase tracking-widest text-gray-500">
          P4-15
        </span>
      </div>
      <p className="mb-4 text-[11px] text-gray-500">
        TADAT-A: ≥ 85% per core tax. Marker line at 85%.
      </p>

      <div className="space-y-3">
        {Object.entries(byTax).map(([tax, rate]) => (
          <EFilingRow key={tax} tax={tax} rate={rate} />
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 dark:border-white/5 dark:bg-white/[0.02] px-3 py-2">
        <span className="text-[11px] text-gray-700 dark:text-gray-400">
          Overall (all taxes)
        </span>
        <span
          className={`font-mono text-sm tabular-nums ${
            overallA
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-amber-700 dark:text-amber-300"
          }`}
        >
          {overall.toFixed(1)}% {overallA ? "✓" : "below A"}
        </span>
      </div>
    </div>
  );
}

function EFilingRow({ tax, rate }: { tax: string; rate: number }) {
  const aBand = rate >= 85;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs text-gray-700 dark:text-gray-300">{tax}</span>
        <span
          className={`font-mono text-xs tabular-nums ${
            aBand
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-amber-700 dark:text-amber-300"
          }`}
        >
          {rate.toFixed(1)}% {aBand ? "✓" : "below A"}
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.04]">
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${
            aBand ? "bg-emerald-500" : "bg-amber-500"
          }`}
          style={{ width: `${Math.min(100, rate)}%` }}
        />
        <div
          className="absolute inset-y-0 w-[1.5px] bg-gray-700/60 dark:bg-white/60"
          style={{ left: "85%" }}
        />
      </div>
    </div>
  );
}

// ─── Section 5b: P4-14 management practices checklist ─────────────────────

function ManagementPracticesPanel({ preview }: { preview: FilingPreview | null }) {
  if (!preview) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.02] p-5">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
          Non-filer management
        </h3>
        <p className="mb-4 text-[11px] text-gray-500">Loading…</p>
        <div className="space-y-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-4 bg-gray-100 dark:bg-white/[0.04] rounded animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }
  const p = preview.p4_14_management_practices;

  const items: Array<{ label: string; ok: boolean; reason?: string }> = [
    { label: "Automated identification of non-filers", ok: p.automated_identification },
    { label: "Automated penalty generation", ok: p.auto_penalties },
    { label: "Documented procedures", ok: p.documented_procedures },
    { label: "Register routinely updated", ok: p.register_routinely_updated },
    {
      label: `Follow-up within ${p.follow_up_within_days} days`,
      ok: p.follow_up_within_days <= 14,
      reason:
        p.follow_up_within_days > 7
          ? `A band requires ≤ 7 days`
          : undefined,
    },
    {
      label: "Predictive modelling used",
      ok: p.predictive_modelling_used,
      reason: !p.predictive_modelling_used
        ? "Required for A band — currently the gap"
        : undefined,
    },
  ];

  const passed = items.filter((i) => i.ok).length;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.02] p-5">
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">
          Non-filer management
        </h3>
        <span className="text-[10px] font-mono uppercase tracking-widest text-gray-500">
          P4-14
        </span>
      </div>
      <p className="mb-4 text-[11px] text-gray-500">
        {passed} of {items.length} practices in place · TADAT 2025 pg 75
      </p>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2.5 text-xs">
            {it.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            )}
            <div className="flex-1">
              <div
                className={
                  it.ok
                    ? "text-gray-800 dark:text-gray-200"
                    : "text-amber-800 dark:text-amber-200"
                }
              >
                {it.label}
              </div>
              {it.reason && (
                <div className="mt-0.5 text-[10px] text-amber-700 dark:text-amber-400/70">
                  ← {it.reason}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Section 6a: Recommendations ───────────────────────────────────────────

function RecommendationsPanel({
  run,
  loadingRun,
}: {
  run: FilingRun | null;
  loadingRun: boolean;
}) {
  if (loadingRun) {
    return (
      <section className="mb-6 rounded-2xl border border-blue-300/40 bg-blue-50 dark:border-blue-500/20 dark:bg-blue-500/[0.04] p-6">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 animate-pulse text-blue-600 dark:text-blue-400" />
          <div className="text-sm text-blue-900 dark:text-blue-200">
            Karim is reading the FY2025 data and applying the TADAT 2025 rubric…
          </div>
        </div>
      </section>
    );
  }
  if (!run?.parsed?.recommendations || run.parsed.recommendations.length === 0) {
    return null;
  }

  return (
    <section className="mb-6 rounded-2xl border border-blue-300/40 bg-blue-50/60 dark:border-blue-500/20 dark:bg-gradient-to-br dark:from-blue-900/25 dark:to-indigo-900/15 p-6">
      <div className="mb-3 flex items-start gap-3">
        <div className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-sm font-bold text-white">
          K
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
            Karim’s recommendations
          </h3>
          <p className="mt-0.5 text-[11px] text-gray-600 dark:text-gray-400">
            Tied to TADAT 2025 Field Guide thresholds · cite specific cases
          </p>
        </div>
      </div>
      <ol className="space-y-3 pl-1">
        {run.parsed.recommendations.map((r, i) => (
          <li
            key={i}
            className="flex gap-3 text-sm leading-relaxed text-gray-800 dark:text-gray-200"
          >
            <span className="mt-0.5 font-mono text-xs text-blue-700 dark:text-blue-400">
              {i + 1}.
            </span>
            <span>{r}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ─── Section 7: TADAT footer (collapsible) ────────────────────────────────

function TadatFooter({ run }: { run: FilingRun | null }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="border-t border-gray-200 dark:border-white/5 pt-4 mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 text-left text-[11px] font-mono uppercase tracking-widest text-gray-500 transition hover:text-gray-900 dark:hover:text-gray-200"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        TADAT 2025 Field Guide scoring detail
        {run?.parsed?.aggregate_score && (
          <span className="ml-auto inline-flex items-center gap-2 normal-case tracking-normal">
            <span className="text-gray-600 dark:text-gray-400">
              POA 4 aggregate
            </span>
            <ScoreBadge score={run.parsed.aggregate_score} />
          </span>
        )}
        {!run?.parsed?.aggregate_score && (
          <span className="ml-auto text-gray-500 normal-case tracking-normal">
            Run agent to populate
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-4 space-y-2.5">
          {run?.parsed?.indicators?.map((ind) => (
            <div
              key={ind.id}
              className="rounded-xl border border-gray-200 bg-gray-50 dark:border-white/5 dark:bg-white/[0.015] p-4"
            >
              <div className="mb-2 flex items-center gap-3">
                <span className="font-mono text-[11px] text-gray-500">
                  {ind.id}
                </span>
                <span className="flex-1 text-sm font-semibold text-gray-900 dark:text-white">
                  {ind.name}
                </span>
                <ScoreBadge score={ind.score} />
              </div>
              {ind.finding && (
                <p className="mb-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                  {ind.finding}
                </p>
              )}
              {ind.detail && (
                <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                  {ind.detail}
                </p>
              )}
              {ind.evidence && ind.evidence.length > 0 && (
                <ul className="mt-2 ml-3 list-disc space-y-1 text-[11px] text-gray-500">
                  {ind.evidence.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          {run?.parsed?.not_applicable && run.parsed.not_applicable.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 dark:border-white/5 dark:bg-white/[0.01] p-3">
              <div className="mb-1 text-[10px] font-mono uppercase tracking-widest text-gray-500">
                Not applicable to UAE
              </div>
              <ul className="text-[11px] text-gray-600 dark:text-gray-500">
                {run.parsed.not_applicable.map((na) => (
                  <li key={na.id}>
                    <span className="font-mono text-gray-700 dark:text-gray-400">
                      {na.id}
                    </span>{" "}
                    — {na.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!run?.parsed?.indicators && (
            <p className="rounded-xl border border-gray-200 bg-gray-50 dark:border-white/5 dark:bg-white/[0.01] p-4 text-xs text-gray-600 dark:text-gray-500">
              The TADAT scoring detail populates after Karim finishes a run. The
              SQL pre-aggregations above are deterministic — the LLM only
              applies the rubric and writes the narrative.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
