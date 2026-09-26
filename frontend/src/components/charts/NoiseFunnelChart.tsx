// Noise funnel: alerts -> incidents -> critical incidents. A simple
// horizontal bar comparison reads more reliably than a true funnel shape
// at this scale (3 stages, huge range) while still telling the story.

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

export function NoiseFunnelChart({
  totalAlerts,
  totalIncidents,
  criticalCount,
}: {
  totalAlerts: number
  totalIncidents: number
  criticalCount: number
}) {
  const data = [
    { stage: "Alerts", count: totalAlerts },
    { stage: "Incidents", count: totalIncidents },
    { stage: "Critical", count: criticalCount },
  ]

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" scale="log" domain={[1, "auto"]} allowDataOverflow hide />
        <YAxis
          type="category"
          dataKey="stage"
          stroke="var(--muted-foreground)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={70}
        />
        <Tooltip
          contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
          labelStyle={{ color: "var(--foreground)" }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          <Cell fill="var(--muted-foreground)" />
          <Cell fill="var(--primary)" />
          <Cell fill="var(--risk-critical)" />
          <LabelList dataKey="count" position="right" fill="var(--foreground)" fontSize={12} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
