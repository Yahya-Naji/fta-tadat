"use client";

/**
 * RiskHeatmap — Hamad's signature chart.
 *
 *   likelihood (x) × impact (y) bubble chart, bubble size = AED at risk,
 *   colour = source (data-derived | tadat-illustrative | fta-internal).
 *
 * Pure SVG, no chart library — keeps the bundle small and the styling
 * native to our Tailwind theme. Hover a bubble to see the risk title +
 * AED at risk in a tooltip.
 */
import * as React from "react";

export interface RiskItem {
  name: string;
  segment?: string;
  likelihood?: "Low" | "Medium" | "High" | string;
  impact?: "Low" | "Medium" | "High" | string;
  estimated_aed_at_risk?: number | null;
  source?: "data-derived" | "tadat-illustrative" | "fta-internal" | string;
}

interface RiskHeatmapProps {
  risks: RiskItem[];
  className?: string;
}

const W = 560;
const H = 320;
const PAD_L = 56;
const PAD_R = 24;
const PAD_T = 16;
const PAD_B = 40;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

function levelToPct(v: string | undefined): number {
  switch ((v ?? "").toLowerCase()) {
    case "low":
      return 0.18;
    case "medium":
      return 0.5;
    case "high":
      return 0.82;
  }
  return 0.5;
}

function bubbleR(aed: number | null | undefined, maxAed: number): number {
  const min = 8;
  const max = 32;
  if (!aed || aed <= 0 || maxAed <= 0) return min;
  return Math.round(min + (Math.sqrt(aed / maxAed)) * (max - min));
}

const SOURCE_FILL: Record<string, string> = {
  "data-derived": "rgba(244, 63, 94, 0.65)",      // rose-500
  "tadat-illustrative": "rgba(167, 139, 250, 0.65)", // violet-400
  "fta-internal": "rgba(201, 165, 91, 0.65)",    // gold
};

const SOURCE_STROKE: Record<string, string> = {
  "data-derived": "rgba(244, 63, 94, 0.95)",
  "tadat-illustrative": "rgba(167, 139, 250, 0.95)",
  "fta-internal": "rgba(201, 165, 91, 0.95)",
};

function fmtAed(n: number | null | undefined): string {
  if (!n) return "—";
  if (Math.abs(n) >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `AED ${(n / 1_000).toFixed(0)}K`;
  return `AED ${n}`;
}

export function RiskHeatmap({ risks, className }: RiskHeatmapProps) {
  const [hover, setHover] = React.useState<number | null>(null);
  const maxAed = React.useMemo(
    () => risks.reduce((m, r) => Math.max(m, r.estimated_aed_at_risk ?? 0), 0),
    [risks],
  );

  if (risks.length === 0) {
    return (
      <div
        className={`glass-panel p-5 flex items-center justify-center min-h-[200px] text-[12.5px] text-gray-500 dark:text-gray-400 italic ${className ?? ""}`}
      >
        No risks logged yet. Run the agent to populate Hamad&apos;s register.
      </div>
    );
  }

  const sources = Array.from(
    new Set(risks.map((r) => r.source ?? "data-derived")),
  );

  return (
    <div className={`glass-panel p-5 ${className ?? ""}`}>
      <div className="flex items-start justify-between mb-3 gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-indigo-500 dark:text-indigo-400">
            Risk heat-map
          </p>
          <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight mt-0.5">
            Likelihood × Impact ·{" "}
            <span className="text-gray-500 dark:text-gray-400 font-normal">
              size = AED at risk
            </span>
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10.5px]">
          {sources.map((s) => (
            <div key={s} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: SOURCE_FILL[s] ?? SOURCE_FILL["data-derived"] }}
              />
              <span className="text-gray-600 dark:text-gray-400 font-mono">
                {s}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto select-none"
          aria-label="Risk heat-map: likelihood vs impact"
        >
          {/* Quadrant tint */}
          <rect
            x={PAD_L + PLOT_W / 2}
            y={PAD_T}
            width={PLOT_W / 2}
            height={PLOT_H / 2}
            fill="rgba(244, 63, 94, 0.06)"
          />
          <rect
            x={PAD_L}
            y={PAD_T + PLOT_H / 2}
            width={PLOT_W / 2}
            height={PLOT_H / 2}
            fill="rgba(16, 185, 129, 0.05)"
          />

          {/* Grid */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={`v-${t}`}>
              <line
                x1={PAD_L + t * PLOT_W}
                y1={PAD_T}
                x2={PAD_L + t * PLOT_W}
                y2={PAD_T + PLOT_H}
                stroke="currentColor"
                strokeOpacity={0.08}
              />
              <line
                x1={PAD_L}
                y1={PAD_T + t * PLOT_H}
                x2={PAD_L + PLOT_W}
                y2={PAD_T + t * PLOT_H}
                stroke="currentColor"
                strokeOpacity={0.08}
              />
            </g>
          ))}

          {/* Axes */}
          <line
            x1={PAD_L}
            y1={PAD_T + PLOT_H}
            x2={PAD_L + PLOT_W}
            y2={PAD_T + PLOT_H}
            stroke="currentColor"
            strokeOpacity={0.25}
          />
          <line
            x1={PAD_L}
            y1={PAD_T}
            x2={PAD_L}
            y2={PAD_T + PLOT_H}
            stroke="currentColor"
            strokeOpacity={0.25}
          />

          {/* Axis labels */}
          {(["Low", "Medium", "High"] as const).map((lvl, i) => {
            const pct = i === 0 ? 0.18 : i === 1 ? 0.5 : 0.82;
            return (
              <g key={`xl-${lvl}`}>
                <text
                  x={PAD_L + pct * PLOT_W}
                  y={PAD_T + PLOT_H + 18}
                  textAnchor="middle"
                  className="text-[9px] fill-current text-gray-500 dark:text-gray-400 font-mono uppercase tracking-wider"
                >
                  {lvl}
                </text>
                <text
                  x={PAD_L - 12}
                  y={PAD_T + (1 - pct) * PLOT_H + 3}
                  textAnchor="end"
                  className="text-[9px] fill-current text-gray-500 dark:text-gray-400 font-mono uppercase tracking-wider"
                >
                  {lvl}
                </text>
              </g>
            );
          })}

          {/* X axis title */}
          <text
            x={PAD_L + PLOT_W / 2}
            y={PAD_T + PLOT_H + 34}
            textAnchor="middle"
            className="text-[9px] fill-current text-gray-400 dark:text-gray-500 font-mono uppercase tracking-[0.18em]"
          >
            Likelihood →
          </text>
          {/* Y axis title */}
          <text
            x={-(PAD_T + PLOT_H / 2)}
            y={14}
            transform="rotate(-90)"
            textAnchor="middle"
            className="text-[9px] fill-current text-gray-400 dark:text-gray-500 font-mono uppercase tracking-[0.18em]"
          >
            ← Impact
          </text>

          {/* Bubbles */}
          {risks.map((r, i) => {
            const cx = PAD_L + levelToPct(r.likelihood) * PLOT_W;
            const cy = PAD_T + (1 - levelToPct(r.impact)) * PLOT_H;
            const radius = bubbleR(r.estimated_aed_at_risk, maxAed);
            const fill =
              SOURCE_FILL[r.source ?? ""] ?? SOURCE_FILL["data-derived"];
            const stroke =
              SOURCE_STROKE[r.source ?? ""] ?? SOURCE_STROKE["data-derived"];
            const isHover = hover === i;
            return (
              <g
                key={`${r.name}-${i}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "pointer" }}
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isHover ? 2.5 : 1.5}
                  opacity={hover === null || isHover ? 1 : 0.5}
                />
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {hover !== null && (
          <div className="absolute top-1 right-1 max-w-[260px] rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1e2128] shadow-lg shadow-black/10 dark:shadow-black/40 p-3 pointer-events-none">
            <p className="text-[11.5px] font-semibold text-gray-900 dark:text-white leading-snug">
              {risks[hover].name}
            </p>
            <div className="mt-1 grid grid-cols-2 gap-1 text-[10.5px]">
              <span className="text-gray-500 dark:text-gray-400">Likelihood</span>
              <span className="text-right text-gray-700 dark:text-gray-300">
                {risks[hover].likelihood ?? "—"}
              </span>
              <span className="text-gray-500 dark:text-gray-400">Impact</span>
              <span className="text-right text-gray-700 dark:text-gray-300">
                {risks[hover].impact ?? "—"}
              </span>
              <span className="text-gray-500 dark:text-gray-400">Segment</span>
              <span className="text-right text-gray-700 dark:text-gray-300">
                {risks[hover].segment ?? "—"}
              </span>
              <span className="text-gray-500 dark:text-gray-400">AED at risk</span>
              <span className="text-right font-mono text-gray-900 dark:text-white">
                {fmtAed(risks[hover].estimated_aed_at_risk)}
              </span>
              <span className="text-gray-500 dark:text-gray-400">Source</span>
              <span className="text-right text-gray-700 dark:text-gray-300 font-mono">
                {risks[hover].source ?? "data-derived"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
