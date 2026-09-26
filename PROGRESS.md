# AlertIQ — Progress

Updated after each completed task. See [docs/AlertIQ_Project_Blueprint.docx](docs/AlertIQ_Project_Blueprint.docx) for the full design and the 9-phase roadmap.

**Locked decisions (changed after the original blueprint):**
- AI: Ollama + Phi-4-mini only (no Grok, no Azure OpenAI).
- Hosting: Azure Static Web Apps (frontend) + Azure App Service (backend). Vercel was considered and dropped.

## Done

### Phase 0 — Setup ✅
- Project folder skeleton created (`backend/`, `supabase/migrations/`, `docs/`).
- `README.md`, `.gitignore`, `backend/requirements.txt`, `backend/.env.example` written.
- Ollama 0.34.4 installed; `phi4-mini` model pulled (2.5 GB) and tested from Python (~9s per call incl. load).
- Backend Python venv created at `backend/venv`, all requirements installed and import-tested.
- Git repo initialized, first commit pushed to [github.com/shreyash28-hub/AlertIQ-AI-Alert-Triage-Tool](https://github.com/shreyash28-hub/AlertIQ-AI-Alert-Triage-Tool) on `main`.

## Remaining

- [ ] **Supabase project** — create account/project, get URL + service role key, fill in `backend/.env` (not committed).
- [ ] **Phase 1 — Synthetic data**: `backend/generator/generate_alerts.py`, `backend/data/assets.csv`, `backend/data/mitre_map.json`, ~3,000 alerts incl. 4–5 planted attacks. *Known gap to address here: the low-and-slow insider attack spans multiple nights — the 30-min correlation window may split it and it may miss the top-5 ranking.*
- [ ] **Phase 2 — Triage engine**: normalize, correlate (grouping rule needs a fix so ~40 incidents come out, not hundreds), MITRE mapping, risk scoring.
- [ ] **Phase 3 — Backend API**: Supabase schema + RLS (note: frontend needs to update `incidents.status`, current RLS draft blocks that) + Auth, FastAPI endpoints.
- [ ] **Phase 4 — AI summaries**: Phi-4-mini briefs via Ollama, caching, fallback template.
- [ ] **Phase 5 — Frontend base**: Vite + React + TS + Tailwind + shadcn, layout, API client.
- [ ] **Phase 6 — Full UI**: Dashboard, Incident detail, Metrics pages, charts, decision buttons.
- [ ] **Phase 7 — Animations**: Motion count-ups, list transitions, attack chain, collapse effect.
- [ ] **Phase 8 — Metrics and pitch**: timed MTTT test, deploy to Azure, slides, demo video.

## Known gaps to raise during the phase they affect

(Full detail in memory `blueprint-gaps-to-raise`.)

1. Insider attack may miss top-5 (Phase 1/2).
2. Correlation rule gives hundreds of incidents, not ~40 (Phase 2).
3. Grouping by external IP / chaining by user can create giant incidents (Phase 2).
4. Schema missing `is_true_positive` (alerts) and title/alert_count/primary_user/start_time/end_time/analyst_note (incidents) (Phase 3).
5. RLS blocks the frontend from updating `incidents.status` (Phase 3 / Phase 6).
6. Azure App Service can't reach Ollama on the laptop — briefs must be generated locally and saved to Supabase before the deployed app can show them (Phase 3 API design / Phase 8 deploy).
