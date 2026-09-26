// Confirm / False positive / Escalate, plus a note field. Inserts directly
// into `decisions` via supabase-js (RLS: an analyst may insert only under
// their own id - see supabase/migrations/001_schema.sql). The frontend
// never writes to `incidents` itself: a SECURITY DEFINER trigger on
// `decisions` updates the incident's status/analyst_note/decided_at, which
// is the fix for the Phase 3 RLS gap (verified live in that phase).

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, ShieldAlert, XCircle } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import type { Decision } from "@/types"

const options: { decision: Decision; label: string; icon: typeof CheckCircle2 }[] = [
  { decision: "confirmed", label: "Confirm", icon: CheckCircle2 },
  { decision: "false_positive", label: "False positive", icon: XCircle },
  { decision: "escalated", label: "Escalate", icon: ShieldAlert },
]

export function DecisionButtons({ incidentId }: { incidentId: string }) {
  const { session } = useAuth()
  const [note, setNote] = useState("")
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
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <div className="flex flex-col gap-3">
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
    </div>
  )
}
