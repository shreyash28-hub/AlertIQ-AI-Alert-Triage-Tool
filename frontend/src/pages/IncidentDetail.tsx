// Placeholder: Phase 6 builds the full page (AI brief card, attack chain,
// alert timeline, asset card, decision buttons). This just proves routing
// and the API client work end to end for a single incident.

import { useQuery } from "@tanstack/react-query"
import { useParams } from "react-router-dom"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function IncidentDetail() {
  const { id } = useParams<{ id: string }>()

  const { data: incident, isLoading, isError } = useQuery({
    queryKey: ["incident", id],
    queryFn: () => api.getIncident(id!),
    enabled: !!id,
  })

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>
  if (isError || !incident) return <p className="text-sm text-destructive">Incident not found.</p>

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{incident.incident_id}</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{incident.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p>Risk: {incident.risk_level} ({incident.risk_score})</p>
          <p>Host: {incident.primary_host}</p>
          <p>Alerts: {incident.alert_count}</p>
          <p className="whitespace-pre-line">{incident.ai_brief}</p>
        </CardContent>
      </Card>
    </div>
  )
}
