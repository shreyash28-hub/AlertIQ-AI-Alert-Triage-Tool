// Before/after triage time comparison.

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

export function MtttChart({ manualHours, toolHours }: { manualHours: number; toolHours: number }) {
  const data = [
    { label: "Manual", hours: manualHours },
    { label: "With AlertIQ", hours: toolHours },
  ]

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis
          stroke="var(--muted-foreground)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          unit="h"
        />
        <Tooltip
          contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
          labelStyle={{ color: "var(--foreground)" }}
          formatter={(v) => [`${v} h`, "Time"]}
        />
        <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
          <Cell fill="var(--muted-foreground)" />
          <Cell fill="var(--primary)" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
