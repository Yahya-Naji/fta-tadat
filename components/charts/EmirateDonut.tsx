"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = [
  "#6366F1", "#00A89D", "#A855F7", "#F59E0B", "#10B981",
  "#3B82F6", "#EC4899", "#8B5CF6",
];

export function EmirateDonut({
  data,
}: {
  data: Array<{ emirate: string; count: number }>;
}) {
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div className="flex items-center gap-5">
      <div className="h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="emirate"
              innerRadius={45}
              outerRadius={75}
              strokeWidth={1}
              stroke="#282C34"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "#2F343D",
                border: "1px solid rgba(99,102,241,0.3)",
                borderRadius: 8,
                fontSize: 11,
              }}
              labelStyle={{ color: "#E5E7EB" }}
              itemStyle={{ color: "#E5E7EB" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-1">
        {data.slice(0, 6).map((d, i) => (
          <div key={d.emirate} className="flex items-center gap-2 text-xs">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            <span className="flex-1 text-gray-300">{d.emirate}</span>
            <span className="font-mono text-gray-500 tabular-nums">
              {((d.count / total) * 100).toFixed(1)}%
            </span>
            <span className="font-mono text-gray-200 tabular-nums">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
