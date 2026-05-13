"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Activity,
  FileCheck2,
  Building2,
  Receipt,
  TrendingUp,
  AlertTriangle,
  ExternalLink,
  Sparkles,
} from "lucide-react";

import { QTaskWordmark } from "@/components/QTaskLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { StatCard } from "@/components/StatCard";
import { ScoreBadge } from "@/components/ScoreBadge";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { EmirateDonut } from "@/components/charts/EmirateDonut";
import { FilingRatesBar } from "@/components/charts/FilingRatesBar";
import { ArrearsAgingStrip } from "@/components/charts/ArrearsAgingStrip";
import { Gauge } from "@/components/charts/Gauge";
import { PERSONA_LIST, PERSONAS, type AgentId } from "@/lib/personas";

interface Snapshot {
  generated_at: string;
  kpis: {
    taxpayers: number;
    active_taxpayers: number;
    declarations: number;
    payments: number;
    total_collected_aed: number;
    total_arrears_aed: number;
    arrears_cases: number;
    non_filer_cases: number;
  };
  distributions: {
    by_emirate: Array<{ emirate: string; count: number }>;
    by_segment: Array<{ segment: string; count: number }>;
    arrears_by_bucket: Array<{ age_bucket: string; cases: number; amount_aed: number }>;
  };
  poa1: {
    registry_stats: {
      total_records: number;
      missing_either_contact_count: number;
      soft_duplicate_pairs_count: number;
      active_with_no_recent_filing_count: number;
      vat_registered: number;
      ct_registered: number;
      excise_registered: number;
    };
  };
  poa4: {
    filing_rates: Record<string, { rate_all_pct: number; rate_large_pct: number; expected: number; on_time: number }>;
    e_filing_rate_pct_overall: number;
    non_filer_total: number;
  };
  poa5: {
    e_payment_pct: number;
    vat_on_time_pct_n: number;
    vat_on_time_pct_v: number;
    arrears_total_pct: number;
    arrears_old_pct: number;
    high_risk_debtors: Array<{
      trn: string;
      legal_name_en: string;
      tax_type: string;
      outstanding_aed: number;
      age_bucket: string;
      collectible: boolean;
    }>;
  };
  fta_anchors: Array<{ fiscal_year: number; metric: string; value: number; source_file: string }>;
}

interface CaseState {
  status: "idle" | "running" | "done" | "error";
  score?: string;
  finished_at?: string;
  duration_ms?: number;
  headline?: string;
}

export default function DashboardPage() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [cases, setCases] = useState<Record<AgentId, CaseState>>({
    registry: { status: "idle" },
    risk: { status: "idle" },
    service: { status: "idle" },
    filing: { status: "idle" },
    payments: { status: "idle" },
  });
  const [runningAll, setRunningAll] = useState(false);

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/dashboard/snapshot?t=${Date.now()}`);
    const j = (await r.json()) as Snapshot;
    setSnap(j);
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function runAgent(id: AgentId) {
    setCases((p) => ({ ...p, [id]: { status: "running" } }));
    try {
      const t0 = Date.now();
      const r = await fetch(`/api/agents/${id}/run`, { method: "POST" });
      const j = await r.json();
      const score = j?.parsed?.aggregate_score as string | undefined;
      const headline = j?.parsed?.indicators?.[0]?.finding as string | undefined;
      setCases((p) => ({
        ...p,
        [id]: {
          status: j.success ? "done" : "error",
          score,
          finished_at: new Date().toLocaleTimeString(),
          duration_ms: Date.now() - t0,
          headline: headline?.slice(0, 110),
        },
      }));
    } catch {
      setCases((p) => ({ ...p, [id]: { status: "error" } }));
    }
  }
  async function runAll() {
    setRunningAll(true);
    for (const p of PERSONA_LIST) {
      // eslint-disable-next-line no-await-in-loop
      await runAgent(p.id);
    }
    setRunningAll(false);
  }

  const k = snap?.kpis;
  const overallScore = (() => {
    const order = ["A", "B+", "B", "C+", "C", "D+", "D"];
    const scores = Object.values(cases).map((c) => c.score).filter(Boolean) as string[];
    if (!scores.length) return undefined;
    return scores.sort((a, b) => order.indexOf(a) - order.indexOf(b)).pop();
  })();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-[#282C34] dark:text-gray-200">
      {/* Top bar */}
      <div className="border-b border-gray-200/60 bg-white/80 backdrop-blur dark:q-border-soft dark:bg-[#1e2128]/80">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:q-border dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Home
            </Link>
            <QTaskWordmark />
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://tax.gov.ae/en/open.data/open.data.aspx"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-mono uppercase text-gray-500 hover:text-fta"
            >
              FTA open data <ExternalLink className="h-3 w-3" />
            </a>
            <ThemeToggle />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1600px] p-4 md:p-6">
        {/* Welcome banner */}
        <div className="dashboard-banner rounded-3xl p-8 md:p-10 mb-6 animate-fade-up">
          <div className="relative z-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-fta">
                  Q Tax · Live demo
                </p>
                <h1 className="mb-2 text-3xl font-bold text-white md:text-4xl">
                  Welcome to your AI tax desk
                </h1>
                <p className="max-w-2xl text-sm text-white/65">
                  Three agents — Layla, Karim, and Salma — are ready to audit
                  the registry, filing, and arrears against the IMF TADAT
                  framework. Open a case to see them work.
                </p>
              </div>

              <div className="flex items-center gap-4">
                {overallScore && (
                  <div className="flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 backdrop-blur-md">
                    <span className="text-xs uppercase text-white/60">TADAT</span>
                    <ScoreBadge score={overallScore} />
                  </div>
                )}
                <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 backdrop-blur-md">
                  <span className="pulse-dot inline-block h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="text-sm font-medium text-white/90">Live data</span>
                </div>
                <div className="text-right">
                  <div className="text-xs text-white/40">Last refresh</div>
                  <div className="text-sm font-medium text-white/80 tabular-nums">
                    {lastUpdated.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard label="Active Taxpayers" value={k ? k.active_taxpayers.toLocaleString() : "—"} hint={k ? `${k.taxpayers.toLocaleString()} total` : undefined} icon={Building2} color="text-emerald-300" />
              <StatCard label="Declarations (12mo)" value={k ? k.declarations.toLocaleString() : "—"} hint={k ? `${k.non_filer_cases} non-filer cases` : undefined} icon={FileCheck2} color="text-blue-300" />
              <StatCard label="Collected" value={k ? `${(k.total_collected_aed / 1_000_000).toFixed(1)}M AED` : "—"} hint={k ? `${k.payments.toLocaleString()} payments` : undefined} icon={Receipt} color="text-violet-300" />
              <StatCard label="Outstanding Arrears" value={k ? `${(k.total_arrears_aed / 1_000_000).toFixed(1)}M AED` : "—"} hint={k ? `${k.arrears_cases} cases` : undefined} icon={AlertTriangle} color="text-amber-300" />
            </div>
          </div>
        </div>

        {/* ── Open Cases — the heart of the workspace ── */}
        <section className="mb-6 animate-fade-up-delay-1">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Open Cases</h2>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Each agent has a case waiting in their inbox. Open one to engage them.
              </p>
            </div>
            <button
              onClick={runAll}
              disabled={runningAll}
              className="inline-flex items-center gap-2 rounded-full border border-fta/40 bg-fta/10 px-4 py-2 text-xs font-semibold text-fta transition hover:bg-fta/20 disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {runningAll ? "Briefing all agents…" : "Brief all agents now"}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {PERSONA_LIST.map((p) => {
              const c = cases[p.id];
              return (
                <article
                  key={p.id}
                  className={`glass-panel relative overflow-hidden p-5 transition`}
                >
                  <div className={`absolute left-0 top-0 h-1 w-full bg-gradient-to-r ${p.avatarGradient}`} />

                  <div className="flex items-start gap-4">
                    <PersonaAvatar persona={p} size={56} status={c.status} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-gray-900 dark:text-white">{p.name}</h3>
                        <span className={`rounded-full border ${p.accentBorder} q-surface px-2 py-0.5 text-[10px] font-mono ${p.accentText}`}>
                          POA {p.poa}
                        </span>
                      </div>
                      <p className={`text-xs font-semibold ${p.accentText}`}>{p.role}</p>
                    </div>
                    {c.score && <ScoreBadge score={c.score} />}
                  </div>

                  <div className="mt-4 rounded-lg border q-border-soft q-input p-3">
                    <div className="text-[10px] font-mono uppercase text-gray-500">case file</div>
                    <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{p.caseLabel}</p>
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{p.caseDescription}</p>
                  </div>

                  {c.status === "done" && c.headline && (
                    <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-50 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/5">
                      <div className="text-[10px] font-mono uppercase text-emerald-700 dark:text-emerald-400">{p.name}'s finding</div>
                      <p className="mt-1 text-xs leading-relaxed text-gray-700 dark:text-gray-300">{c.headline}</p>
                    </div>
                  )}

                  {c.status === "running" && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/5 dark:text-amber-300">
                      <span className="pulse-dot inline-block h-2 w-2 rounded-full bg-amber-400" />
                      {p.name} is reviewing the data…
                    </div>
                  )}

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      onClick={() => runAgent(p.id)}
                      disabled={c.status === "running"}
                      className={`flex-1 rounded-lg border ${p.accentBorder} q-surface px-3 py-2 text-xs font-semibold ${p.accentText} transition hover:q-surface-3 disabled:opacity-50`}
                    >
                      {c.status === "idle" && `Brief ${p.name}`}
                      {c.status === "running" && "Working…"}
                      {c.status === "done" && `Re-brief ${p.name}`}
                      {c.status === "error" && "Retry"}
                    </button>
                    <Link
                      href={`/agents/${p.id}`}
                      className="rounded-lg border q-border q-surface px-3 py-2 text-xs font-semibold text-gray-300 transition hover:q-surface-3"
                    >
                      Desk →
                    </Link>
                  </div>

                  {c.duration_ms && (
                    <div className="mt-2 text-[10px] font-mono text-gray-500">
                      {p.name} replied in {(c.duration_ms / 1000).toFixed(1)}s · {c.finished_at}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        {/* ── Live FTA snapshot ── */}
        <section className="mb-6 animate-fade-up-delay-2">
          <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-white">FTA Live Snapshot</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {/* Layla's domain */}
            <div className="glass-panel p-5">
              <header className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PersonaAvatar persona={PERSONAS.registry} size={28} />
                  <span className="text-xs font-mono uppercase tracking-widest text-gray-600 dark:text-gray-400">
                    {PERSONAS.registry.name}'s domain · Registry
                  </span>
                </div>
              </header>
              {snap ? (
                <>
                  <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Distribution by emirate</h3>
                  <EmirateDonut data={snap.distributions.by_emirate} />
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {[
                      { l: "VAT", v: snap.poa1.registry_stats.vat_registered },
                      { l: "CT", v: snap.poa1.registry_stats.ct_registered },
                      { l: "Excise", v: snap.poa1.registry_stats.excise_registered },
                    ].map((m) => (
                      <div key={m.l} className="rounded-md q-surface p-2">
                        <div className="text-[10px] uppercase text-gray-500">{m.l}</div>
                        <div className="font-mono text-sm font-bold tabular-nums">
                          {m.v.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-50 p-2 text-[11px] text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/5 dark:text-amber-300">
                    ⚠ {snap.poa1.registry_stats.missing_either_contact_count} missing contact ·{" "}
                    {snap.poa1.registry_stats.soft_duplicate_pairs_count} duplicates ·{" "}
                    {snap.poa1.registry_stats.active_with_no_recent_filing_count} dormant-mismatch
                  </div>
                </>
              ) : (
                <div className="h-44 animate-pulse rounded-md q-surface" />
              )}
            </div>

            {/* Hamad's domain — POA 2 risk register */}
            <div className="glass-panel p-5">
              <header className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PersonaAvatar persona={PERSONAS.risk} size={28} />
                  <span className="text-xs font-mono uppercase tracking-widest text-gray-600 dark:text-gray-400">
                    {PERSONAS.risk.name}'s domain · Risk
                  </span>
                </div>
              </header>
              <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Top compliance risks (AED at risk)</h3>
              <div className="space-y-1.5">
                {[
                  { label: "CT large-segment non-filers", aed: 50_000_000, source: "data-derived" },
                  { label: "VAT refund-fraud (registry duplicates)", aed: 12_000_000, source: "data-derived" },
                  { label: "Excise — high-AED arrears", aed: 18_500_000, source: "data-derived" },
                  { label: "Transfer pricing", aed: null, source: "tadat-illustrative" },
                  { label: "Hidden economy", aed: null, source: "tadat-illustrative" },
                ].map((r) => {
                  const max = 50_000_000;
                  const pct = r.aed ? Math.min(100, (r.aed / max) * 100) : 0;
                  return (
                    <div key={r.label}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[11px] text-gray-700 dark:text-gray-300 truncate flex-1 pr-2">
                          {r.label}
                        </span>
                        <span className="font-mono text-[10px] text-gray-900 dark:text-white tabular-nums shrink-0">
                          {r.aed ? `${(r.aed / 1_000_000).toFixed(1)}M` : "—"}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-200 dark:bg-white/5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            r.source === "tadat-illustrative"
                              ? "bg-violet-400"
                              : "bg-gradient-to-r from-rose-500 to-amber-500"
                          }`}
                          style={{ width: r.aed ? `${pct}%` : "20%" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400">
                <span><span className="inline-block h-2 w-2 rounded-full bg-rose-500 mr-1" />data-derived</span>
                <span><span className="inline-block h-2 w-2 rounded-full bg-violet-400 mr-1" />tadat-illustrative</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-md q-surface p-2">
                  <div className="text-[10px] uppercase text-gray-500">Risks</div>
                  <div className="font-mono text-sm font-bold tabular-nums">8</div>
                </div>
                <div className="rounded-md q-surface p-2">
                  <div className="text-[10px] uppercase text-gray-500">AED at risk</div>
                  <div className="font-mono text-sm font-bold tabular-nums text-amber-600 dark:text-amber-300">92.5M</div>
                </div>
                <div className="rounded-md q-surface p-2">
                  <div className="text-[10px] uppercase text-gray-500">No owner</div>
                  <div className="font-mono text-sm font-bold tabular-nums text-rose-600 dark:text-rose-300">2</div>
                </div>
              </div>
            </div>

            {/* Maya's domain — POA 3 service & facilitation */}
            <div className="glass-panel p-5">
              <header className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PersonaAvatar persona={PERSONAS.service} size={28} />
                  <span className="text-xs font-mono uppercase tracking-widest text-gray-600 dark:text-gray-400">
                    {PERSONAS.service.name}'s domain · Service
                  </span>
                </div>
              </header>
              <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Service channel mix</h3>
              <div className="space-y-1.5">
                {[
                  { ch: "EmaraTax portal", pct: 62, color: "from-fuchsia-500 to-pink-500" },
                  { ch: "Telephone", pct: 22, color: "from-violet-500 to-indigo-500" },
                  { ch: "Email / chat", pct: 11, color: "from-blue-500 to-cyan-500" },
                  { ch: "Walk-in / Tasheel", pct: 5,  color: "from-emerald-500 to-teal-500" },
                ].map((c) => (
                  <div key={c.ch}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[11px] text-gray-700 dark:text-gray-300 flex-1 pr-2">{c.ch}</span>
                      <span className="font-mono text-[10px] text-gray-900 dark:text-white tabular-nums shrink-0">
                        {c.pct}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-200 dark:bg-white/5 overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${c.color}`}
                        style={{ width: `${c.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-md q-surface p-2">
                  <div className="text-[10px] uppercase text-gray-500">P50 wait</div>
                  <div className="font-mono text-sm font-bold tabular-nums text-amber-600 dark:text-amber-300">7.4 min</div>
                </div>
                <div className="rounded-md q-surface p-2">
                  <div className="text-[10px] uppercase text-gray-500">Inquiries</div>
                  <div className="font-mono text-sm font-bold tabular-nums">459K</div>
                </div>
                <div className="rounded-md q-surface p-2">
                  <div className="text-[10px] uppercase text-gray-500">Backlog</div>
                  <div className="font-mono text-sm font-bold tabular-nums">5</div>
                </div>
              </div>
            </div>

            {/* Karim's domain */}
            <div className="glass-panel p-5">
              <header className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PersonaAvatar persona={PERSONAS.filing} size={28} />
                  <span className="text-xs font-mono uppercase tracking-widest text-gray-600 dark:text-gray-400">
                    {PERSONAS.filing.name}'s domain · Filing
                  </span>
                </div>
              </header>
              {snap ? (
                <>
                  <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">On-time filing rate per tax</h3>
                  <FilingRatesBar
                    data={Object.entries(snap.poa4.filing_rates).map(([k, v]) => ({
                      tax_type: k,
                      rate_all_pct: v.rate_all_pct,
                      rate_large_pct: v.rate_large_pct,
                    }))}
                  />
                  <div className="mt-3 flex items-center justify-around">
                    <Gauge value={snap.poa4.e_filing_rate_pct_overall} label="e-filing" />
                    <div>
                      <div className="text-[10px] uppercase text-gray-500">Non-filers</div>
                      <div className="font-mono text-2xl font-bold text-amber-600 tabular-nums dark:text-amber-300">
                        {snap.poa4.non_filer_total}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-44 animate-pulse rounded-md q-surface" />
              )}
            </div>

            {/* Salma's domain */}
            <div className="glass-panel p-5">
              <header className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PersonaAvatar persona={PERSONAS.payments} size={28} />
                  <span className="text-xs font-mono uppercase tracking-widest text-gray-600 dark:text-gray-400">
                    {PERSONAS.payments.name}'s domain · Arrears
                  </span>
                </div>
              </header>
              {snap ? (
                <>
                  <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Arrears aging (% of value)</h3>
                  <ArrearsAgingStrip data={snap.distributions.arrears_by_bucket} />
                  <div className="mt-4 flex items-center justify-around">
                    <Gauge value={snap.poa5.vat_on_time_pct_v} label="VAT on-time" />
                    <Gauge value={snap.poa5.e_payment_pct} label="e-payment" thresholds={[25, 50, 75]} />
                  </div>
                </>
              ) : (
                <div className="h-44 animate-pulse rounded-md q-surface" />
              )}
            </div>
          </div>
        </section>

        {/* ── High-risk debtors + FTA anchors ── */}
        <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2 animate-fade-up-delay-3">
          <div className="glass-panel p-5">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-gray-600 dark:text-gray-400">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              Top high-risk debtors · Salma's worklist
            </h3>
            <div className="overflow-hidden rounded-md border q-border-soft">
              <table className="w-full text-xs">
                <thead className="q-surface text-[10px] uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">TRN</th>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Tax</th>
                    <th className="px-3 py-2 text-right">Outstanding</th>
                    <th className="px-3 py-2 text-center">Age</th>
                  </tr>
                </thead>
                <tbody>
                  {snap?.poa5.high_risk_debtors.slice(0, 8).map((d) => (
                    <tr key={d.trn} className="border-t q-border-soft">
                      <td className="px-3 py-2 font-mono text-gray-500">…{d.trn.slice(-6)}</td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{d.legal_name_en.slice(0, 28)}</td>
                      <td className="px-3 py-2 text-gray-400">{d.tax_type}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-gray-900 dark:text-white">
                        {(d.outstanding_aed / 1_000).toFixed(0)}k
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-mono ${
                            d.age_bucket === ">365"
                              ? "bg-red-500/20 text-red-700 dark:text-red-300"
                              : d.age_bucket === "91-365"
                                ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                                : "bg-blue-500/20 text-blue-700 dark:text-blue-300"
                          }`}
                        >
                          {d.age_bucket}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-panel p-5">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-gray-600 dark:text-gray-400">
              <TrendingUp className="h-3.5 w-3.5 text-fta" />
              Real FTA anchor numbers
            </h3>
            <p className="mb-3 text-xs text-gray-500">
              Public from{" "}
              <a
                href="https://tax.gov.ae/en/open.data/open.data.aspx"
                target="_blank"
                rel="noreferrer"
                className="text-fta hover:underline"
              >
                tax.gov.ae
              </a>
              . Our DB scales to these.
            </p>
            <div className="overflow-hidden rounded-md border q-border-soft">
              <table className="w-full text-xs">
                <thead className="q-surface text-[10px] uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Year</th>
                    <th className="px-3 py-2 text-left">Metric</th>
                    <th className="px-3 py-2 text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {snap?.fta_anchors.slice(0, 9).map((a, i) => (
                    <tr key={i} className="border-t q-border-soft">
                      <td className="px-3 py-2 font-mono text-gray-500">{a.fiscal_year}</td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{a.metric}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-gray-900 dark:text-white">
                        {a.value.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <div className="text-center">
          <button
            onClick={refresh}
            className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-fta"
          >
            <Activity className="h-3 w-3" />
            Refresh snapshot
          </button>
        </div>
      </main>
    </div>
  );
}
