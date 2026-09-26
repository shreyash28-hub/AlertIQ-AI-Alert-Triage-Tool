"""Phase 3 ships the safety net first: a deterministic template brief, so
every part of the pipeline that touches ai_brief already works end to end.
Phase 4 adds the real Phi-4-mini call via Ollama in front of this and falls
back to template_brief() if that call fails or Ollama isn't reachable, so
the demo never breaks either way (see the blueprint's "Design rules")."""


def template_brief(incident: dict) -> str:
    techniques = ", ".join(incident.get("mitre_techniques") or []) or "no ATT&CK techniques identified"
    return (
        f"{incident['risk_level']} - {incident['title']}. "
        f"{incident['alert_count']} alerts on {incident['primary_host']} "
        f"between {incident['start_time']} and {incident['end_time']}. "
        f"Techniques: {techniques}. "
        f"Next steps: review the alert timeline and confirm, dismiss, or escalate."
    )


def summarize(incident: dict) -> str:
    return template_brief(incident)
