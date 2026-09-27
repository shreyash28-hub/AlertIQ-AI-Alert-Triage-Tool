// Live Simulator: a streaming demo so repeated runs don't look identical.
// Entirely separate from the real dataset - nothing here touches Supabase
// (see backend/simulator.py). Ticks every ~1.5s, each time asking the
// backend for a fresh batch of alerts (anchored to right now, mostly
// noise, occasionally a brand-new attack story) and the full, real risk
// score for everything seen so far.

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, Layers, Pause, Play, Radio } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { toast } from "sonner"
import { IncidentTable, type IncidentFilterState } from "@/components/IncidentTable"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { api, type SimulateTickResult } from "@/lib/api"
import type { Incident } from "@/types"

const TICK_MS = 1500

export default function Simulator() {
  const [running, setRunning] = useState(false)
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [totals, setTotals] = useState({ alerts: 0, incidents: 0 })
  const [filters, setFilters] = useState<IncidentFilterState>({ level: "", status: "", technique: "" })
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const busy = useRef(false)

  async function doTick() {
    if (busy.current) return // don't overlap ticks if one is still in flight
    busy.current = true
    try {
      const result: SimulateTickResult = await api.simulateTick()
      setIncidents(result.incidents)
      setTotals({ alerts: result.total_alerts, incidents: result.total_incidents })
      if (result.attack_started) {
        toast.warning(`Attack detected: ${result.attack_started}`, {
          description: "Watch it jump to the top of the table.",
        })
      }
    } catch (err) {
      toast.error((err as Error).message)
      stop()
    } finally {
      busy.current = false
    }
  }

  async function start() {
    await api.simulateStart()
    setIncidents([])
    setTotals({ alerts: 0, incidents: 0 })
    setRunning(true)
    void doTick()
    timer.current = setInterval(doTick, TICK_MS)
  }

  function stop() {
    if (timer.current) clearInterval(timer.current)
    timer.current = null
    setRunning(false)
    void api.simulateStop()
  }

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current)
    // best-effort cleanup if the analyst navigates away mid-session
    void api.simulateStop()
  }, [])

  const techniqueOptions = [...new Set(incidents.flatMap((i) => i.techniques))].sort()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Live Simulator</h1>
          <p className="text-sm text-muted-foreground">
            A streaming feed of synthetic alerts, scored live - every run looks different.
          </p>
        </div>
        <Button onClick={running ? stop : start} variant={running ? "outline" : "default"}>
          {running ? <Pause className="size-4" /> : <Play className="size-4" />}
          {running ? "Stop" : "Start simulation"}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Alerts streamed</p>
              <p className="font-mono text-2xl font-semibold tabular-nums">{totals.alerts}</p>
            </div>
            <AlertTriangle className="size-8 text-primary/60" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Incidents formed</p>
              <p className="font-mono text-2xl font-semibold tabular-nums">{totals.incidents}</p>
            </div>
            <Layers className="size-8 text-primary/60" />
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="flex items-center gap-3">
            <Radio className={running ? "size-6 animate-pulse text-green-500" : "size-6 text-muted-foreground"} />
            <div>
              <p className="text-sm font-medium">{running ? "Streaming" : "Stopped"}</p>
              <p className="text-xs text-muted-foreground">
                {running ? "new batch every ~1.5s" : "click Start to begin"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Incidents {incidents.length > 0 ? `(${incidents.length})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AnimatePresence mode="wait">
            {incidents.length === 0 ? (
              <motion.p
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-muted-foreground"
              >
                No incidents yet. Click "Start simulation" to begin streaming alerts.
              </motion.p>
            ) : (
              <IncidentTable
                incidents={incidents}
                filters={filters}
                onFiltersChange={setFilters}
                techniqueOptions={techniqueOptions}
                disableRowClick
              />
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  )
}
