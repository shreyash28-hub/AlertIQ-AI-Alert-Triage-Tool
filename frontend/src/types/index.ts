// Mirrors backend/models.py and supabase/migrations/001_schema.sql.

export type RiskLevel = "Critical" | "High" | "Medium" | "Low"

export type IncidentStatus = "New" | "Confirmed" | "False positive" | "Escalated"

export type Decision = "confirmed" | "false_positive" | "escalated"

export interface Asset {
  host: string
  type: string
  owner: string
  criticality: number
}

export interface Alert {
  alert_id: string
  timestamp: string
  source: string
  alert_type: string
  severity: number
  host: string
  user_name: string
  src_ip: string
  dest_ip: string
  raw_message: string
  is_true_positive: boolean
}

// The shape GET /api/incidents returns (list view).
export interface Incident {
  incident_id: string
  title: string
  primary_host: string
  primary_user: string
  alert_count: number
  start_time: string
  end_time: string
  techniques: string[]
  tactics: string[]
  risk_score: number
  risk_level: RiskLevel
  ai_brief: string | null
  status: IncidentStatus
  analyst_note: string | null
  decided_at: string | null
  contains_planted_attack: boolean
}

// GET /api/incidents/{id} adds the joined alerts and asset.
export interface IncidentDetail extends Incident {
  alerts: Alert[]
  asset: Asset | null
}

export interface Metrics {
  total_alerts: number
  total_incidents: number
  noise_reduction_pct: number
  by_level: { critical: number; high: number; medium: number; low: number }
  top_techniques: { id: string; count: number }[]
  mttt_manual_hours: number
  mttt_tool_hours: number
  planted_attacks_in_top5: string
  decisions: { confirmed: number; false_positive: number; escalated: number; pending: number }
}

export interface IngestResult {
  run_id: string
  alerts: number
  incidents: number
  duration_ms: number
}
