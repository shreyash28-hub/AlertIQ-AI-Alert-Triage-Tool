// Placeholder: Phase 6 builds the full page (before/after chart, noise
// funnel, detection check, decision breakdown). This proves the /api/metrics
// call works end to end.

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function Metrics() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["metrics"],
    queryFn: () => api.getMetrics(),
  })

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>
  if (isError || !data) return <p className="text-sm text-destructive">Could not load metrics.</p>

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Metrics</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground">Alerts</p>
            <p className="font-mono text-lg">{data.total_alerts}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Incidents</p>
            <p className="font-mono text-lg">{data.total_incidents}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Noise reduced</p>
            <p className="font-mono text-lg">{data.noise_reduction_pct}%</p>
          </div>
          <div>
            <p className="text-muted-foreground">Planted attacks in top 5</p>
            <p className="font-mono text-lg">{data.planted_attacks_in_top5}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
