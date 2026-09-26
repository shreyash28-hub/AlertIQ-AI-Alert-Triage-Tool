"""Phase 4: real Phi-4-mini briefs via Ollama, with the Phase 3 template as
a safety-net fallback. summarize() never raises: if Ollama isn't running,
times out, or simply can't be reached (e.g. a deployed Azure backend has
no local Ollama - see PROGRESS.md gap 6), it silently falls back to the
template so the demo never breaks."""

import json
import os
from pathlib import Path

import ollama
from dotenv import load_dotenv

load_dotenv()

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "phi4-mini")
TIMEOUT_SECONDS = 30
MAX_SAMPLE_MESSAGES = 10

_MITRE_MAP_PATH = Path(__file__).resolve().parent.parent / "data" / "mitre_map.json"


def _load_technique_tactic_lookup() -> dict[str, str]:
    """technique code -> tactic name, so a brief can say which tactic each
    technique belongs to without guessing. Alerts fetched back from
    Supabase don't carry technique/tactic per row (only the incident-level
    technique list is persisted), so this is derived fresh from the
    reference map instead of relying on per-alert fields - it works the
    same way whether the incident came straight from the engine or was
    reloaded from the database."""
    raw = json.loads(_MITRE_MAP_PATH.read_text(encoding="utf-8"))
    return {info["technique"]: info["tactic"] for info in raw.values() if info.get("technique")}


_TECHNIQUE_TACTIC = _load_technique_tactic_lookup()

PROMPT_TEMPLATE = """You are a SOC tier-1 assistant writing a shift-handover brief.
Using ONLY the incident data below, write at most 5 lines:
1. What happened (one sentence)
2. Affected asset and why it matters
3. MITRE ATT&CK techniques observed (use exactly the technique/tactic pairs
   given in techniques_observed - do not re-pair or guess a different tactic)
4. Risk level and confidence
5. Recommended next steps (2-3 actions)
Do not invent facts not present in the data.

INCIDENT DATA:
{incident_json}
"""


def template_brief(incident: dict) -> str:
    """Deterministic fallback brief: no model call, so it always works.
    Accepts either the engine's incident shape (mitre_techniques) or the
    database's (techniques) - see the same note in _is_routine below."""
    technique_list = incident.get("mitre_techniques") or incident.get("techniques") or []
    techniques = ", ".join(technique_list) or "no ATT&CK techniques identified"
    return (
        f"{incident['risk_level']} - {incident['title']}. "
        f"{incident['alert_count']} alerts on {incident['primary_host']} "
        f"between {incident['start_time']} and {incident['end_time']}. "
        f"Techniques: {techniques}. "
        f"Next steps: review the alert timeline and confirm, dismiss, or escalate."
    )


def _compact_incident_json(incident: dict) -> str:
    """What the AI receives: a compact summary, not all raw alerts - host
    and criticality, user, time window, alert count per type, MITRE
    techniques, kill-chain stages, risk score, and a handful of sample
    alert messages."""
    alerts = incident.get("alerts") or []
    type_counts: dict[str, int] = {}
    for a in alerts:
        type_counts[a["alert_type"]] = type_counts.get(a["alert_type"], 0) + 1
    samples = [a["raw_message"] for a in alerts[:MAX_SAMPLE_MESSAGES] if a.get("raw_message")]

    # explicit {technique, tactic} pairs, not two separately-sorted lists -
    # a small model given two unlinked lists will happily invent its own
    # (wrong) pairing between them
    techniques_observed = [
        {"technique": t, "tactic": _TECHNIQUE_TACTIC.get(t, "Unknown")}
        for t in (incident.get("mitre_techniques") or [])
    ]

    data = {
        "title": incident["title"],
        "primary_host": incident["primary_host"],
        "asset_criticality": (incident.get("asset") or {}).get("criticality"),
        "primary_user": incident["primary_user"],
        "start_time": str(incident["start_time"]),
        "end_time": str(incident["end_time"]),
        "alert_count": incident["alert_count"],
        "alert_types": type_counts,
        "techniques_observed": techniques_observed,
        "risk_score": incident["risk_score"],
        "risk_level": incident["risk_level"],
        "sample_alert_messages": samples,
    }
    return json.dumps(data, indent=2)


def ollama_brief(incident: dict) -> str:
    """Raises on any failure (Ollama down, unreachable, timeout, empty
    reply) - summarize() below is what catches that and falls back."""
    prompt = PROMPT_TEMPLATE.format(incident_json=_compact_incident_json(incident))
    client = ollama.Client(host=OLLAMA_URL, timeout=TIMEOUT_SECONDS)
    response = client.chat(
        model=OLLAMA_MODEL,
        messages=[{"role": "user", "content": prompt}],
        options={"temperature": 0.2},
    )
    text = response["message"]["content"].strip()
    if not text:
        raise ValueError("empty response from Ollama")
    return text


def _is_routine(incident: dict) -> bool:
    """True for a correlate.py rollup: its kill_chain_stages/tactics is
    forced to [] even when individual alerts still carry a technique (see
    engine/scoring.py), because a rollup was never judged to be a real
    time-correlated chain. For any genuine incident, a non-empty technique
    list always comes with a non-empty tactic list (every mapped technique
    in mitre_map.json has a tactic), so techniques-without-tactics can only
    happen for a rollup - this is a reliable signal without needing a
    dedicated column. Asking the model to narrate a "multi-stage attack"
    for one of these both wastes a call and invites it to hallucinate a
    story - and technique codes - that aren't there (seen in testing:
    phi4-mini invented T1186/T1220, which don't exist in our data at all)."""
    techniques = incident.get("mitre_techniques") or incident.get("techniques") or []
    tactics = incident.get("kill_chain_stages") or incident.get("tactics") or []
    return bool(techniques) and not tactics


def summarize(incident: dict) -> str:
    """Try Phi-4-mini via Ollama; fall back to the template brief on any
    failure, or skip straight to it for a routine/rollup incident. Design
    rule from the blueprint: the demo never breaks."""
    if _is_routine(incident):
        return template_brief(incident)
    try:
        return ollama_brief(incident)
    except Exception as exc:
        print(f"[ai.summarizer] Ollama call failed ({exc!r}); using template brief")
        return template_brief(incident)
