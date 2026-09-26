"""Mean-time-to-triage and noise-reduction metrics for GET /api/metrics and
the Metrics page. Phase 8 replaces the two per-item time assumptions below
with a real timed test; until then these are the blueprint's own documented
estimates (~1 min/alert manually, ~2 min/incident with AlertIQ)."""

from collections import Counter

MANUAL_MINUTES_PER_ALERT = 1.0
TOOL_MINUTES_PER_INCIDENT = 2.0


def compute_metrics(incidents: list[dict], total_alerts: int, decisions: list[dict]) -> dict:
    total_incidents = len(incidents)
    noise_reduction_pct = round((1 - total_incidents / total_alerts) * 100, 1) if total_alerts else 0.0

    by_level = Counter(inc["risk_level"] for inc in incidents)

    technique_counts = Counter()
    for inc in incidents:
        for t in (inc.get("techniques") or []):
            technique_counts[t] += 1
    top_techniques = [{"id": t, "count": c} for t, c in technique_counts.most_common(5)]

    top5 = sorted(incidents, key=lambda i: i["risk_score"], reverse=True)[:5]
    planted_total = sum(1 for i in incidents if i.get("contains_planted_attack"))
    planted_in_top5 = sum(1 for i in top5 if i.get("contains_planted_attack"))

    decision_counts = Counter(d["decision"] for d in decisions)
    pending = max(total_incidents - sum(decision_counts.values()), 0)

    return {
        "total_alerts": total_alerts,
        "total_incidents": total_incidents,
        "noise_reduction_pct": noise_reduction_pct,
        "by_level": {
            "critical": by_level.get("Critical", 0),
            "high": by_level.get("High", 0),
            "medium": by_level.get("Medium", 0),
            "low": by_level.get("Low", 0),
        },
        "top_techniques": top_techniques,
        "mttt_manual_hours": round(total_alerts * MANUAL_MINUTES_PER_ALERT / 60, 1),
        "mttt_tool_hours": round(total_incidents * TOOL_MINUTES_PER_INCIDENT / 60, 1),
        "planted_attacks_in_top5": f"{planted_in_top5}/{planted_total}",
        "decisions": {
            "confirmed": decision_counts.get("confirmed", 0),
            "false_positive": decision_counts.get("false_positive", 0),
            "escalated": decision_counts.get("escalated", 0),
            "pending": pending,
        },
    }
