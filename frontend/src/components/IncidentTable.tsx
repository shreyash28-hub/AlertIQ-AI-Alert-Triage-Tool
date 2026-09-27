// rank, risk badge, score, title, asset + criticality, techniques, alert
// count, status. Filters for level, status and technique; click a row to
// open details. Rows slide in top-risk-first (blueprint's Motion rules).

import { motion } from "motion/react"
import { useNavigate } from "react-router-dom"
import { RiskBadge } from "@/components/RiskBadge"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Incident, IncidentStatus, RiskLevel } from "@/types"

const RISK_LEVELS: RiskLevel[] = ["Critical", "High", "Medium", "Low"]
const STATUSES: IncidentStatus[] = ["New", "Confirmed", "False positive", "Escalated"]

export interface IncidentFilterState {
  level: string
  status: string
  technique: string
}

export function IncidentTable({
  incidents,
  filters,
  onFiltersChange,
  techniqueOptions,
}: {
  incidents: Incident[]
  filters: IncidentFilterState
  onFiltersChange: (filters: IncidentFilterState) => void
  techniqueOptions: string[]
}) {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Select
          value={filters.level || "all"}
          onValueChange={(v) => onFiltersChange({ ...filters, level: v === "all" ? "" : v })}
        >
          <SelectTrigger className="w-36"><SelectValue placeholder="Level" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            {RISK_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select
          value={filters.status || "all"}
          onValueChange={(v) => onFiltersChange({ ...filters, status: v === "all" ? "" : v })}
        >
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select
          value={filters.technique || "all"}
          onValueChange={(v) => onFiltersChange({ ...filters, technique: v === "all" ? "" : v })}
        >
          <SelectTrigger className="w-40"><SelectValue placeholder="Technique" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All techniques</SelectItem>
            {techniqueOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>Risk</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Asset</TableHead>
            <TableHead>Techniques</TableHead>
            <TableHead>Alerts</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {incidents.map((inc, i) => (
            <motion.tr
              key={inc.incident_id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.4) }}
              onClick={() => navigate(`/app/incidents/${inc.incident_id}`)}
              className={cn(
                "cursor-pointer border-b transition-[background-color,opacity] duration-300 hover:bg-muted/50",
                inc.status === "Confirmed" && "bg-green-500/10",
                inc.status === "Escalated" && "bg-risk-high-bg",
                inc.status === "False positive" && "opacity-50",
              )}
            >
              <TableCell className="text-muted-foreground">{i + 1}</TableCell>
              <TableCell><RiskBadge level={inc.risk_level} /></TableCell>
              <TableCell className="font-mono">{inc.risk_score.toFixed(1)}</TableCell>
              <TableCell className="max-w-xs truncate">{inc.title}</TableCell>
              <TableCell>
                <span className="font-mono text-sm">{inc.primary_host}</span>
                {inc.asset && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    (crit. {inc.asset.criticality})
                  </span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {inc.techniques.slice(0, 3).map((t) => (
                    <Badge key={t} variant="secondary" className="font-mono text-xs">
                      {t}
                    </Badge>
                  ))}
                  {inc.techniques.length > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{inc.techniques.length - 3}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>{inc.alert_count}</TableCell>
              <TableCell><Badge variant="outline">{inc.status}</Badge></TableCell>
            </motion.tr>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
