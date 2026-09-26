// Histogram of every incident's risk score, in 10-point buckets - shows the
// shape of the ranking (a handful of high scores, a long low tail) rather
// than just the 4 named levels.

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { Incident } from "@/types"

function colorFor(bucketStart: number): string {
  if (bucketStart >= 80) return "var(--risk-critical)"
  if (bucketStart >= 60) return "var(--risk-high)"
  if (bucketStart >= 40) return "var(--risk-medium)"
  return "var(--risk-low)"
}

export function RiskScoreDistributionChart({ incidents }: { incidents: Incident[] }) {
  const buckets = Array.from({ length: 10 }, (_, i) => ({ start: i * 10, count: 0 }))
  for (const inc of incidents) {
    const idx = Math.min(Math.floor(inc.risk_score / 10), 9)
    buckets[idx].count += 1
  }
  const data = buckets.map((b) => ({ range: `${b.start}`, count: b.count, start: b.start }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="range"
          stroke="var(--muted-foreground)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          label={{ value: "Risk score", position: "insideBottom", offset: -2, fill: "var(--muted-foreground)", fontSize: 11 }}
        />
        <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.4 }}
          contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
          labelStyle={{ color: "var(--foreground)" }}
          formatter={(value, _n, item) => [value, `Score ${item.payload.start}-${item.payload.start + 9}`]}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.range} fill={colorFor(d.start)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
