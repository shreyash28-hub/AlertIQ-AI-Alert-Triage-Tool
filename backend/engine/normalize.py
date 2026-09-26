"""Step 1 — Normalize: load raw alerts + assets, clean them into one
standard, comparable format."""

import csv
import json
from datetime import datetime
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def load_assets(path: Path = None) -> dict[str, dict]:
    """host (lowercased) -> {type, owner, criticality}"""
    path = path or DATA_DIR / "assets.csv"
    assets = {}
    with open(path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            assets[row["host"].strip().lower()] = {
                "type": row["type"],
                "owner": row["owner"],
                "criticality": int(row["criticality"]),
            }
    return assets


def load_raw_alerts(path: Path = None) -> list[dict]:
    path = path or DATA_DIR / "alerts.json"
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def normalize(raw_alerts: list[dict], assets: dict[str, dict]) -> list[dict]:
    """
    - Parse timestamps to datetime (the generator already writes them in one
      UTC-equivalent format, so no timezone conversion is needed here).
    - Lowercase host and user so casing differences don't split an entity
      into two.
    - Drop exact duplicate alerts (same type, host, timestamp).
    - Attach each alert's asset criticality (default 1 for an unknown host,
      so a typo'd host doesn't silently outrank everything).
    """
    seen = set()
    out = []
    for a in raw_alerts:
        host = a["host"].strip().lower()
        user = a["user"].strip().lower()
        dup_key = (a["alert_type"], host, a["timestamp"])
        if dup_key in seen:
            continue
        seen.add(dup_key)

        rec = dict(a)
        rec["host"] = host
        rec["user"] = user
        rec["timestamp"] = datetime.strptime(a["timestamp"], "%Y-%m-%d %H:%M:%S")
        rec["asset_criticality"] = assets.get(host, {}).get("criticality", 1)
        out.append(rec)

    out.sort(key=lambda r: r["timestamp"])
    return out


def load_and_normalize() -> list[dict]:
    assets = load_assets()
    raw = load_raw_alerts()
    return normalize(raw, assets)
