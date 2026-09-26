"""FastAPI app: the 6 endpoints in the blueprint's API spec. Login, simple
reads and decisions go straight from the frontend to Supabase (supabase-js);
these endpoints do the heavier lifting: the triage pipeline, AI briefs, and
metrics. Interactive test page at http://localhost:8000/docs.

Run:
    cd backend
    venv\\Scripts\\python.exe -m uvicorn main:app --reload
"""

import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from ai.summarizer import summarize, template_brief
from database import (create_run, fetch_all_decisions, fetch_all_incidents,
                       fetch_incident, fetch_incidents, finish_run, latest_run,
                       save_alerts, save_assets, save_incidents, update_incident_brief)
from engine.normalize import load_assets
from engine.pipeline import run_triage
from generator.generate_alerts import main as generate_dataset
from metrics.mttt import compute_metrics

app = FastAPI(title="AlertIQ API")

# Allow the frontend to call this API from the browser: the Vite dev server
# locally, and Azure Static Web Apps once deployed (Phase 8).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_origin_regex=r"https://.*\.azurestaticapps\.net",
    allow_methods=["*"],
    allow_headers=["*"],
)

# Design rule: summarize only the top ~20 incidents; the rest keep a plain
# template brief. Saves AI time/cost and matches the blueprint's demo tip.
TOP_N_SUMMARIZED = 20

DATA_DIR = Path(__file__).parent / "data"


@app.post("/api/generate")
def generate():
    """Create a fresh synthetic dataset and save the asset inventory to
    Supabase. (Alerts themselves are written on /api/ingest, once they've
    been through the pipeline and have a run_id.)"""
    generate_dataset()
    save_assets(load_assets())
    alerts = json.loads((DATA_DIR / "alerts.json").read_text(encoding="utf-8"))
    return {"alerts": len(alerts)}


def _for_summarizer(incident: dict, alerts_by_id: dict, assets: dict) -> dict:
    """summarize() wants an incident with its alerts and asset attached
    (the shape database.fetch_incident() returns); the pipeline's raw
    incident only has alert_ids, so build that shape here without
    mutating the incident dict that gets saved to Supabase."""
    host = incident["primary_host"]
    asset_info = assets.get(host)
    return {
        **incident,
        "alerts": [alerts_by_id[aid] for aid in incident["alert_ids"] if aid in alerts_by_id],
        "asset": {"host": host, **asset_info} if asset_info else None,
    }


@app.post("/api/ingest")
def ingest():
    """Run the full triage pipeline and write the results to Supabase."""
    result = run_triage()
    run_id = create_run()

    save_alerts(run_id, result["alerts"])

    incidents = result["incidents"]
    alerts_by_id = {a["alert_id"]: a for a in result["alerts"]}
    assets = load_assets()
    for inc in incidents[:TOP_N_SUMMARIZED]:
        inc["ai_brief"] = summarize(_for_summarizer(inc, alerts_by_id, assets))
    for inc in incidents[TOP_N_SUMMARIZED:]:
        # design rule: "low incidents get a template brief" - not no brief
        inc["ai_brief"] = template_brief(_for_summarizer(inc, alerts_by_id, assets))
    save_incidents(run_id, incidents)

    finish_run(run_id, result["total_alerts"], result["total_incidents"], result["duration_ms"])

    return {
        "run_id": run_id,
        "alerts": result["total_alerts"],
        "incidents": result["total_incidents"],
        "duration_ms": result["duration_ms"],
    }


@app.get("/api/incidents")
def list_incidents(level: str | None = None, status: str | None = None, technique: str | None = None):
    """Ranked incident list; filters: level, status, technique."""
    return fetch_incidents(level=level, status=status, technique=technique)


@app.get("/api/incidents/{incident_id}")
def get_incident(incident_id: str):
    """One incident in full: its alerts, brief and asset."""
    incident = fetch_incident(incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="incident not found")
    return incident


@app.post("/api/incidents/{incident_id}/summarize")
def summarize_incident(incident_id: str):
    """Regenerate the AI brief for one incident."""
    incident = fetch_incident(incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="incident not found")
    brief = summarize(incident)
    update_incident_brief(incident_id, brief)
    return {"ai_brief": brief}


@app.get("/api/metrics")
def metrics():
    """Dashboard numbers: noise reduction, MTTT, detection accuracy,
    decision breakdown."""
    incidents = fetch_all_incidents()
    decisions = fetch_all_decisions()
    run = latest_run()
    total_alerts = run["total_alerts"] if run else 0
    return compute_metrics(incidents, total_alerts, decisions)
