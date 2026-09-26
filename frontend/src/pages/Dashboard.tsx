// Phase 5 checkpoint: the browser shows the real incident list from the
// backend. Phase 6 replaces this with the full Dashboard (stat cards,
// charts, filters, click-through to Incident detail, decision buttons) and
// splits it into components/{IncidentTable,RiskBadge,StatCard,charts}.tsx.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Play } from "lucide-react"
import { api } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { RiskLevel } from "@/types"

const riskVariant: Record<RiskLevel, string> = {
  Critical: "bg-risk-critical-bg text-risk-critical border-risk-critical/30",
  High: "bg-risk-high-bg text-risk-high border-risk-high/30",
  Medium: "bg-risk-medium-bg text-risk-medium border-risk-medium/30",
  Low: "bg-risk-low-bg text-risk-low border-risk-low/30",
}

export default function Dashboard() {
  const queryClient = useQueryClient()

  const { data: incidents, isLoading, isError, error } = useQuery({
    queryKey: ["incidents"],
    queryFn: () => api.listIncidents(),
  })

  const ingest = useMutation({
    mutationFn: () => api.ingest(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["incidents"] }),
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {incidents ? `${incidents.length} incidents` : "Loading incidents..."}
          </p>
        </div>
        <Button onClick={() => ingest.mutate()} disabled={ingest.isPending}>
          {ingest.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Play className="size-4" />
          )}
          Run triage
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Incidents</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {isError && (
            <p className="text-sm text-destructive">
              Could not reach the API: {(error as Error).message}
            </p>
          )}
          {incidents && incidents.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No incidents yet. Click "Run triage" to generate and score them.
            </p>
          )}
          {incidents && incidents.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Risk</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Host</TableHead>
                  <TableHead>Alerts</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.map((inc) => (
                  <TableRow key={inc.incident_id}>
                    <TableCell>
                      <Badge variant="outline" className={riskVariant[inc.risk_level]}>
                        {inc.risk_level}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">{inc.risk_score.toFixed(1)}</TableCell>
                    <TableCell className="max-w-xs truncate">{inc.title}</TableCell>
                    <TableCell className="font-mono text-sm">{inc.primary_host}</TableCell>
                    <TableCell>{inc.alert_count}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{inc.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
