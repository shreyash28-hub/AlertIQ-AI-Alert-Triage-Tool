"""Step 3 — MITRE ATT&CK mapping: attach a technique + tactic to each alert."""

import json
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# Canonical kill-chain order, used to sort an incident's tactics into a
# sensible left-to-right attack story instead of alphabetical order.
KILL_CHAIN_ORDER = [
    "Initial Access", "Execution", "Persistence", "Privilege Escalation",
    "Defense Evasion", "Credential Access", "Discovery", "Lateral Movement",
    "Collection", "Command and Control", "Exfiltration", "Impact",
]


def load_mitre_map(path: Path = None) -> dict[str, dict]:
    path = path or DATA_DIR / "mitre_map.json"
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def enrich(alerts: list[dict], mitre_map: dict[str, dict]) -> list[dict]:
    """Adds 'technique' and 'tactic' to each alert in place (None for alert
    types with no ATT&CK relevance, e.g. a routine software update)."""
    for a in alerts:
        m = mitre_map.get(a["alert_type"], {})
        a["technique"] = m.get("technique")
        a["tactic"] = m.get("tactic")
    return alerts


def sort_tactics(tactics: set[str]) -> list[str]:
    def key(t):
        return KILL_CHAIN_ORDER.index(t) if t in KILL_CHAIN_ORDER else len(KILL_CHAIN_ORDER)
    return sorted(tactics, key=key)
