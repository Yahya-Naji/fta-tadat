"use client";

/**
 * Simple 180° gauge for percentage values. Pure SVG — no chart lib needed.
 */
export function Gauge({
  value,
  label,
  thresholds = [50, 75, 90], // C, B, A
}: {
  value: number;
  label: string;
  thresholds?: [number, number, number];
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const angle = (clamped / 100) * 180;
  const colors = (() => {
    if (clamped >= thresholds[2]) return { fill: "#10B981", text: "text-emerald-400" };
    if (clamped >= thresholds[1]) return { fill: "#3B82F6", text: "text-blue-400" };
    if (clamped >= thresholds[0]) return { fill: "#F59E0B", text: "text-amber-400" };
    return { fill: "#EF4444", text: "text-red-400" };
  })();
  const cx = 80, cy = 80, r = 60;
  const rad = ((angle - 180) * Math.PI) / 180;
  const x = cx + r * Math.cos(rad);
  const y = cy + r * Math.sin(rad);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 160 100" width="180" height="110">
        {/* track */}
        <path
          d={`M 20 80 A 60 60 0 0 1 140 80`}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="14"
          strokeLinecap="round"
        />
        {/* value arc */}
        <path
          d={`M 20 80 A 60 60 0 ${angle > 180 ? 1 : 0} 1 ${x} ${y}`}
          fill="none"
          stroke={colors.fill}
          strokeWidth="14"
          strokeLinecap="round"
        />
        <text
          x="80"
          y="76"
          textAnchor="middle"
          fontSize="22"
          fontFamily="ui-monospace, monospace"
          fontWeight="700"
          fill="#E5E7EB"
        >
          {clamped.toFixed(1)}%
        </text>
      </svg>
      <div className={`text-[10px] font-mono uppercase tracking-widest ${colors.text}`}>
        {label}
      </div>
    </div>
  );
}
