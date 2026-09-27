# AlertIQ — judge prep (Round 1)

All numbers come from `backend/evaluate.py` (seed 42 unless stated) on the team's own synthetic dataset.

## What the system actually does

1. **Normalize** – parse, lowercase host/user, drop exact duplicates (same type, host, timestamp), attach asset criticality. 2,971 raw alerts -> 2,970.
2. **Correlate** – union-find over alerts sharing a host, a user, or an *external* IP, chained with a 30-minute sliding window. An external IP that would link more than 5 hosts is ignored (looks like a scanner). Low-severity, technique-less alert types are rolled up into one incident per host per day. Correlated groups with fewer than 8 alerts and no severity >= 4 are also dissolved into that rollup.
3. **MITRE mapping** – a static lookup table, alert_type -> technique/tactic (`data/mitre_map.json`). Not inferred, not AI.
4. **Score** – `risk = 30*S + 35*C + 25*K + 10*A` (max severity/5, max asset criticality/10, distinct tactics/4 capped at 1, anomaly signals/3: off-hours, external IP, new-city VPN). Alert count is never used. Rollups get K = 0. Fully deterministic.
5. **AI brief** – Phi-4-mini (Ollama, temperature 0.2) receives a compact JSON of the incident and writes <= 5 lines. It never sees or sets the score decision, and the analyst confirms/dismisses/escalates. Guardrails: routine rollups skip the model; any brief citing a technique ID not attached to the incident is rejected; any failure falls back to a template.
6. **Analyst decision** – stored in Supabase, incident status updated by a narrow database trigger.

## Measured today (synthetic data, seed 42)

| Metric | Result |
|---|---|
| Raw / unique alerts | 2,971 / 2,970 |
| Assets | 40 |
| Planted attacks | 4 stories, 91 alerts |
| Incidents | 38 |
| Review-volume reduction (1 - 38/2970) | 98.7% |
| Attack incidents in top 5 | 4/4 (ranks 1, 2, 3, 4) |
| Precision@5 / recall@5 | 0.8 / 1.0 (rank 5 is a routine rollup, score 59.5) |
| Each attack kept in one incident, purity | 4/4 whole; 100% attack alerts in their incident |
| Incident-level at score >= 60 | 4 flagged: TP 4, FP 0, FN 0, FPR 0 |
| Baseline B (group by host+day, same scoring) | 3/7 attack incidents in top 5; lateral-movement story split over 4 incidents |
| Baseline A (severity-only alert ranking) | attack alerts appear early (positions 1–46): ranking alone is easy on this data; AlertIQ's gain is grouping into whole stories |
| Other seeds 1–20 | all 20: 4/4 in top 5, all stories whole, 37–41 incidents |
| Scale (engine only, in memory) | 29,700 alerts -> 371 incidents in 0.38 s |
| Decoy noisy VM | 2 incidents, ranks 37 and 38, score 28.4, Low |

## Cannot be claimed

- "Noise reduction" as a false-positive rate. 98.7% is a reduction in review volume; labels only say "part of a planted attack".
- Real-world detection accuracy. Attacks and noise were written by the team; thresholds (8 alerts / severity 4) were tuned on seed 42; the other seeds share the same generator design.
- Analyst time saved. The "MTTT" in the app is an assumption (1 min/alert vs 2 min/incident). No timed study exists.
- Superiority over Sentinel/SIEM/XDR. No comparison was run.
- AI brief quality. No rating study. Only technique-ID grounding is checked automatically.
- Azure deployment. Not deployed. Azure App Service cannot reach a local Ollama, so briefs must be pre-generated locally.
- "Alert data stays on our machine": alerts and incidents are stored in Supabase (cloud). Only the *AI inference* is local, so incident text is not sent to an external AI API.

## Claim verification

| Claim | Verified from code? | Evidence | Safe in PPT? |
|---|---|---|---|
| 2,970 alerts | Yes (after de-dup; 2,971 raw) | evaluate.py | Yes, say "unique" |
| 38 incidents | Yes | evaluate.py, run_triage.py | Yes |
| 98.7% | Yes as 1 - 38/2970 | evaluate.py | Yes as "review volume" only |
| 4/4 in top 5 | Yes (ranks 1–4) | evaluate.py | Yes, label synthetic |
| Decoy 37/38 | Partly: decoy is 2 incidents, ranks 37 and 38 | evaluate.py | Reword or omit |
| AI never sets score | Yes | scoring.py has no AI call; summarizer only reads the score | Yes |
| MITRE mapping | Yes, static lookup | engine/mitre.py | Say "lookup", not "detected" |
| Phi-4-mini local via Ollama | Yes | ai/summarizer.py | Yes |
| Runs locally | Only AI inference | database.py uses Supabase | Say "AI inference local" |
| Azure | No | not deployed | Only as "planned" |
| Dashboard: chain, timeline, 6 charts, realtime | Yes (verified live in earlier phases; not re-run in this pass) | frontend/src | Yes |
| <2h vs ~50h triage | No | assumption only | Removed |
| Better than SIEM | No | no comparison | Never claim |

## Judge questions

1. **How is 2,970 reduced to 38?** Entity + 30-min sliding-window grouping for anything notable; routine low-severity noise and tiny mild groups roll up to one incident per host per day. It is grouping, not deletion: every alert stays inside its incident.
2. **What stops unrelated alerts merging?** Only external IPs link alerts, one IP may link at most 5 hosts, and small mild groups are dissolved. Evidence: every attack stayed whole with 100% purity on 21 seeds.
3. **How are multi-step attacks found?** Alerts sharing a host, user or attacker IP within 30 min of the previous one chain together, even across hosts (the lateral-movement story spans 4 host-days; host+day grouping splits it into 4 incidents, ours keeps one).
4. **Real attack vs noise?** Ranking by asset criticality, severity, number of distinct ATT&CK tactics and anomaly signals. Alert count is ignored, so a noisy test VM stays at the bottom.
5. **How is risk calculated?** 30% max severity, 35% asset criticality, 25% kill-chain breadth, 10% anomaly signals. Weights are hand-set and transparent, not learned.
6. **Why is AI needed?** Only for the readable shift-handover brief. Detection and ranking do not use it. Without the model, a template brief is used.
7. **What if Phi-4-mini is wrong?** Prompt says use only given data; briefs citing unseen technique IDs are rejected automatically; the analyst can edit the brief and always makes the decision. It cannot verify every sentence.
8. **If the model is down?** Template brief immediately; tested in `tests/test_summarizer_guard.py`.
9. **Why Phi-4-mini?** Microsoft's small model (about 3.8B parameters) that runs on a laptop through Ollama, so no paid AI API is needed for the demo.
10. **Why Ollama?** Simple local model serving with one Python client.
11. **Why Azure?** Planned hosting for the FastAPI backend and React dashboard. Not deployed yet; we say so.
12. **How is this different from Microsoft Sentinel?** Sentinel already correlates and prioritises; AlertIQ is not a replacement. It is a small, readable triage layer: rules an analyst can read, a score they can explain, AI limited to explanation. We have not benchmarked against Sentinel.
13. **Why not just use a SIEM?** Teams that already have one should; the next step we are exploring is ingesting Sentinel alert exports into AlertIQ.
14. **What is novel?** The combination and the discipline: deterministic ranking, AI restricted to explanation with a grounding check, analyst in control, and a reproducible evaluation. Not a new detection algorithm.
15. **Is the dataset representative?** No. It is synthetic, written by us. It is good for testing whether the pipeline does what it claims, not for real-world accuracy.
16. **How do you evaluate detection quality?** `evaluate.py`: top-k ranking, precision/recall/FPR at incident level, attack fragmentation, purity, two baselines, 20 other seeds.
17. **What does 98.7% mean?** 1 - 38/2970: fewer items to review. It is not the share of alerts proven harmless.
18. **Baseline?** Group by host+day with the same score: 3/7 attack incidents in top 5 and one story split in four. Severity-only ranking finds single attack alerts early on this data (positions 1–46) but gives no grouping.
19. **False-positive rate?** At score >= 60: 0 FP of 34 non-attack incidents on seed 42. The 5th-ranked routine incident scores 59.5, so the margin is thin, and this is synthetic.
20. **Can I reproduce 4/4?** `python evaluate.py` (seeded).
21. **Scale?** Engine handled 29,700 alerts in 0.38 s in memory. The API path (Supabase writes, AI briefs for top 20) is much slower: about 1 minute for the demo dataset. Not tested at millions.
22. **Unseen attack patterns?** MITRE mapping is a lookup table, so an unmapped alert type gets no technique and gets no kill-chain credit. Known limitation; ranking still uses severity and criticality.
23. **Privacy risks?** Alerts are in Supabase with row-level security; AI inference is local so nothing goes to an external AI API. A cloud deployment would need the model hosted privately.
24. **Why local AI?** Security alert text can be sensitive; local inference avoids sending it to a third-party model API.
25. **Correlation correctness?** With `attack_id` labels: each story is in exactly 1 incident, story recall 1.0, purity 1.0 on seed 42 and all 20 other seeds.

## 2–3 minute demo

1. (20 s) Landing page: "2,970 alerts to 38 incidents, on our synthetic data."
2. (30 s) Log in, click **Run triage**: incidents appear ranked; four Critical/High attacks first.
3. (40 s) Open the top incident: attack chain (Initial Access -> ... -> Exfiltration), alert timeline, AI brief, risk score.
4. (20 s) Point at the decoy VM at the bottom: 174 alerts, Low score, because ranking ignores volume.
5. (30 s) Click **Confirm** / **False positive**: badge updates live via Realtime. "The analyst decides, not the AI."
6. (20 s) Metrics page, then the terminal: `python evaluate.py` shows the same 4/4 and the baselines.
