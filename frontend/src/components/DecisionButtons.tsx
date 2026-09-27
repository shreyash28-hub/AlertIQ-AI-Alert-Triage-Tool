// Confirm / False positive / Escalate, plus a note field. Inserts directly
// into `decisions` via supabase-js (RLS: an analyst may insert only under
// their own id - see supabase/migrations/001_schema.sql). The frontend
// never writes to `incidents` itself: a SECURITY DEFINER trigger on
// `decisions` updates the incident's status/analyst_note/decided_at, which
// is the fix for the Phase 3 RLS gap (verified live in that phase).

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, ShieldAlert, XCircle } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import type { Decision } from "@/types"

const options: { decision: Decision; label: string; icon: typeof CheckCircle2 }[] = [
  { decision: "confirmed", label: "Confirm", icon: CheckCircle2 },
  { decision: "false_positive", label: "False positive", icon: XCircle },
  { decision: "escalated", label: "Escalate", icon: ShieldAlert },
]

// Feedback after a decision (blueprint: "dismissed card slides out;
// confirmed turns green"): the form slides away and a result panel takes its
// place, tinted for the outcome.
const outcomes: Record<Decision, { text: string; panel: string; icon: typeof CheckCircle2 }> = {
  confirmed: { text: "Confirmed as a real incident", panel: "border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400", icon: CheckCircle2 },
  false_positive: { text: "Dismissed as a false positive", panel: "border-border bg-muted text-muted-foreground", icon: XCircle },
  escalated: { text: "Escalated for follow-up", panel: "border-risk-high/40 bg-risk-high-bg text-risk-high", icon: ShieldAlert },
}

export function DecisionButtons({ incidentId }: { incidentId: string }) {
  const { session } = useAuth()
  const [note, setNote] = useState("")
  const [outcome, setOutcome] = useState<Decision | null>(null)
  const queryClient = useQueryClient()

  const decide = useMutation({
    mutationFn: async (decision: Decision) => {
      if (!session) throw new Error("Not signed in")
      const { error } = await supabase.from("decisions").insert({
        incident_id: incidentId,
        analyst_id: session.user.id,
        decision,
        note: note || null,
      })
      if (error) throw error
    },
    onSuccess: (_data, decision) => {
      toast.success(`Marked ${decision.replace("_", " ")}`)
      queryClient.invalidateQueries({ queryKey: ["incident", incidentId] })
      queryClient.invalidateQueries({ queryKey: ["incidents"] })
      setNote("")
      setOutcome(decision)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const result = outcome ? outcomes[outcome] : null

  return (
    <AnimatePresence mode="wait" initial={false}>
      {result ? (
        <motion.div
          key="result"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className={cn("flex items-center justify-between gap-3 rounded-lg border px-4 py-3", result.panel)}
        >
          <span className="flex items-center gap-2 font-medium">
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 20 }}>
              <result.icon className="size-5" />
            </motion.span>
            {result.text}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setOutcome(null)}>
            Change decision
          </Button>
        </motion.div>
      ) : (
        <motion.div
          key="form"
          exit={{ opacity: 0, x: 48 }}
          transition={{ duration: 0.25 }}
          className="flex flex-col gap-3"
        >
          <Textarea
            placeholder="Optional note (e.g. what you found, actions taken)..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
          />
          <div className="flex flex-wrap gap-2">
            {options.map(({ decision, label, icon: Icon }) => (
              <Button
                key={decision}
                variant={decision === "false_positive" ? "outline" : "default"}
                disabled={decide.isPending}
                onClick={() => decide.mutate(decision)}
              >
                <Icon className="size-4" />
                {label}
              </Button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
