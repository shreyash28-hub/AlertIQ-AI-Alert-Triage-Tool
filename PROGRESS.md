# AlertIQ — Progress

Updated after each completed task. See [docs/AlertIQ_Project_Blueprint.docx](docs/AlertIQ_Project_Blueprint.docx) for the full design and the 9-phase roadmap.

**Locked decisions (changed after the original blueprint):**
- AI: Ollama + Phi-4-mini only (no Grok, no Azure OpenAI).
- Hosting: Azure Static Web Apps (frontend) + Azure App Service (backend). Vercel was considered and dropped.
- Design: the blueprint's single fixed dark SOC theme was replaced (user request) with a livelier violet-accented palette and real light/dark/system theme support. Fixed red/orange/yellow/grey risk scale and Inter/JetBrains Mono fonts kept. Public routes now exist too: `/` is a marketing landing page, `/signup` lets anyone create an account; the app itself moved to `/app`.

**Demo login:** a test analyst account (`analyst@alertiq.demo`) was created via the Supabase admin API in Phase 5, for local testing. Its password is not recorded here or in git, since this repo is public — reset it from the Supabase dashboard (Authentication → Users) if needed, or ask to create a fresh one. Delete this account before any public deployment.

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

### Phase 4 — AI summaries ✅
- `backend/ai/summarizer.py`: `ollama_brief()` calls Phi-4-mini with the blueprint's exact prompt (temperature 0.2); `summarize()` tries it and falls back to `template_brief()` on any failure — Ollama down, unreachable, timeout, or empty reply — so the demo never breaks.
- `backend/main.py`: incidents beyond the top 20 now get a template brief too (design rule: "low incidents get a template brief", not no brief).
- **Caching:** briefs are stored in `incidents.ai_brief`; confirmed live that repeated `GET /api/incidents/{id}` calls return the byte-identical stored brief in under a second — no repeated AI calls on refresh.
- **Two data-quality bugs found and fixed against real model output:**
  - The prompt sent `mitre_techniques` and `kill_chain_stages` as two separately-sorted lists; phi4-mini paired them up itself and got it wrong (e.g. called T1041 "Initial Access" instead of Exfiltration). Fixed by sending explicit `{technique, tactic}` pairs derived from `mitre_map.json`.
  - A "routine activity" rollup incident (Phase 2's noise rollup) still has individual alert techniques attached even though its tactics are forced empty; asking the model to narrate a "multi-stage attack" for one invited it to hallucinate a story *and fake technique codes that don't exist in our data* (observed: phi4-mini invented T1186/T1220). Fixed by detecting a rollup (techniques present, tactics empty — a reliable signal since every real technique in `mitre_map.json` has a tactic) and routing it straight to the template brief, skipping the AI call. Also fixed `template_brief()` to recognize the database's `techniques` column name, not just the engine's `mitre_techniques` key.
- **Verified end to end:** full `/api/ingest` run — of the top 20 incidents, exactly the 4 real planted attacks got a genuine AI brief (24–28s each, correct technique/tactic pairing every time) and the other 16 (routine rollups) correctly got the instant template. 0 hallucinated technique codes anywhere in the top 20. Ingest time dropped from 8m15s (AI for all 20) to 1m9s once routine incidents were routed to the template. Fallback tested directly with an unreachable Ollama URL — falls back immediately, exactly as it would from a deployed Azure backend.

### Phase 5 — Frontend base ✅
- `frontend/`: Vite + React 18 + TypeScript, Tailwind CSS v4 (via `@tailwindcss/vite` — the blueprint's `tailwind.config.ts` is a v3 artifact; v4 configures through the Vite plugin + CSS `@theme` instead, noted in `frontend/README.md`), shadcn/ui (button, card, table, badge, input, label, tabs, dialog, tooltip, separator).
- Dark SOC theme in `src/index.css`: near-black background, slate cards, cyan accent, red/orange/yellow/grey risk scale as CSS variables, Inter + JetBrains Mono fonts.
- `src/lib/api.ts` (FastAPI client), `src/lib/supabase.ts` + `auth.tsx` (Supabase client + session context, anon key only), `src/types/index.ts` (mirrors `backend/models.py`).
- React Router (`/login`, `/`, `/incidents/:id`, `/metrics`, the last three behind `ProtectedRoute`) + TanStack Query.
- `Dashboard.tsx`: real incident list with risk badges + working "Run triage" button. `IncidentDetail.tsx`/`Metrics.tsx` are working but minimal — Phase 6 builds their full versions.
- **Verified live in a real browser** (`.claude/launch.json` added so the browser tool can run the Vite dev server): created a persistent demo login (`analyst@alertiq.demo`), confirmed the Phase 3 signup trigger fired; unauthenticated → redirected to `/login`; after login, Dashboard shows all 38 real incidents correctly sorted/badged; Metrics page shows live 98.7% reduction / 4/4 top-5; incident detail shows a real AI brief with correct technique pairing; sign-out works; `npm run build` passes clean.

### Phase 6 — Full UI ✅
- **Backend, two small additions:** `fetch_incidents()` embeds the asset row (host/type/owner/criticality) via the `primary_host → assets(host)` foreign key; `PUT /api/incidents/{id}/brief` lets an analyst save a manual edit (the blueprint's "analyst can edit the brief" rule needed a write path, since only the backend may write `incidents` directly — same pattern as `/summarize`).
- **New components:** `RiskBadge`, `StatCard` (count-up, respects reduced-motion), `IncidentTable` (filters + click-through), `AttackChain` (tactics as connected steps with technique IDs, grouped via `lib/mitre.ts` — the same technique/tactic-pairing fix Phase 4 made for the AI prompt, needed again here), `AlertTimeline`, `DecisionButtons` (inserts into `decisions` via supabase-js under the analyst's own id), and `charts/` (2 for Dashboard, 3 for Metrics).
- **`lib/useRealtime.ts`:** subscribes to the `incidents`/`decisions` Realtime publication and invalidates React Query caches — the dashboard updates live.
- **Dashboard, IncidentDetail, Metrics** rewritten to their full versions per the blueprint's page specs.
- **Verified live, including the exact checkpoint** ("analyst can open an incident and mark it False positive"): opened the insider attack incident, its attack chain correctly rendered Initial Access → Collection → Exfiltration; clicked False positive; confirmed directly in Supabase that the decision was recorded under the analyst's id and the Phase 3 trigger updated the status — and the UI badge updated live via Realtime with no page refresh. Also verified Edit-brief saves persist correctly. Re-ran `/api/ingest` afterward for a clean dataset. `npm run build` passes clean.

### UI overhaul (user-requested, post-Phase 6) ✅
- **Theme:** real light/dark/system support (`lib/theme.tsx`, `ThemeToggle.tsx`), persisted, flash-prevention script in `index.html`. Palette redesigned to a livelier violet-accented look in both themes (`index.css`), replacing the single fixed dark SOC theme — fixed risk-level colors and fonts kept.
- **New public pages:** `Landing.tsx` (hero, stats, how-it-works, tech badges, CTA) and `Signup.tsx` (handles both a Supabase confirmation-required and immediate-session outcome). Routing restructured: `/` = landing, `/signup`, `/login` public; the app moved to `/app`, `/app/incidents/:id`, `/app/metrics`.
- **Run triage now reveals incidents one by one** instead of the table snapping to the full list — Dashboard fetches the fresh ranked list after ingest and feeds it into the existing per-row animation incrementally.
- **Sidebar enriched:** user profile card, pending-incident badge, "Live via Supabase Realtime" indicator, theme toggle.
- **Metrics gained 2 more charts** (risk score distribution, incidents by asset owner — both from data already fetched), for 6 total.
- **Chart hover fixed:** Recharts' default tooltip cursor / Pie stroke are hardcoded light colors (the reported "white background" on hover); now use theme tokens. Two tooltips (risk level, decision breakdown) now show percentage share instead of raw count.
- **Three real bugs found and fixed while verifying live, beyond what was asked:**
  1. `AppLayout` used `min-h-screen` instead of `h-screen overflow-hidden`, so the whole page scrolled at the body level instead of just the content area — dragging the sidebar (and its sign-out button) up and out of view. Fixed.
  2. Landing page's scroll-triggered fade-ins (`whileInView` + `viewport={{once:true}}`) never fired in testing, leaving entire sections permanently invisible even though correctly in the DOM. Replaced with mount-time `animate`, which can't get stuck hidden.
  3. **The serious one:** `database.py`'s Supabase client was cached forever (`@lru_cache`), holding one long-lived connection. After ~30 min of a running dev server, Supabase closed it; httpx doesn't retry a dead pooled connection, so every call — not just the long `/api/ingest` — started failing with `RemoteProtocolError`, and a failed-partway ingest left a stub `triage_runs` row (`total_alerts=0`) that the dashboard displayed as "latest run" (seen live: stat cards flashing "Total alerts: 0" / "-1.3h"). Fixed two ways: the client now refreshes every 4 minutes instead of forever, and `latest_run()` only considers a run that actually finished (`duration_ms is not null`), so a partial failure of any cause can't poison the dashboard again.
- **Verified live:** landing page (all sections visible after the fix), theme toggle (light/dark), signup (both a rejected invalid email and a real signup reaching "check your email"), the fixed sidebar (stays put on scroll), Run triage's progressive reveal, all 6 Metrics charts, and a clean re-ingest after the connection fix completing in 66s with correct numbers immediately. `npm run build` passes clean. Test accounts cleaned up afterward.

### Phase 7 — Animations ✅
- **Collapse effect** (`components/TriageCollapse.tsx`, wired into Dashboard's Run triage): while the pipeline runs, a dot field drifts; on success the dots fly into per-incident clusters and one chip per incident (coloured by its real risk level, top risk first) pops in, with the "N alerts -> M incidents" caption. The table's one-by-one reveal starts after it.
- **Page transitions**: `AppLayout` fades/slides each route change in 200 ms.
- **Decision feedback**: after a decision the form slides out and a result panel takes its place (Confirmed green, Dismissed grey, Escalated orange, with a "Change decision" button); table rows for decided incidents tint green / orange / fade back.
- **Attack chain**: connector lines now draw in (scaleX) before each arrow head, in sequence.
- **Card hover lift** (`.lift` in `index.css`) on Dashboard and Metrics cards; count-ups shortened from 800 to 500 ms.
- **Reduced motion**: `MotionConfig reducedMotion="user"` app-wide; the collapse shows its final state immediately; `.lift` is disabled by the media query.
- **Verified:** `npm run build` (incl. `tsc`) passes; no new lint warnings in the touched files. With a temporary test page (deleted), confirmed the phases switch on schedule, 38 chips render coloured by level (2 Critical, 2 High, 8 Medium, 26 Low in the test data), the connector lines and tactic order are right, and the reduced-motion path renders the final state correctly. **Not verified frame by frame:** the flying-dots motion itself, because the browser pane was hidden (0 animation frames), and the decision-result panel (needs a signed-in session). Watch one Run triage to confirm.

## Remaining

- [ ] **Phase 8 — Metrics and pitch**: timed MTTT test, deploy to Azure, slides, demo video.

## Known gaps to raise during the phase they affect

(Full detail in memory `blueprint-gaps-to-raise`.)

1. ~~Insider attack may miss top-5 (Phase 1/2).~~ Resolved: spaced within the sliding correlation window (Phase 1), then confirmed top-5 in Phase 2 (rank 3/38, score 83.2) after adding a realistic opening VPN-login-from-new-location alert and matching its exfiltration severity to the other attacks.
2. ~~Correlation rule gives hundreds of incidents, not ~40 (Phase 2).~~ Resolved: noise/small-group rollup brought it to 38 incidents.
3. ~~Grouping by external IP / chaining by user can create giant incidents (Phase 2).~~ Resolved: only external IPs link alerts, capped at 5 hosts per IP before it stops being used as a link.
4. ~~Schema missing `is_true_positive` (alerts) and title/alert_count/primary_user/start_time/end_time/analyst_note (incidents) (Phase 3).~~ Resolved: schema matches `backend/models.py` exactly.
5. ~~RLS blocks the frontend from updating `incidents.status` (Phase 3 / Phase 6).~~ Resolved: a `SECURITY DEFINER` trigger on `decisions` performs the one narrow update `incidents` needs when an analyst records a decision.
6. Azure App Service can't reach Ollama on the laptop — briefs must be generated locally and saved to Supabase before the deployed app can show them (Phase 3 API design / Phase 8 deploy).

### Round 1 credibility pass ✅
- `backend/evaluate.py` (+ `evaluation_results.json`): reproducible metrics on the synthetic data — review-volume reduction, top-k ranking, per-story fragmentation/purity, incident-level precision/recall/FPR, two baselines, 20 other generator seeds, scale test. Generator now labels planted stories with `attack_id` (evaluation only; engine never reads labels) and exposes `build_dataset(seed)`.
- `ai/summarizer.py`: `is_grounded()` rejects any AI brief citing an ATT&CK technique the engine did not attach; falls back to the template. Tests: `backend/tests/test_summarizer_guard.py`.
- Wording fixes: "noise reduction" -> "review volume"; MTTT labelled as an assumption (1 min/alert vs 2 min/incident, never measured); removed the unmeasured "<2h vs ~50h" claim from the landing page and README.
- Precision notes: 2,971 raw alerts = 2,970 after exact-duplicate removal; the decoy VM is 2 incidents (ranks 37 and 38); a routine rollup on qa-srv-21 scores 59.5 (rank 5), just under the 60 "High" line.
- Judge prep and claim table: `docs/JUDGE_PREP.md`.
