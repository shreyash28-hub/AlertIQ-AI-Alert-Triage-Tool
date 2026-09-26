import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { Metrics } from "@/types"

const COLORS: Record<string, string> = {
  Critical: "var(--risk-critical)",
  High: "var(--risk-high)",
  Medium: "var(--risk-medium)",
  Low: "var(--risk-low)",
}

export function IncidentsByLevelChart({ byLevel }: { byLevel: Metrics["by_level"] }) {
  const total = byLevel.critical + byLevel.high + byLevel.medium + byLevel.low || 1
  const data = [
    { level: "Critical", count: byLevel.critical },
    { level: "High", count: byLevel.high },
    { level: "Medium", count: byLevel.medium },
    { level: "Low", count: byLevel.low },
  ]

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="level" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.4 }}
          contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
          labelStyle={{ color: "var(--foreground)" }}
          formatter={(value) => [`${Math.round((Number(value) / total) * 100)}%`, "Share"]}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.level} fill={COLORS[d.level]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
