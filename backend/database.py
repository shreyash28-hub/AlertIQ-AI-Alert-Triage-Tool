"""Supabase client and the helper functions the API and pipeline use to
read and write the database (see supabase/migrations/001_schema.sql)."""

import os
import time

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

# A client cached forever (the original @lru_cache) holds one long-lived
# httpx connection that Supabase's server can close after being idle for a
# while; httpx doesn't detect or retry a dead pooled connection, so every
# call then fails with httpx.RemoteProtocolError("Server disconnected")
# until the process restarts - found in testing after ~30 min of a long-
# running dev server (mid multi-minute /api/ingest call, and even on plain
# GETs afterward). A short TTL refreshes the client well before that idle
# window, without paying the cost of reconnecting on every single call.
_CLIENT_TTL_SECONDS = 240
_client: Client | None = None
_client_created_at: float = 0.0


def get_client() -> Client:
    global _client, _client_created_at
    now = time.monotonic()
    if _client is None or (now - _client_created_at) > _CLIENT_TTL_SECONDS:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        _client = create_client(url, key)
        _client_created_at = now
    return _client


def _iso(value):
    return value.isoformat() if hasattr(value, "isoformat") else value


def _chunked_upsert(table: str, rows: list[dict], on_conflict: str, chunk: int = 500) -> None:
    """PostgREST has a payload size limit, so large tables (~3,000 alerts)
    are written in batches rather than one giant request."""
    client = get_client()
    for i in range(0, len(rows), chunk):
        client.table(table).upsert(rows[i:i + chunk], on_conflict=on_conflict).execute()


def save_assets(assets: dict[str, dict]) -> None:
    """assets: host -> {type, owner, criticality}, as returned by
    engine.normalize.load_assets(). Upserted so re-running the generator
    doesn't duplicate rows."""
    rows = [{"host": host, **info} for host, info in assets.items()]
    _chunked_upsert("assets", rows, on_conflict="host")


def create_run() -> str:
    res = get_client().table("triage_runs").insert({}).execute()
    return res.data[0]["run_id"]


def finish_run(run_id: str, total_alerts: int, total_incidents: int, duration_ms: int) -> None:
    get_client().table("triage_runs").update({
        "total_alerts": total_alerts,
        "total_incidents": total_incidents,
        "duration_ms": duration_ms,
    }).eq("run_id", run_id).execute()


def save_alerts(run_id: str, alerts: list[dict]) -> None:
    rows = [{
        "alert_id": a["alert_id"],
        "run_id": run_id,
        "timestamp": _iso(a["timestamp"]),
        "source": a["source"],
        "alert_type": a["alert_type"],
        "severity": a["severity"],
        "host": a["host"],
        "user_name": a["user"],
        "src_ip": a["src_ip"],
        "dest_ip": a["dest_ip"],
        "raw_message": a["raw_message"],
        "is_true_positive": a["is_true_positive"],
    } for a in alerts]
    _chunked_upsert("alerts", rows, on_conflict="alert_id")


def save_incidents(run_id: str, incidents: list[dict]) -> None:
    rows = [{
        "incident_id": inc["incident_id"],
        "run_id": run_id,
        "title": inc["title"],
        "primary_host": inc["primary_host"],
        "primary_user": inc["primary_user"],
        "alert_count": inc["alert_count"],
        "start_time": _iso(inc["start_time"]),
        "end_time": _iso(inc["end_time"]),
        "techniques": inc["mitre_techniques"],
        "tactics": inc["kill_chain_stages"],
        "risk_score": inc["risk_score"],
        "risk_level": inc["risk_level"],
        "ai_brief": inc["ai_brief"],
        "status": inc["status"],
        "analyst_note": inc["analyst_note"],
        "decided_at": _iso(inc["decided_at"]) if inc["decided_at"] else None,
        "contains_planted_attack": inc["contains_planted_attack"],
    } for inc in incidents]
    _chunked_upsert("incidents", rows, on_conflict="incident_id")

    link_rows = [
        {"incident_id": inc["incident_id"], "alert_id": aid}
        for inc in incidents for aid in inc["alert_ids"]
    ]
    _chunked_upsert("incident_alerts", link_rows, on_conflict="incident_id,alert_id")


def fetch_incidents(level: str = None, status: str = None, technique: str = None) -> list[dict]:
    # embed the asset row via the primary_host -> assets(host) foreign key,
    # so the dashboard table can show "asset + criticality" without a
    # second round trip per incident
    q = (get_client().table("incidents").select("*, asset:assets(host,type,owner,criticality)")
         .order("risk_score", desc=True))
    if level:
        q = q.eq("risk_level", level)
    if status:
        q = q.eq("status", status)
    if technique:
        q = q.contains("techniques", [technique])
    return q.execute().data


def fetch_incident(incident_id: str) -> dict | None:
    client = get_client()
    res = client.table("incidents").select("*").eq("incident_id", incident_id).execute()
    if not res.data:
        return None
    incident = res.data[0]

    link_res = client.table("incident_alerts").select("alert_id").eq("incident_id", incident_id).execute()
    alert_ids = [row["alert_id"] for row in link_res.data]
    alerts = []
    if alert_ids:
        alerts = (client.table("alerts").select("*").in_("alert_id", alert_ids)
                  .order("timestamp").execute().data)

    asset = None
    if incident.get("primary_host"):
        asset_res = client.table("assets").select("*").eq("host", incident["primary_host"]).execute()
        asset = asset_res.data[0] if asset_res.data else None

    incident["alerts"] = alerts
    incident["asset"] = asset
    return incident


def update_incident_brief(incident_id: str, ai_brief: str) -> None:
    get_client().table("incidents").update({"ai_brief": ai_brief}).eq("incident_id", incident_id).execute()


def fetch_all_incidents() -> list[dict]:
    return get_client().table("incidents").select("*").execute().data


def fetch_all_decisions() -> list[dict]:
    return get_client().table("decisions").select("decision").execute().data


def latest_run() -> dict | None:
    # only a run that actually finished (finish_run() sets duration_ms) -
    # create_run() inserts a stub row before the pipeline has run at all,
    # and if the request fails partway through (e.g. the stale-connection
    # bug above), that stub would otherwise look like "the latest run" with
    # total_alerts=0, which briefly showed on the dashboard during testing.
    res = (get_client().table("triage_runs").select("*")
           .not_.is_("duration_ms", "null")
           .order("started_at", desc=True).limit(1).execute())
    return res.data[0] if res.data else None
