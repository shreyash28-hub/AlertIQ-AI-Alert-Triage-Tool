// Grouped alerts in time order.

import { AlertCircle } from "lucide-react"
import type { Alert } from "@/types"

const severityColor = (s: number) =>
  s >= 5 ? "text-risk-critical" : s >= 4 ? "text-risk-high" : s >= 3 ? "text-risk-medium" : "text-muted-foreground"

export function AlertTimeline({ alerts }: { alerts: Alert[] }) {
  const sorted = [...alerts].sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  return (
    <ol className="flex flex-col gap-3">
      {sorted.map((a) => (
        <li key={a.alert_id} className="flex gap-3 border-l-2 border-border pl-3">
          <AlertCircle className={`mt-0.5 size-4 shrink-0 ${severityColor(a.severity)}`} />
          <div className="flex-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-mono text-xs text-muted-foreground">{a.timestamp}</span>
              <span className="text-sm font-medium">{a.alert_type}</span>
              <span className="text-xs text-muted-foreground">sev {a.severity}</span>
            </div>
            <p className="text-sm text-muted-foreground">{a.raw_message}</p>
            <p className="font-mono text-xs text-muted-foreground/70">
              {a.host} - {a.user_name} - {a.src_ip} to {a.dest_ip}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}
