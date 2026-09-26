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
        queryClient.invalidateQueries({ queryKey: ["metrics"] })
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
