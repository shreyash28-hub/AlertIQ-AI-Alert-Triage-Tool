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

### Phase 2 — Triage engine ✅
- `backend/models.py`: Alert, Asset, Incident Pydantic models (includes the fields the schema gap below flags as missing: title, alert_count, primary_user, start/end time, analyst_note).
- `backend/engine/normalize.py`, `mitre.py`, `correlate.py`, `scoring.py`, `pipeline.py`: the four-step engine (normalize → correlate → MITRE map → score/rank), tied together by `run_triage()`.
- `backend/run_triage.py`: standalone checkpoint script — `venv\Scripts\python.exe run_triage.py` prints the summary with no API/DB needed.
- **Correlation design:** entity + 30-min sliding-window chaining (host/user/external IP) for anything notable; pure background noise and small/mild correlated groups (fewer than 8 alerts, nothing severity ≥4) roll up into one incident per host per day instead of standing alone. Rollups score 0 for kill-chain progression (K), since their alerts were never judged time-correlated — without that, a busy host's unrelated daily alerts could coincidentally span several MITRE tactics and look like a fake multi-stage attack (found and fixed during testing).
- Two guards against over-merging: only external (public) IPs link alerts; one external IP that would link more than 5 hosts stops being used as a link (looks like a wide scanner, not one incident).
- **Verified against the blueprint's checkpoint:** 2,970 alerts → 38 incidents (98.7% noise reduction, target ≥95%); 4/4 planted attacks in the top 5 (target 100%); decoy VM ranks 37/38 at score 28.4 (blueprint's own worked example predicts ~28); 0 real attack alerts left in a Low-risk incident.
- **Two Phase 1 data bugs found and fixed while building this:** benign noise alerts all had a public IP regardless of type (inflated the "external IP" anomaly signal for pure noise — only `blocked_port_scan` should have one); the insider story needed a realistic opening VPN-login-from-new-location alert and a matched exfiltration severity to score above the noise ceiling (see gap #1 below).

### Phase 3 — Backend API ✅
- `supabase/migrations/001_schema.sql`: 7 tables, applied to the live Supabase project via the SQL Editor. Indexes on `(host, timestamp)`, `(user_name, timestamp)`, `risk_score`. RLS enabled on every table; Realtime on `incidents` + `decisions`.
- `backend/database.py`: supabase-py client + read/write helpers, batched upserts (500 rows/request).
- `backend/main.py`: all 6 endpoints from the blueprint's API spec (`/api/generate`, `/api/ingest`, `/api/incidents`, `/api/incidents/{id}`, `/api/incidents/{id}/summarize`, `/api/metrics`).
- `backend/ai/summarizer.py`: template-only brief for now — the safety-net fallback the blueprint's design rules call for; Phase 4 adds the real Ollama call in front of it.
- `backend/metrics/mttt.py`: noise reduction, MTTT, top techniques, detection accuracy, decision breakdown.
- **Gap 4 resolved:** the schema carries every field the app needs (`is_true_positive`, `title`, `alert_count`, `primary_user`, `start_time`/`end_time`, `analyst_note`) — matches `backend/models.py` exactly.
- **Gap 5 resolved:** only the backend's service key can write `incidents`, but a narrow `SECURITY DEFINER` trigger on `decisions` updates exactly `status`/`analyst_note`/`decided_at` when an analyst records a decision — no wider incidents-write policy needed. Verified live: inserting a decision moved an incident from New → Confirmed with the note and timestamp copied correctly.
- **Verified end to end against the live database:** `/api/generate` → 2,971 alerts; `/api/ingest` → 38 incidents (matches Phase 2 exactly); all read endpoints, filters, and `/api/metrics` return correct live data.

## Remaining

- [ ] **Phase 4 — AI summaries**: Phi-4-mini briefs via Ollama, caching, fallback template.
- [ ] **Phase 5 — Frontend base**: Vite + React + TS + Tailwind + shadcn, layout, API client.
- [ ] **Phase 6 — Full UI**: Dashboard, Incident detail, Metrics pages, charts, decision buttons.
- [ ] **Phase 7 — Animations**: Motion count-ups, list transitions, attack chain, collapse effect.
- [ ] **Phase 8 — Metrics and pitch**: timed MTTT test, deploy to Azure, slides, demo video.

## Known gaps to raise during the phase they affect

(Full detail in memory `blueprint-gaps-to-raise`.)

1. ~~Insider attack may miss top-5 (Phase 1/2).~~ Resolved: spaced within the sliding correlation window (Phase 1), then confirmed top-5 in Phase 2 (rank 3/38, score 83.2) after adding a realistic opening VPN-login-from-new-location alert and matching its exfiltration severity to the other attacks.
2. ~~Correlation rule gives hundreds of incidents, not ~40 (Phase 2).~~ Resolved: noise/small-group rollup brought it to 38 incidents.
3. ~~Grouping by external IP / chaining by user can create giant incidents (Phase 2).~~ Resolved: only external IPs link alerts, capped at 5 hosts per IP before it stops being used as a link.
4. ~~Schema missing `is_true_positive` (alerts) and title/alert_count/primary_user/start_time/end_time/analyst_note (incidents) (Phase 3).~~ Resolved: schema matches `backend/models.py` exactly.
5. ~~RLS blocks the frontend from updating `incidents.status` (Phase 3 / Phase 6).~~ Resolved: a `SECURITY DEFINER` trigger on `decisions` performs the one narrow update `incidents` needs when an analyst records a decision.
6. Azure App Service can't reach Ollama on the laptop — briefs must be generated locally and saved to Supabase before the deployed app can show them (Phase 3 API design / Phase 8 deploy).
