// Analyst decision breakdown.

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import type { Metrics } from "@/types"

const COLORS: Record<string, string> = {
  Confirmed: "var(--risk-critical)",
  "False positive": "var(--muted-foreground)",
  Escalated: "var(--risk-high)",
  Pending: "var(--primary)",
}

export function DecisionBreakdownChart({ decisions }: { decisions: Metrics["decisions"] }) {
  const data = [
    { name: "Confirmed", value: decisions.confirmed },
    { name: "False positive", value: decisions.false_positive },
    { name: "Escalated", value: decisions.escalated },
    { name: "Pending", value: decisions.pending },
  ].filter((d) => d.value > 0)

  const total = data.reduce((sum, d) => sum + d.value, 0) || 1

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No decisions recorded yet.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        {/* stroke matches the card background instead of Recharts' default
            white, so slice dividers don't flash white in dark mode */}
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2} stroke="var(--card)">
          {data.map((d) => (
            <Cell key={d.name} fill={COLORS[d.name]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
          labelStyle={{ color: "var(--foreground)" }}
          formatter={(value) => [`${Math.round((Number(value) / total) * 100)}%`, "Share"]}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
