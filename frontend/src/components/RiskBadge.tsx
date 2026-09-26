import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { RiskLevel } from "@/types"

const styles: Record<RiskLevel, string> = {
  Critical: "bg-risk-critical-bg text-risk-critical border-risk-critical/30",
  High: "bg-risk-high-bg text-risk-high border-risk-high/30",
  Medium: "bg-risk-medium-bg text-risk-medium border-risk-medium/30",
  Low: "bg-risk-low-bg text-risk-low border-risk-low/30",
}

// A soft pulse on Critical only - "urgency without noise" (blueprint's
// animation rules), and it respects prefers-reduced-motion via the
// motion-safe: variant.
const pulse: Record<RiskLevel, string> = {
  Critical: "motion-safe:animate-pulse",
  High: "",
  Medium: "",
  Low: "",
}

export function RiskBadge({ level, className }: { level: RiskLevel; className?: string }) {
  return (
    <Badge variant="outline" className={cn(styles[level], pulse[level], className)}>
      {level}
    </Badge>
  )
}
