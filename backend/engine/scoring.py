"""Step 4 — Risk score and ranking, and turning each alert group into an
Incident. Risk = 30*S + 35*C + 25*K + 10*A, each factor scaled to 0-1.
Asset criticality carries the most weight, as the problem statement asks;
raw alert count is never part of the score."""

from collections import Counter

from .correlate import is_external
from .mitre import sort_tactics

OFF_HOURS = set(range(0, 6)) | set(range(22, 24))  # 22:00-06:00


def _anomaly_score(group: list[dict]) -> float:
    """A = anomaly signals (0-1): off-hours activity, an external IP
    anywhere in the group, or a login flagged from a new location."""
    signals = 0
    total = 3
    if any(a["timestamp"].hour in OFF_HOURS for a in group):
        signals += 1
    if any(is_external(a["src_ip"]) or is_external(a["dest_ip"]) for a in group):
        signals += 1
    if any(a["alert_type"] == "vpn_login_new_city" for a in group):
        signals += 1
    return signals / total


def _risk_level(score: float) -> str:
    if score >= 80:
        return "Critical"
    if score >= 60:
        return "High"
    if score >= 40:
        return "Medium"
    return "Low"


def _title(techniques: list[str], primary_host: str, is_rollup: bool) -> str:
    if is_rollup or not techniques:
        return f"Routine activity - {primary_host}"
    if len(techniques) == 1:
        return f"{techniques[0]} activity - {primary_host}"
    return f"Multi-stage activity ({len(techniques)} techniques) - {primary_host}"


def score_group(group: list[dict], is_rollup: bool = False) -> dict:
    """Pure scoring math, kept separate from Incident assembly so it's easy
    to unit-test and to match against the blueprint's worked examples."""
    severity = max(a["severity"] for a in group) / 5
    criticality = max(a["asset_criticality"] for a in group) / 10
    tactics = {a["tactic"] for a in group if a.get("tactic")}
    # a rollup's alerts were never judged to be time-correlated with each
    # other, so counting their tactics as kill-chain progression would be
    # meaningless - see the note in correlate.py.
    kill_chain = 0.0 if is_rollup else min(len(tactics) / 4, 1.0)
    anomaly = _anomaly_score(group)

    risk = 30 * severity + 35 * criticality + 25 * kill_chain + 10 * anomaly
    risk = round(min(risk, 100.0), 1)
    return {
        "risk_score": risk,
        "risk_level": _risk_level(risk),
        # kill_chain_stages mirrors K: a rollup wasn't judged time-correlated,
        # so it doesn't get to claim a kill-chain narrative either.
        "tactics": [] if is_rollup else sort_tactics(tactics),
    }


def build_incident(incident_id: str, group: list[dict], is_rollup: bool = False) -> dict:
    group = sorted(group, key=lambda a: a["timestamp"])
    hosts = Counter(a["host"] for a in group)
    users = Counter(a["user"] for a in group)
    primary_host = hosts.most_common(1)[0][0]
    primary_user = users.most_common(1)[0][0]

    techniques = sorted({a["technique"] for a in group if a.get("technique")})
    score = score_group(group, is_rollup=is_rollup)

    return {
        "incident_id": incident_id,
        "title": _title(techniques, primary_host, is_rollup),
        "alert_ids": [a["alert_id"] for a in group],
        "alert_count": len(group),
        "primary_host": primary_host,
        "primary_user": primary_user,
        "start_time": group[0]["timestamp"],
        "end_time": group[-1]["timestamp"],
        "mitre_techniques": techniques,
        "kill_chain_stages": score["tactics"],
        "risk_score": score["risk_score"],
        "risk_level": score["risk_level"],
        "status": "New",
        "ai_brief": None,
        "analyst_note": None,
        "decided_at": None,
        "contains_planted_attack": any(a["is_true_positive"] for a in group),
    }


def score_and_rank(groups: list[dict]) -> list[dict]:
    """groups: correlate.py's output, [{"alerts": [...], "is_rollup": bool}].
    Builds an Incident dict per group, then sorts by risk_score descending
    (alert count is only used to break exact ties, never to rank ahead of a
    higher score)."""
    incidents = [
        build_incident(f"INC-{i:04d}", g["alerts"], is_rollup=g["is_rollup"])
        for i, g in enumerate(groups, start=1)
    ]
    incidents.sort(key=lambda inc: (-inc["risk_score"], -inc["alert_count"]))
    # re-number after sorting so INC-0001 is always the top-ranked incident
    for i, inc in enumerate(incidents, start=1):
        inc["incident_id"] = f"INC-{i:04d}"
    return incidents
