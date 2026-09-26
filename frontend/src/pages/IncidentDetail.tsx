import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Check, Loader2, Pencil, RefreshCw, Server } from "lucide-react"
import { useEffect, useState } from "react"
import { motion } from "motion/react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { AlertTimeline } from "@/components/AlertTimeline"
import { AttackChain } from "@/components/AttackChain"
import { DecisionButtons } from "@/components/DecisionButtons"
import { RiskBadge } from "@/components/RiskBadge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"

export default function IncidentDetail() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")

  const { data: incident, isLoading, isError } = useQuery({
    queryKey: ["incident", id],
    queryFn: () => api.getIncident(id!),
    enabled: !!id,
  })

  useEffect(() => {
    if (incident) setDraft(incident.ai_brief ?? "")
  }, [incident])

  const regenerate = useMutation({
    mutationFn: () => api.summarizeIncident(id!),
    onSuccess: () => {
      toast.success("Brief regenerated")
      queryClient.invalidateQueries({ queryKey: ["incident", id] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const saveEdit = useMutation({
    mutationFn: () => api.editBrief(id!, draft),
    onSuccess: () => {
      toast.success("Brief saved")
      setEditing(false)
      queryClient.invalidateQueries({ queryKey: ["incident", id] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>
  if (isError || !incident) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-destructive">Incident not found.</p>
        <Button variant="outline" onClick={() => navigate("/app")} className="w-fit">
          <ArrowLeft className="size-4" /> Back to dashboard
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Link to="/app" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Dashboard
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex flex-wrap items-center gap-3"
      >
        <h1 className="font-mono text-2xl font-semibold tracking-tight">{incident.incident_id}</h1>
        <RiskBadge level={incident.risk_level} />
        <span className="font-mono text-lg text-muted-foreground">{incident.risk_score.toFixed(1)}</span>
        <Badge variant="outline">{incident.status}</Badge>
      </motion.div>
      <p className="-mt-4 text-muted-foreground">{incident.title}</p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">AI brief</CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => regenerate.mutate()}
                  disabled={regenerate.isPending || editing}
                >
                  {regenerate.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3.5" />
                  )}
                  Regenerate
                </Button>
                {editing ? (
                  <Button size="sm" onClick={() => saveEdit.mutate()} disabled={saveEdit.isPending}>
                    {saveEdit.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                    Save
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                    <Pencil className="size-3.5" /> Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {editing ? (
                <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={6} />
              ) : (
                <p className="whitespace-pre-line text-sm">{incident.ai_brief || "No brief yet."}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Attack chain</CardTitle></CardHeader>
            <CardContent><AttackChain techniques={incident.techniques} /></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Alert timeline ({incident.alerts.length})</CardTitle></CardHeader>
            <CardContent><AlertTimeline alerts={incident.alerts} /></CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="flex-row items-center gap-2 space-y-0">
              <Server className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Asset</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5 text-sm">
              <p><span className="text-muted-foreground">Host:</span> <span className="font-mono">{incident.primary_host}</span></p>
              {incident.asset && (
                <>
                  <p><span className="text-muted-foreground">Type:</span> {incident.asset.type}</p>
                  <p><span className="text-muted-foreground">Owner:</span> {incident.asset.owner}</p>
                  <p><span className="text-muted-foreground">Criticality:</span> {incident.asset.criticality}/10</p>
                </>
              )}
              <p><span className="text-muted-foreground">User:</span> {incident.primary_user}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Decision</CardTitle></CardHeader>
            <CardContent>
              <DecisionButtons incidentId={incident.incident_id} />
              {incident.analyst_note && (
                <p className="mt-3 text-sm text-muted-foreground">Note: {incident.analyst_note}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
