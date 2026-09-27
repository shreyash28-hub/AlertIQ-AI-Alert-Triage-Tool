"""Live Simulator (demo feature): a streaming alert feed, so a demo doesn't
have to look like one static batch. Alerts arrive in small ticks anchored
to the real current time - mostly background noise, with an occasional
attack story kicked off from scratch - and the *same* triage engine used
everywhere else re-scores the whole picture after every tick.

Deliberately separate from the real pipeline (main.py's /api/ingest):
- State lives in this process's memory only (`_state` below), never in
  Supabase. Nothing here touches triage_runs/alerts/incidents, so a demo
  session can never show up in real Metrics or be decided on by an
  analyst - see the "temporary / in-memory only" decision in PROGRESS.md.
- A single global buffer, not per-session: this is a one-analyst demo
  tool, not a multi-tenant product, so per-user isolation would be
  complexity with no payoff here.

Re-running the full engine on the whole accumulated buffer every tick
(rather than writing an incremental/streaming version of correlate.py)
is deliberate too: the engine's own benchmark is comfortably sub-100ms
even at ~3,000 alerts, so simplicity and correctness win outright over a
much more complex incremental design that would only pay off at a scale
this demo never reaches.
"""

import random
from datetime import datetime, timedelta

from engine.correlate import correlate
from engine.mitre import enrich, load_mitre_map
from engine.normalize import load_assets, normalize
from engine.scoring import score_and_rank
from generator.generate_alerts import (
    attack_brute_force_payroll,
    attack_insider_slow_leak,
    attack_lateral_movement_dc,
    attack_phishing_hr_laptop,
    benign_noise,
    suspicious_but_harmless,
)

ATTACK_BUILDERS = {
    "Brute force -> payroll exfiltration": attack_brute_force_payroll,
    "Phishing -> HR laptop malware": attack_phishing_hr_laptop,
    "Lateral movement -> domain controller": attack_lateral_movement_dc,
    "Low-and-slow insider": attack_insider_slow_leak,
}

# ~1 in 6 ticks starts a brand new attack story
ATTACK_CHANCE = 1 / 6

_state: dict = {"alerts": [], "seq": 0}


def _next_id() -> str:
    _state["seq"] += 1
    return f"L-{_state['seq']:05d}"


def _tag_ids(alerts: list[dict]) -> None:
    for a in alerts:
        a["alert_id"] = _next_id()


def reset() -> None:
    _state["alerts"] = []
    _state["seq"] = 0


def is_running() -> bool:
    return len(_state["alerts"]) > 0


def _generate_batch(hosts: list[str], now: datetime) -> tuple[list[dict], str | None]:
    """One tick's worth of new alerts: mostly noise, sometimes suspicious,
    occasionally a fresh attack story starting right now."""
    window = timedelta(minutes=1)
    anchor = now - window

    batch = benign_noise(random.randint(8, 18), hosts, anchor=anchor, window_minutes=1)
    if random.random() < 0.5:
        batch += suspicious_but_harmless(random.randint(2, 5), hosts, anchor=anchor, window_minutes=1)

    attack_name = None
    if random.random() < ATTACK_CHANCE:
        attack_name = random.choice(list(ATTACK_BUILDERS))
        batch += ATTACK_BUILDERS[attack_name](start=now)

    _tag_ids(batch)
    return batch, attack_name


def tick() -> dict:
    """Adds one batch of new alerts and re-scores everything seen so far."""
    assets = load_assets()
    hosts = list(assets.keys())
    now = datetime.utcnow()

    new_alerts, attack_name = _generate_batch(hosts, now)
    _state["alerts"].extend(new_alerts)

    mitre_map = load_mitre_map()
    normalized = normalize(_state["alerts"], assets)
    enrich(normalized, mitre_map)
    groups = correlate(normalized)
    incidents = score_and_rank(groups)

    return {
        "new_alert_count": len(new_alerts),
        "total_alerts": len(_state["alerts"]),
        "total_incidents": len(incidents),
        "incidents": incidents,
        "attack_started": attack_name,
    }
