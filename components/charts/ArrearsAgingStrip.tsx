"use client";

interface Bucket {
  age_bucket: string;
  cases: number;
  amount_aed: number;
}

const COLORS: Record<string, string> = {
  "0-30": "#10B981",
  "31-90": "#3B82F6",
  "91-365": "#F59E0B",
  ">365": "#EF4444",
};

export function ArrearsAgingStrip({ data }: { data: Bucket[] }) {
  const totalAmount = data.reduce((s, d) => s + d.amount_aed, 0);
  return (
    <div>
      <div className="flex h-7 w-full overflow-hidden rounded-md">
        {data.map((b) => {
          const pct = totalAmount ? (b.amount_aed / totalAmount) * 100 : 0;
          return (
            <div
              key={b.age_bucket}
              className="flex items-center justify-center text-[10px] font-bold text-white/90"
              style={{
                width: `${pct}%`,
                background: COLORS[b.age_bucket],
                minWidth: pct > 4 ? undefined : 0,
              }}
              title={`${b.age_bucket}: AED ${b.amount_aed.toLocaleString()} (${b.cases} cases)`}
            >
              {pct >= 7 && `${pct.toFixed(0)}%`}
            </div>
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {data.map((b) => (
          <div key={b.age_bucket} className="rounded-md border border-white/5 bg-white/[0.03] p-2">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-gray-400">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: COLORS[b.age_bucket] }}
              />
              {b.age_bucket}d
            </div>
            <div className="mt-0.5 font-mono text-sm font-bold text-white tabular-nums">
              {(b.amount_aed / 1_000_000).toFixed(1)}M
            </div>
            <div className="text-[10px] text-gray-500">{b.cases} cases</div>
          </div>
        ))}
      </div>
    </div>
  );
}
