import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  color = "text-emerald-300",
  hint,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  color?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.07] backdrop-blur-sm px-4 py-3 flex items-center gap-3">
      <Icon className={`h-5 w-5 shrink-0 ${color}`} />
      <div className="flex-1">
        <div className="text-[11px] text-white/45 leading-tight">{label}</div>
        <div className="text-lg font-bold text-white leading-tight tabular-nums">
          {value}
        </div>
        {hint && (
          <div className="text-[10px] text-white/35 mt-0.5">{hint}</div>
        )}
      </div>
    </div>
  );
}
