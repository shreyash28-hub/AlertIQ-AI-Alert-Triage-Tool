import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Clock, Layers, Loader2, Play, TrendingDown } from "lucide-react"
import { useEffect, useRef, useState } from "react"
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
import type { Incident } from "@/types"

// How long the "incidents pop in one by one" reveal takes to finish for a
// large batch, so it stays satisfying (not a blur) without dragging on for
// a big dataset - see revealIncidents() below.
const REVEAL_TOTAL_MS = 2800
const REVEAL_MIN_STEP_MS = 40

export default function Dashboard() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<IncidentFilterState>({ level: "", status: "", technique: "" })
  const [lastRun, setLastRun] = useState<{ started_at: string; total_alerts: number } | null>(null)
  const [revealed, setRevealed] = useState<Incident[] | null>(null)
  const revealTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useIncidentsRealtime()

  useEffect(() => {
    supabase
      .from("triage_runs")
      .select("started_at,total_alerts")
      .order("started_at", { ascending: false })
      .limit(1)
      .then(({ data }) => setLastRun(data?.[0] ?? null))
  }, [])

  useEffect(() => () => {
    if (revealTimer.current) clearInterval(revealTimer.current)
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

  function revealIncidents(full: Incident[]) {
    if (revealTimer.current) clearInterval(revealTimer.current)
    setRevealed([])
    if (full.length === 0) {
      setRevealed(null)
      return
    }
    const step = Math.max(REVEAL_MIN_STEP_MS, Math.floor(REVEAL_TOTAL_MS / full.length))
    let i = 0
    revealTimer.current = setInterval(() => {
      i += 1
      setRevealed(full.slice(0, i))
      if (i >= full.length) {
        clearInterval(revealTimer.current!)
        revealTimer.current = null
        // hand off to the normal filtered query once the reveal finishes
        setTimeout(() => setRevealed(null), 300)
      }
    }, step)
  }

  const ingest = useMutation({
    mutationFn: () => api.ingest(),
    onSuccess: async (result) => {
      toast.success(`Triage complete: ${result.alerts.toLocaleString()} alerts -> ${result.incidents} incidents`)
      queryClient.invalidateQueries({ queryKey: ["metrics"] })
      supabase
        .from("triage_runs")
        .select("started_at,total_alerts")
        .order("started_at", { ascending: false })
        .limit(1)
        .then(({ data }) => setLastRun(data?.[0] ?? null))

      // fetch the fresh, unfiltered, risk-sorted list and reveal it
      // incident by incident - this is the "wow moment": incidents landing
      // one after another instead of the table just snapping to 38 rows.
      const fresh = await api.listIncidents()
      queryClient.setQueryData(["incidents", "all"], fresh)
      queryClient.setQueryData(["incidents", { level: "", status: "", technique: "" }], fresh)
      revealIncidents(fresh)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const techniqueOptions = [...new Set((allIncidents ?? []).flatMap((i) => i.techniques))].sort()
  const triageTimeSavedHours = metrics ? metrics.mttt_manual_hours - metrics.mttt_tool_hours : 0
  const displayIncidents = revealed ?? incidents

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
        <Button onClick={() => ingest.mutate()} disabled={ingest.isPending || revealed !== null}>
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
            Incidents {displayIncidents ? `(${revealed ? `${revealed.length}/${incidents?.length ?? revealed.length}` : displayIncidents.length})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && !revealed && <p className="text-sm text-muted-foreground">Loading...</p>}
          {isError && !revealed && (
            <p className="text-sm text-destructive">Could not reach the API: {(error as Error).message}</p>
          )}
          {displayIncidents && displayIncidents.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No incidents match these filters. Click "Run triage" to generate and score them.
            </p>
          )}
          {displayIncidents && displayIncidents.length > 0 && (
            <IncidentTable
              incidents={displayIncidents}
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
