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
- Supabase project created; `backend/.env` filled in (URL + service role key) and connection verified (Auth admin call succeeded).

### Phase 1 — Synthetic data ✅
- `backend/generator/generate_alerts.py` generates ~2,970 alerts (seeded, reproducible): 2,440 benign noise, 210 suspicious-but-harmless, a 230-alert noisy decoy VM (`test-vm-01`, all `is_true_positive=false`), and 4 planted multi-step attacks (90 alerts, all `is_true_positive=true`): brute force → payroll exfiltration, phishing → HR laptop malware, lateral movement to the domain controller, low-and-slow insider.
- `backend/data/assets.csv`: 40 seeded assets across criticality tiers (crown jewels 10 down to test VMs 1).
- `backend/data/mitre_map.json`: every alert_type used maps to a technique/tactic (or `null` for pure-noise types).
- Verified: every alert's host exists in `assets.csv`, every `alert_type` exists in `mitre_map.json`, no duplicate `alert_id`s, decoy has zero true positives.
- **Gap resolved:** the insider story is spaced ~15–20 min apart across one ~6.6-hour overnight session, so it stays inside the 30-minute *sliding* correlation window (chain continues as long as consecutive alerts are ≤30 min apart) instead of splitting across nights. Ends with 2 personal-cloud uploads, adding a second MITRE tactic (Collection → Exfiltration) to keep its score above the noise ceiling.
- `alerts.json` itself is git-ignored (regenerated output, not source); `assets.csv` and `mitre_map.json` are committed as seed/reference data.

## Remaining

- [ ] **Phase 2 — Triage engine**: normalize, correlate (grouping rule needs a fix so ~40 incidents come out, not hundreds), MITRE mapping, risk scoring.
- [ ] **Phase 3 — Backend API**: Supabase schema + RLS (note: frontend needs to update `incidents.status`, current RLS draft blocks that) + Auth, FastAPI endpoints.
- [ ] **Phase 4 — AI summaries**: Phi-4-mini briefs via Ollama, caching, fallback template.
- [ ] **Phase 5 — Frontend base**: Vite + React + TS + Tailwind + shadcn, layout, API client.
- [ ] **Phase 6 — Full UI**: Dashboard, Incident detail, Metrics pages, charts, decision buttons.
- [ ] **Phase 7 — Animations**: Motion count-ups, list transitions, attack chain, collapse effect.
- [ ] **Phase 8 — Metrics and pitch**: timed MTTT test, deploy to Azure, slides, demo video.

## Known gaps to raise during the phase they affect

(Full detail in memory `blueprint-gaps-to-raise`.)

1. ~~Insider attack may miss top-5 (Phase 1/2).~~ Resolved in Phase 1 by spacing its alerts within the sliding correlation window (see above) — revisit once Phase 2's scoring is built to confirm it actually ranks top-5.
2. Correlation rule gives hundreds of incidents, not ~40 (Phase 2).
3. Grouping by external IP / chaining by user can create giant incidents (Phase 2).
4. Schema missing `is_true_positive` (alerts) and title/alert_count/primary_user/start_time/end_time/analyst_note (incidents) (Phase 3).
5. RLS blocks the frontend from updating `incidents.status` (Phase 3 / Phase 6).
6. Azure App Service can't reach Ollama on the laptop — briefs must be generated locally and saved to Supabase before the deployed app can show them (Phase 3 API design / Phase 8 deploy).
