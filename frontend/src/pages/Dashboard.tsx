import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Clock, Layers, Loader2, Play, TrendingDown } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { IncidentTable, type IncidentFilterState } from "@/components/IncidentTable"
import { StatCard } from "@/components/StatCard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { IncidentsByLevelChart } from "@/components/charts/IncidentsByLevelChart"
import { TopTechniquesChart } from "@/components/charts/TopTechniquesChart"
import { api } from "@/lib/api"
import { useIncidentsRealtime } from "@/lib/useRealtime"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"

export default function Dashboard() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<IncidentFilterState>({ level: "", status: "", technique: "" })
  const [lastRun, setLastRun] = useState<{ started_at: string; total_alerts: number } | null>(null)

  useIncidentsRealtime()

  useEffect(() => {
    supabase
      .from("triage_runs")
      .select("started_at,total_alerts")
      .order("started_at", { ascending: false })
      .limit(1)
      .then(({ data }) => setLastRun(data?.[0] ?? null))
  }, [])

  const { data: incidents, isLoading, isError, error } = useQuery({
    queryKey: ["incidents", filters],
    queryFn: () => api.listIncidents({
      level: filters.level || undefined,
      status: filters.status || undefined,
      technique: filters.technique || undefined,
    }),
  })

  // unfiltered, just to populate the technique dropdown - so its options
  // don't shrink to only what's currently visible once a filter is applied
  const { data: allIncidents } = useQuery({
    queryKey: ["incidents", "all"],
    queryFn: () => api.listIncidents(),
  })

  const { data: metrics } = useQuery({
    queryKey: ["metrics"],
    queryFn: () => api.getMetrics(),
  })

  const ingest = useMutation({
    mutationFn: () => api.ingest(),
    onSuccess: (result) => {
      toast.success(`Triage complete: ${result.alerts.toLocaleString()} alerts -> ${result.incidents} incidents`)
      queryClient.invalidateQueries({ queryKey: ["incidents"] })
      queryClient.invalidateQueries({ queryKey: ["metrics"] })
      supabase
        .from("triage_runs")
        .select("started_at,total_alerts")
        .order("started_at", { ascending: false })
        .limit(1)
        .then(({ data }) => setLastRun(data?.[0] ?? null))
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const techniqueOptions = [...new Set((allIncidents ?? []).flatMap((i) => i.techniques))].sort()
  const triageTimeSavedHours = metrics ? metrics.mttt_manual_hours - metrics.mttt_tool_hours : 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {lastRun
              ? `Last run: ${new Date(lastRun.started_at).toLocaleString()} - ${lastRun.total_alerts.toLocaleString()} alerts`
              : "No triage run yet"}
          </p>
        </div>
        <Button onClick={() => ingest.mutate()} disabled={ingest.isPending}>
          {ingest.isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          Run triage
        </Button>
      </div>

      {metrics && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total alerts" value={metrics.total_alerts} icon={AlertTriangle} />
          <StatCard label="Incidents" value={metrics.total_incidents} icon={Layers} />
          <StatCard label="Noise reduced" value={metrics.noise_reduction_pct} suffix="%" decimals={1} icon={TrendingDown} />
          <StatCard label="Triage time saved" value={triageTimeSavedHours} suffix="h" decimals={1} icon={Clock} />
        </div>
      )}

      {metrics && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Incidents by risk level</CardTitle></CardHeader>
            <CardContent><IncidentsByLevelChart byLevel={metrics.by_level} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Top MITRE techniques</CardTitle></CardHeader>
            <CardContent><TopTechniquesChart topTechniques={metrics.top_techniques} /></CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Incidents {incidents ? `(${incidents.length})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {isError && (
            <p className="text-sm text-destructive">Could not reach the API: {(error as Error).message}</p>
          )}
          {incidents && incidents.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No incidents match these filters. Click "Run triage" to generate and score them.
            </p>
          )}
          {incidents && incidents.length > 0 && (
            <IncidentTable
              incidents={incidents}
              filters={filters}
              onFiltersChange={setFilters}
              techniqueOptions={techniqueOptions}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
