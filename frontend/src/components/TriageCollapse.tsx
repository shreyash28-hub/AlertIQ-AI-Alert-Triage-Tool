// The "Run triage" wow moment (blueprint section 9: "Loader, then alerts
// visibly collapse into incidents"). While the pipeline runs, a field of
// dots (one dot stands for a slice of the raw alerts - capped so the page
// stays fast) drifts gently. When the run finishes, every dot flies to the
// cluster it belongs to and fades, and one chip per incident (coloured by
// its real risk level, highest risk first) pops in where the clusters were.
//
// Reduced motion: no drifting or flying - the final chips and caption are
// shown straight away.

import { motion, useReducedMotion } from "motion/react"
import type { RiskLevel } from "@/types"

export type CollapsePhase = "idle" | "running" | "collapsing" | "done"

const MAX_DOTS = 180
const CHIP_COLORS: Record<RiskLevel, string> = {
  Critical: "bg-risk-critical",
  High: "bg-risk-high",
  Medium: "bg-risk-medium",
  Low: "bg-risk-low",
}

// deterministic pseudo-random in [0,1) so dots don't jump around on re-render
const rand = (i: number, salt: number) => {
  const s = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return s - Math.floor(s)
}

export function TriageCollapse({
  phase,
  alerts,
  levels,
}: {
  phase: CollapsePhase
  alerts: number
  levels: RiskLevel[]
}) {
  const reduceMotion = useReducedMotion()
  if (phase === "idle") return null

  const incidents = levels.length
  const dotCount = Math.min(alerts > 0 ? alerts : MAX_DOTS, MAX_DOTS)
  const collapsed = phase === "collapsing" || phase === "done"

  // chips laid out in two rows; cluster c sits where chip c sits
  const cols = Math.max(Math.ceil(incidents / 2), 1)
  const centre = (c: number) => ({
    x: ((c % cols) + 0.5) / cols * 100,
    y: c < cols ? 32 : 68,
  })

  return (
    <div
      className="relative h-40 overflow-hidden rounded-xl border border-border bg-card"
      role="status"
      aria-live="polite"
      aria-label={collapsed ? `${alerts} alerts became ${incidents} incidents` : "Running triage"}
    >
      {!reduceMotion &&
        Array.from({ length: dotCount }, (_, i) => {
          const sx = 3 + rand(i, 1) * 94
          const sy = 8 + rand(i, 2) * 84
          const target = incidents > 0 ? centre(i % incidents) : { x: 50, y: 50 }
          return (
            <motion.span
              key={i}
              className="absolute size-1.5 rounded-full bg-muted-foreground/60"
              style={{ left: `${sx}%`, top: `${sy}%` }}
              animate={
                collapsed
                  ? { left: `${target.x}%`, top: `${target.y}%`, opacity: [1, 1, 0], scale: [1, 0.8, 0.4] }
                  : { y: [0, -5, 0, 5, 0], opacity: 0.85 }
              }
              transition={
                collapsed
                  ? { duration: 0.5, delay: (i % 24) * 0.012, ease: "easeInOut", times: [0, 0.8, 1] }
                  : { duration: 1.8, repeat: Infinity, delay: rand(i, 3) * 1.2, ease: "easeInOut" }
              }
            />
          )
        })}

      {collapsed &&
        levels.map((level, c) => {
          const p = centre(c)
          return (
            <motion.span
              key={c}
              className={`absolute h-3 w-5 -translate-x-1/2 -translate-y-1/2 rounded-sm ${CHIP_COLORS[level]}`}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              initial={reduceMotion ? false : { opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25, delay: reduceMotion ? 0 : 0.35 + c * 0.012 }}
            />
          )
        })}

      <p className="absolute bottom-2 left-3 text-xs font-medium text-muted-foreground">
        {collapsed
          ? `${alerts.toLocaleString()} alerts → ${incidents} incidents`
          : "Correlating alerts, mapping to MITRE ATT&CK, scoring…"}
      </p>
    </div>
  )
}
