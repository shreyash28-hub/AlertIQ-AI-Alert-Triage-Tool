// ATT&CK tactics as connected steps (e.g. Credential Access -> Execution ->
// Exfiltration), each showing its technique IDs. Steps draw in sequence
// with connecting lines - "tells the attack story" (blueprint's Motion
// rules). Uses groupByTactic() rather than the incident's flat techniques/
// tactics lists, so each step shows exactly the techniques that belong to
// it (same technique/tactic-pairing fix as Phase 4's AI prompt).

import { ArrowRight } from "lucide-react"
import { motion } from "motion/react"
import { groupByTactic, nameFor } from "@/lib/mitre"

export function AttackChain({ techniques }: { techniques: string[] }) {
  const steps = groupByTactic(techniques)

  if (steps.length === 0) {
    return <p className="text-sm text-muted-foreground">No ATT&CK techniques identified.</p>
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {steps.map((step, i) => (
        <div key={step.tactic} className="flex items-center gap-2">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: i * 0.15 }}
            className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2"
          >
            <p className="text-sm font-medium">{step.tactic}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {step.techniques.map((t) => (
                <span
                  key={t}
                  title={nameFor(t)}
                  className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          </motion.div>
          {i < steps.length - 1 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, delay: i * 0.15 + 0.1 }}
            >
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            </motion.div>
          )}
        </div>
      ))}
    </div>
  )
}
