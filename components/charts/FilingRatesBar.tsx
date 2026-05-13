"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";

interface RateRow {
  tax_type: string;
  rate_all_pct: number;
  rate_large_pct: number;
}

function colorFor(rate: number): string {
  if (rate >= 90) return "#10B981";
  if (rate >= 75) return "#3B82F6";
  if (rate >= 50) return "#F59E0B";
  return "#EF4444";
}

export function FilingRatesBar({ data }: { data: RateRow[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="tax_type"
            tick={{ fill: "#9CA3AF", fontSize: 11 }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "#9CA3AF", fontSize: 11 }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              background: "#2F343D",
              border: "1px solid rgba(99,102,241,0.3)",
              borderRadius: 8,
              fontSize: 11,
            }}
            labelStyle={{ color: "#E5E7EB" }}
            itemStyle={{ color: "#E5E7EB" }}
            formatter={(v) => `${Number(v).toFixed(1)}%`}
          />
          <Bar dataKey="rate_all_pct" name="All taxpayers" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={`a${i}`} fill={colorFor(d.rate_all_pct)} />
            ))}
          </Bar>
          <Bar dataKey="rate_large_pct" name="Large taxpayers" radius={[4, 4, 0, 0]} fillOpacity={0.5}>
            {data.map((d, i) => (
              <Cell key={`l${i}`} fill={colorFor(d.rate_large_pct)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
