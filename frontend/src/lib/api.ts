// Client for the FastAPI backend (the triage pipeline, AI briefs, and
// metrics - see backend/main.py). Ordinary reads, login, and decisions go
// straight to Supabase instead (see lib/supabase.ts).

import type { IncidentDetail, IngestResult, Metrics, Incident } from "@/types"

const API_URL = import.meta.env.VITE_API_URL

if (!API_URL) {
  throw new Error("Missing VITE_API_URL - copy frontend/.env.example to frontend/.env and fill it in.")
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`${init?.method ?? "GET"} ${path} failed: ${res.status} ${detail}`)
  }
  return res.json() as Promise<T>
}

export interface IncidentFilters {
  level?: string
  status?: string
  technique?: string
}

function toQuery(filters: IncidentFilters = {}): string {
  const params = new URLSearchParams()
  if (filters.level) params.set("level", filters.level)
  if (filters.status) params.set("status", filters.status)
  if (filters.technique) params.set("technique", filters.technique)
  const qs = params.toString()
  return qs ? `?${qs}` : ""
}

export const api = {
  generate: () => request<{ alerts: number }>("/api/generate", { method: "POST" }),

  ingest: () => request<IngestResult>("/api/ingest", { method: "POST" }),

  listIncidents: (filters?: IncidentFilters) =>
    request<Incident[]>(`/api/incidents${toQuery(filters)}`),

  getIncident: (id: string) => request<IncidentDetail>(`/api/incidents/${id}`),

  summarizeIncident: (id: string) =>
    request<{ ai_brief: string }>(`/api/incidents/${id}/summarize`, { method: "POST" }),

  editBrief: (id: string, ai_brief: string) =>
    request<{ ai_brief: string }>(`/api/incidents/${id}/brief`, {
      method: "PUT",
      body: JSON.stringify({ ai_brief }),
    }),

  getMetrics: () => request<Metrics>("/api/metrics"),
}
