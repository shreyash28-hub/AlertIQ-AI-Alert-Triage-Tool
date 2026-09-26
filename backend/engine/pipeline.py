"""Ties the four engine steps together: normalize -> correlate -> MITRE
mapping -> score and rank. Used by the API (Phase 3) and by run_triage.py
below for a standalone terminal check."""

import time

from .correlate import correlate
from .mitre import enrich, load_mitre_map
from .normalize import load_and_normalize
from .scoring import score_and_rank


def run_triage() -> dict:
    start = time.perf_counter()

    alerts = load_and_normalize()
    mitre_map = load_mitre_map()
    enrich(alerts, mitre_map)
    groups = correlate(alerts)
    incidents = score_and_rank(groups)

    duration_ms = round((time.perf_counter() - start) * 1000)
    return {
        "alerts": alerts,
        "incidents": incidents,
        "total_alerts": len(alerts),
        "total_incidents": len(incidents),
        "duration_ms": duration_ms,
    }
