// Supabase client for the frontend: login/logout, reading incidents/
// decisions directly (RLS-protected), and Realtime subscriptions. Only the
// anon key lives here - it is safe to expose because Row Level Security
// controls what it can actually read or write (see
// supabase/migrations/001_schema.sql). The backend's service role key
// never appears in frontend code.

import { createClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY - copy frontend/.env.example to frontend/.env and fill them in.",
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
