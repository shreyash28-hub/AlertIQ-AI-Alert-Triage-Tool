// Which business team's assets show up in the most incidents - uses the
// asset embed added in Phase 6 (database.py's fetch_incidents()).

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { Incident } from "@/types"

export function IncidentsByOwnerChart({ incidents }: { incidents: Incident[] }) {
  const counts = new Map<string, number>()
  for (const inc of incidents) {
    const owner = inc.asset?.owner ?? "Unknown"
    counts.set(owner, (counts.get(owner) ?? 0) + 1)
  }
  const data = [...counts.entries()]
    .map(([owner, count]) => ({ owner, count }))
    .sort((a, b) => b.count - a.count)

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No incidents yet.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="owner" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.4 }}
          contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
          labelStyle={{ color: "var(--foreground)" }}
        />
        <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
