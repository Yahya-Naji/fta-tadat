"use client";

/**
 * IndicatorPanel — modal that opens when an indicator row is clicked.
 *
 * Renders, side by side:
 *   • TADAT definition — what the indicator measures, scoring method,
 *     A/B/C/D bands from the Field Guide.
 *   • Agent verdict — the score it gave, what evidence supports it
 *     ("how it complied / was violated"), recommendations.
 *
 * Portal-mounted to <body> so it stays viewport-centred even when the
 * trigger row lives inside a transformed/animated ancestor (any
 * `transform: ...` in a parent would otherwise anchor a plain `fixed`
 * element to that ancestor, not the viewport).
 *
 * No Radix Dialog dependency — vanilla React + ESC + click-outside.
 */
import * as React from "react";
import { createPortal } from "react-dom";
import { X, BookOpen, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";

import { ScoreBadge } from "@/components/ScoreBadge";
import {
  findIndicator,
  findDimension,
  type IndicatorDefinition,
  type DimensionDefinition,
} from "@/lib/tadat/indicators";

// ─── Inputs the panel takes ──────────────────────────────────────────────

export interface IndicatorPanelData {
  /** Indicator id or dimension id (e.g. "P2-3" or "P2-3-1"). */
  id: string;
  /** Optional indicator/dimension name from the agent payload. */
  name?: string;
  /** Score the agent gave at this level. */
  score?: string;
  /** Scoring method declared by the agent at this level. */
  scoring_method?: "M1" | "M2" | string;
  /** Agent's finding for this indicator/dim — 1-2 sentences. */
  finding?: string;
  /** Longer detail. */
  detail?: string;
  /** Evidence bullets. */
  evidence?: string[];
  /** TADAT field-guide reference (chapter + page) from the agent. */
  tadat_reference?: string;
  /** The whole indicator's dimension scores, when the agent emits them.  */
  dimension_scores?: Array<{
    dim_id: string;
    dim_name?: string;
    score?: string;
    finding?: string;
    detail?: string;
    evidence?: string[];
  }>;
}

export function IndicatorPanel({
  open,
  data,
  onClose,
}: {
  open: boolean;
  data: IndicatorPanelData | null;
  onClose: () => void;
}) {
  // ESC closes
  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Prevent body scroll when open
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!open || !data || !mounted) return null;

  const def = findIndicator(data.id);
  const dimDef = findDimension(data.id); // null if `data.id` is the indicator itself
  const isDim = dimDef !== null;

  // What to show in the verdict pane comes from the agent's payload.
  const agentScore = data.score;
  const agentFinding = data.finding;
  const agentDetail = data.detail;
  const agentEvidence = data.evidence ?? [];

  // Compliant vs violated heuristic based on score letter.
  const head = (agentScore ?? "").charAt(0).toUpperCase();
  const complianceTone =
    head === "A"
      ? "compliant"
      : head === "B"
        ? "broadly-compliant"
        : head === "C"
          ? "partial"
          : head === "D"
            ? "violated"
            : "unknown";

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="indicator-panel-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-gray-900/60 dark:bg-black/70 backdrop-blur-sm animate-fade-in" />

      {/* Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl bg-white dark:bg-[#1e2128] border border-gray-200 dark:border-white/10 shadow-2xl shadow-black/30 animate-fade-up"
      >
        {/* Top accent */}
        <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500" />

        {/* Header */}
        <div className="flex items-start gap-4 px-6 py-4 border-b border-gray-200 dark:border-white/5">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-500 flex items-center justify-center shadow-md shadow-violet-500/30 shrink-0">
            <BookOpen className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-indigo-500 dark:text-indigo-400">
              {def
                ? `TADAT 2025 · POA ${def.poa} · ${isDim ? "Dimension" : "Indicator"}`
                : "TADAT indicator"}
            </p>
            <h2
              id="indicator-panel-title"
              className="text-xl font-bold text-gray-900 dark:text-white leading-tight mt-0.5"
            >
              <span className="font-mono text-indigo-600 dark:text-indigo-300">
                {data.id}
              </span>
              <span className="mx-2 text-gray-400 dark:text-gray-500">·</span>
              {isDim
                ? dimDef!.dim_name
                : def
                  ? def.name
                  : data.name ?? "Unknown indicator"}
            </h2>
            {def && (
              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                {def.field_guide_ref}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {agentScore && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Score
                </span>
                <ScoreBadge score={agentScore} />
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 inline-flex items-center justify-center rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body — 2-col grid */}
        <div className="grid md:grid-cols-2 gap-0 max-h-[calc(90vh-160px)] overflow-y-auto">
          {/* LEFT — TADAT definition */}
          <div className="p-6 border-b md:border-b-0 md:border-r border-gray-200 dark:border-white/5">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-400 mb-3">
              TADAT Field Guide definition
            </p>

            {def ? (
              <DefinitionView def={def} dimDef={dimDef} />
            ) : (
              <p className="text-[13px] text-gray-700 dark:text-gray-300">
                No canonical TADAT definition cached for{" "}
                <span className="font-mono">{data.id}</span>. Refer to the
                agent&apos;s reference: <em>{data.tadat_reference ?? "—"}</em>.
              </p>
            )}
          </div>

          {/* RIGHT — agent verdict */}
          <div className="p-6 bg-gray-50/50 dark:bg-white/[0.02]">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400 mb-3">
              Agent verdict · how it {complianceTone === "compliant" || complianceTone === "broadly-compliant" ? "complied" : "was violated"}
            </p>

            <ComplianceBanner score={agentScore} tone={complianceTone} />

            {agentFinding && (
              <div className="mt-4">
                <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                  Finding
                </p>
                <p className="text-[13.5px] font-medium text-gray-900 dark:text-white leading-relaxed">
                  {agentFinding}
                </p>
              </div>
            )}

            {agentDetail && (
              <div className="mt-4">
                <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                  Detail
                </p>
                <p className="text-[12.5px] text-gray-700 dark:text-gray-300 leading-relaxed">
                  {agentDetail}
                </p>
              </div>
            )}

            {agentEvidence.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                  Evidence
                </p>
                <ul className="space-y-1.5">
                  {agentEvidence.map((e, i) => (
                    <li
                      key={i}
                      className="flex gap-2 text-[12.5px] text-gray-700 dark:text-gray-300 leading-relaxed"
                    >
                      <span className="text-indigo-500 dark:text-indigo-400 shrink-0">•</span>
                      <span>{e}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Dimension breakdown, only when viewing an indicator (not a dim) */}
            {!isDim && data.dimension_scores && data.dimension_scores.length > 0 && (
              <div className="mt-5 pt-4 border-t border-gray-200 dark:border-white/5">
                <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                  Dimension breakdown
                </p>
                <ul className="space-y-1.5">
                  {data.dimension_scores.map((d) => (
                    <li
                      key={d.dim_id}
                      className="flex items-start justify-between gap-2 rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-gray-500 dark:text-gray-400">
                            {d.dim_id}
                          </span>
                          {d.score && <ScoreBadge score={d.score} />}
                        </div>
                        {d.finding && (
                          <p className="mt-1 text-[11.5px] text-gray-700 dark:text-gray-300 leading-snug">
                            {d.finding}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-white/5 px-6 py-3 flex items-center justify-between bg-gray-50/60 dark:bg-black/20">
          <p className="text-[10.5px] text-gray-500 dark:text-gray-400">
            Definition paraphrased from the IMF TADAT 2025 Field Guide.
          </p>
          <a
            href="https://www.tadat.org/en/the-framework"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-300 hover:underline"
          >
            tadat.org/framework
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────

function DefinitionView({
  def,
  dimDef,
}: {
  def: IndicatorDefinition;
  dimDef: DimensionDefinition | null;
}) {
  // If a dimension was clicked, scope the description + bands to that dim.
  const measures = dimDef ? dimDef.measures : def.measures;
  const bands = dimDef ? dimDef.bands : def.bands;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
          What it measures
        </p>
        <p className="text-[13.5px] text-gray-800 dark:text-gray-200 leading-relaxed">
          {measures}
        </p>
      </div>

      {!dimDef && (
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
            Scoring method
          </p>
          <div className="inline-flex items-center gap-2 rounded-md border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/60 dark:bg-indigo-500/10 px-2.5 py-1">
            <span className="font-mono text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
              {def.scoring_method}
            </span>
            <span className="text-[11px] text-indigo-700/85 dark:text-indigo-300/85">
              {def.scoring_rule}
            </span>
          </div>
        </div>
      )}

      <div>
        <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
          Scoring criteria
        </p>
        <ul className="space-y-1.5">
          {(["A", "B", "C", "D"] as const).map((letter) => (
            <li
              key={letter}
              className="flex items-start gap-3 rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-3 py-2"
            >
              <ScoreBadge score={letter} />
              <p className="text-[12.5px] text-gray-700 dark:text-gray-300 leading-snug flex-1">
                {bands[letter]}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {!dimDef && def.dimensions && def.dimensions.length > 0 && (
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
            Dimensions
          </p>
          <ul className="space-y-1.5">
            {def.dimensions.map((d) => (
              <li
                key={d.dim_id}
                className="rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-3 py-2"
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
                    {d.dim_id}
                  </span>
                  <span className="text-[12px] font-semibold text-gray-800 dark:text-gray-200">
                    {d.dim_name}
                  </span>
                </div>
                <p className="text-[11.5px] text-gray-600 dark:text-gray-400 leading-snug">
                  {d.measures}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ComplianceBanner({
  score,
  tone,
}: {
  score: string | undefined;
  tone: "compliant" | "broadly-compliant" | "partial" | "violated" | "unknown";
}) {
  const conf =
    tone === "compliant"
      ? {
          icon: CheckCircle2,
          label: "Compliant",
          desc: "Meets the highest TADAT band for this indicator. Sustain + document.",
          cls: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300",
        }
      : tone === "broadly-compliant"
        ? {
            icon: CheckCircle2,
            label: "Broadly compliant",
            desc: "Meets most TADAT criteria; targeted gaps to close to reach A.",
            cls: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300",
          }
        : tone === "partial"
          ? {
              icon: AlertCircle,
              label: "Partial compliance",
              desc: "Material gaps against the TADAT criteria — the band-shift to B is the priority recommendation.",
              cls: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300",
            }
          : tone === "violated"
            ? {
                icon: AlertCircle,
                label: "Non-compliant",
                desc: "Fails the TADAT criteria. Surface to leadership; design a remediation plan with KPIs.",
                cls: "border-red-300 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300",
              }
            : {
                icon: AlertCircle,
                label: "Not yet scored",
                desc: "The agent has not produced a score for this indicator yet.",
                cls: "border-gray-300 bg-gray-50 text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-400",
              };
  const Icon = conf.icon;
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${conf.cls}`}>
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold uppercase tracking-wider">
            {conf.label}
          </span>
          {score && (
            <span className="font-mono text-[10px]">band: {score}</span>
          )}
        </div>
        <p className="text-[11.5px] leading-snug mt-0.5 opacity-90">
          {conf.desc}
        </p>
      </div>
    </div>
  );
}
