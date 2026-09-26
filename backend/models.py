"""Data shapes shared across the engine and (later) the API: Alert, Asset, Incident."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class Asset(BaseModel):
    host: str
    type: str
    owner: str
    criticality: int


class Alert(BaseModel):
    alert_id: str
    timestamp: datetime
    source: str
    alert_type: str
    severity: int
    host: str
    user: str
    src_ip: str
    dest_ip: str
    raw_message: str
    is_true_positive: bool = False
    # filled in by the engine, not present in the raw generated data
    asset_criticality: Optional[int] = None
    technique: Optional[str] = None
    tactic: Optional[str] = None


class Incident(BaseModel):
    incident_id: str
    title: str
    alert_ids: list[str]
    alert_count: int
    primary_host: str
    primary_user: str
    start_time: datetime
    end_time: datetime
    mitre_techniques: list[str]
    kill_chain_stages: list[str]
    risk_score: float
    risk_level: str
    status: str = "New"
    ai_brief: Optional[str] = None
    analyst_note: Optional[str] = None
    decided_at: Optional[datetime] = None
    # ground truth, carried through only to measure detection accuracy (Phase 8);
    # a real system would not have this
    contains_planted_attack: bool = False
