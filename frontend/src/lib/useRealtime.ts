// Supabase Realtime: dashboard updates live when incidents or decisions
// change (both tables are in the supabase_realtime publication - see
// supabase/migrations/001_schema.sql). Rather than re-deriving state from
// the push payload, this just invalidates the relevant React Query caches
// and lets the normal fetch paths (which already apply RLS) refresh them.

import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { supabase } from "./supabase"

export function useIncidentsRealtime() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel("incidents-and-decisions")
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents" }, () => {
        queryClient.invalidateQueries({ queryKey: ["incidents"] })
        queryClient.invalidateQueries({ queryKey: ["incident"] })
        // NOT ["metrics"] here: a triage run inserts an empty triage_runs
        // row (create_run) before it fills in total_alerts (finish_run),
        // and this handler fires the instant incidents rows are upserted -
        // which can land inside that window and briefly show total_alerts
        // as 0 (found in testing: stat cards flashed "-1.3h" mid-ingest).
        // Dashboard already refetches metrics explicitly once ingest()
        // resolves, when the numbers are guaranteed final.
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "decisions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["metrics"] })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}
