import { useQuery } from "@tanstack/react-query"
import { CheckCircle2, XCircle } from "lucide-react"
import { DecisionBreakdownChart } from "@/components/charts/DecisionBreakdownChart"
import { IncidentsByOwnerChart } from "@/components/charts/IncidentsByOwnerChart"
import { MtttChart } from "@/components/charts/MtttChart"
import { NoiseFunnelChart } from "@/components/charts/NoiseFunnelChart"
import { RiskScoreDistributionChart } from "@/components/charts/RiskScoreDistributionChart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api"

export default function Metrics() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["metrics"],
    queryFn: () => api.getMetrics(),
  })

  const { data: incidents } = useQuery({
    queryKey: ["incidents", "all"],
    queryFn: () => api.listIncidents(),
  })

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>
  if (isError || !data) return <p className="text-sm text-destructive">Could not load metrics.</p>

  const [foundStr, plantedStr] = data.planted_attacks_in_top5.split("/")
  const allFound = foundStr === plantedStr

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Metrics</h1>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="lift">
          <CardHeader><CardTitle className="text-base">Estimated triage time (assumes 1 min/alert vs 2 min/incident)</CardTitle></CardHeader>
          <CardContent>
            <MtttChart manualHours={data.mttt_manual_hours} toolHours={data.mttt_tool_hours} />
          </CardContent>
        </Card>

        <Card className="lift">
          <CardHeader><CardTitle className="text-base">Alerts to incidents funnel</CardTitle></CardHeader>
          <CardContent>
            <NoiseFunnelChart
              totalAlerts={data.total_alerts}
              totalIncidents={data.total_incidents}
              criticalCount={data.by_level.critical}
            />
          </CardContent>
        </Card>

        <Card className="lift">
          <CardHeader><CardTitle className="text-base">Detection check (synthetic test data)</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-3">
            {allFound ? (
              <CheckCircle2 className="size-8 text-green-500" />
            ) : (
              <XCircle className="size-8 text-risk-high" />
            )}
            <div>
              <p className="font-mono text-2xl font-semibold">{data.planted_attacks_in_top5}</p>
              <p className="text-sm text-muted-foreground">planted attacks ranked in the top 5</p>
            </div>
          </CardContent>
        </Card>

        <Card className="lift">
          <CardHeader><CardTitle className="text-base">Analyst decisions</CardTitle></CardHeader>
          <CardContent>
            <DecisionBreakdownChart decisions={data.decisions} />
          </CardContent>
        </Card>

        <Card className="lift">
          <CardHeader><CardTitle className="text-base">Risk score distribution</CardTitle></CardHeader>
          <CardContent>
            <RiskScoreDistributionChart incidents={incidents ?? []} />
          </CardContent>
        </Card>

        <Card className="lift">
          <CardHeader><CardTitle className="text-base">Incidents by asset owner</CardTitle></CardHeader>
          <CardContent>
            <IncidentsByOwnerChart incidents={incidents ?? []} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
