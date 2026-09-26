"""Step 2 — Correlate: group alerts into incidents.

Two regimes, on purpose (see docs/AlertIQ_Project_Blueprint.docx and
PROGRESS.md for why):

1. Pure background noise (low severity, no MITRE technique at all — a
   failed login, a clean AV scan, a routine update) is rolled up into one
   incident per host per calendar day. Correlating these one-alert-at-a-time
   like everything else would turn thousands of them into thousands of
   singleton incidents, instead of the ~40 the tool is meant to produce.

2. Everything else (has a technique, or is severity >= 3) is correlated the
   way the blueprint specifies: alerts join the same incident when they
   share a host, a user, or an external IP, and are within a 30-minute
   *sliding* window of the previous alert in that chain (so a chain can run
   for hours as long as consecutive alerts stay close together). A chain
   can hop across hosts via a shared user (lateral movement) or a shared
   external IP (shared attacker infrastructure).

Two guards keep that second regime from over-merging:
  - only an EXTERNAL (public) IP is ever used to link alerts; two alerts
    that merely happen to share an internal/private IP are never merged
    just for that, since private IPs recur constantly in ordinary traffic.
  - if one external IP would end up linking more than MAX_IP_FANOUT
    distinct hosts, it stops being used as a link (it looks like an
    internet-wide scanner hitting many hosts independently, not one
    incident) — this is a heuristic, not a guarantee; a stretch goal in the
    blueprint suggests replacing this whole file with DBSCAN clustering.
"""

import ipaddress
from collections import defaultdict
from datetime import timedelta

WINDOW = timedelta(minutes=30)
MAX_IP_FANOUT = 5

# Alert types that carry no MITRE technique at all AND are capped at low
# severity by the generator. Anything else — even a low-severity alert like
# a decoy port scan — goes through real correlation instead of the rollup.
PURE_NOISE_TYPES = {
    "single_failed_login", "av_scan_clean", "software_update",
    "password_change", "file_access_normal", "vpn_login_normal",
    "large_backup_upload",
}


def is_external(ip: str) -> bool:
    try:
        return not ipaddress.ip_address(ip).is_private
    except ValueError:
        return False


class _DSU:
    """Union-find over alert indices, so an alert can be pulled into the
    same group through more than one shared entity (host, user, IP)."""

    def __init__(self, n: int):
        self.parent = list(range(n))

    def find(self, x: int) -> int:
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, a: int, b: int) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[rb] = ra


def _correlate_notable(alerts: list[dict]) -> list[list[dict]]:
    """alerts must be normalized + MITRE-enriched, sorted by timestamp."""
    n = len(alerts)
    if n == 0:
        return []
    dsu = _DSU(n)
    entity_last: dict[tuple, tuple[int, object]] = {}   # key -> (idx, last_seen)
    ip_hosts: dict[str, set] = defaultdict(set)          # external ip -> hosts linked so far

    for i, a in enumerate(alerts):
        keys = [("host", a["host"]), ("user", a["user"])]
        for ip_field in ("src_ip", "dest_ip"):
            ip = a[ip_field]
            if is_external(ip):
                hosts_seen = ip_hosts[ip]
                if a["host"] not in hosts_seen and len(hosts_seen) >= MAX_IP_FANOUT:
                    continue  # fanout guard: this IP looks like a wide scanner, stop linking on it
                hosts_seen.add(a["host"])
                keys.append(("ip", ip))

        for key in keys:
            if key in entity_last:
                j, last_seen = entity_last[key]
                if a["timestamp"] - last_seen <= WINDOW:
                    dsu.union(i, j)
            entity_last[key] = (i, a["timestamp"])

    groups: dict[int, list[dict]] = defaultdict(list)
    for i in range(n):
        groups[dsu.find(i)].append(alerts[i])
    return list(groups.values())


def _rollup_noise(noise_alerts: list[dict]) -> list[list[dict]]:
    by_host_day: dict[tuple, list[dict]] = defaultdict(list)
    for a in noise_alerts:
        by_host_day[(a["host"], a["timestamp"].date())].append(a)
    return list(by_host_day.values())


# A correlated group this small, with no alert reaching this severity, is
# indistinguishable from coincidence: two or three unrelated low-signal
# alerts (a port scan, a maintenance PowerShell run, a new-city VPN login)
# can land on the same host inside the same 30-minute window purely by
# chance and look like a "multi-stage attack" even though nothing links
# them causally. Every real attack story and the decoy comfortably clears
# both thresholds, so this only dissolves accidental small combinations
# back into the noise rollup. (The blueprint's own suggested stretch goal —
# swapping this rule-based correlation for DBSCAN clustering — is the real
# fix; this is a deliberate, documented simplification for the hackathon.)
MIN_STANDALONE_SIZE = 8
MIN_STANDALONE_SEVERITY = 4


def correlate(alerts: list[dict]) -> list[dict]:
    """alerts must already be normalized + MITRE-enriched. Returns a list of
    {"alerts": [...], "is_rollup": bool}. Each becomes one incident in
    scoring.py; is_rollup tells scoring not to count kill-chain progression
    for it (see the note below)."""
    strict_noise = [a for a in alerts if a["alert_type"] in PURE_NOISE_TYPES and a["severity"] <= 2]
    strict_noise_ids = {a["alert_id"] for a in strict_noise}
    candidates = [a for a in alerts if a["alert_id"] not in strict_noise_ids]

    raw_groups = _correlate_notable(candidates)

    kept = []
    leftover = list(strict_noise)
    for g in raw_groups:
        if len(g) >= MIN_STANDALONE_SIZE or max(a["severity"] for a in g) >= MIN_STANDALONE_SEVERITY:
            kept.append({"alerts": g, "is_rollup": False})
        else:
            leftover.extend(g)  # too small and too mild to stand on its own

    # Rollup groups span an entire host-day, so they can end up containing
    # several *unrelated* dissolved alerts whose techniques span different
    # tactics purely by coincidence of sharing a host that day - not because
    # anything actually progressed from one stage to the next. Kill-chain
    # progression (K in the risk score) only means something for a group
    # that correlation judged to be time-proximate, so rollups are flagged
    # here and scoring.py scores their K as 0 even though the individual
    # alerts still carry their technique/tactic for display.
    for g in _rollup_noise(leftover):
        kept.append({"alerts": g, "is_rollup": True})
    return kept
