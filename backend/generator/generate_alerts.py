"""
Phase 1 — Synthetic data generator.

Builds:
  backend/data/assets.csv   asset inventory (~40 machines, fixed/seeded)
  backend/data/alerts.json  ~3,000 synthetic alerts, mostly noise, with
                             4 planted multi-step attacks and 1 noisy decoy.

Run:
    cd backend
    venv\\Scripts\\python.exe generator/generate_alerts.py

Everything is seeded (random.seed / Faker.seed) so re-running produces the
same dataset. alerts.json is git-ignored (regenerated data); assets.csv and
mitre_map.json are committed as seed/reference data.
"""

import csv
import json
import random
from datetime import datetime, timedelta
from pathlib import Path

from faker import Faker

SEED = 42
random.seed(SEED)
fake = Faker()
Faker.seed(SEED)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DEMO_DATE = datetime(2026, 9, 26, 0, 0, 0)  # all alerts fall on this one day

# --- counts -----------------------------------------------------------
# The blueprint's "~85% / ~10% / ~5%" split doesn't leave room for the
# decoy's own "200+ alerts" example, so the decoy is generated as its own
# bucket alongside real noise, rather than squeezed into the 5% attack
# budget. Totals below sum to exactly 3,000.
NUM_BENIGN = 2440
NUM_SUSPICIOUS = 210
NUM_DECOY = 230
# the 4 real attack stories fill the rest (~120 alerts)

_alert_seq = 0


def next_id() -> str:
    global _alert_seq
    _alert_seq += 1
    return f"A-{_alert_seq:05d}"


def ts(base: datetime, minutes_offset: float) -> str:
    return (base + timedelta(minutes=minutes_offset)).strftime("%Y-%m-%d %H:%M:%S")


# --- asset inventory ----------------------------------------------------

def build_assets() -> list[dict]:
    """~40 assets. A handful are fixed (used by the planted attack stories
    and the decoy); the rest are filler for realistic background noise."""
    assets = [
        # host, type, owner, criticality
        {"host": "payroll-srv-01", "type": "Server", "owner": "Finance", "criticality": 10},
        {"host": "dc-01", "type": "Server", "owner": "IT", "criticality": 10},
        {"host": "hr-laptop-07", "type": "Laptop", "owner": "HR", "criticality": 6},
        {"host": "fin-laptop-03", "type": "Laptop", "owner": "Finance", "criticality": 7},
        {"host": "test-vm-01", "type": "VM", "owner": "QA", "criticality": 1},
        {"host": "jump-host-02", "type": "Server", "owner": "IT", "criticality": 8},
        {"host": "eng-lt-14", "type": "Laptop", "owner": "Engineering", "criticality": 4},
        {"host": "eng-srv-21", "type": "Server", "owner": "Engineering", "criticality": 8},
    ]
    owners = ["Finance", "HR", "IT", "Engineering", "Sales", "Support", "QA"]
    types_by_tier = [
        ("Server", (8, 9)), ("Laptop", (6, 7)), ("Laptop", (4, 5)), ("VM", (1, 2)),
    ]
    used_hosts = {a["host"] for a in assets}
    while len(assets) < 40:
        kind, (lo, hi) = random.choice(types_by_tier)
        owner = random.choice(owners)
        prefix = {"Server": "srv", "Laptop": "lt", "VM": "vm"}[kind]
        host = f"{owner.lower()}-{prefix}-{random.randint(1, 99):02d}"
        if host in used_hosts:
            continue
        used_hosts.add(host)
        assets.append({
            "host": host, "type": kind, "owner": owner,
            "criticality": random.randint(lo, hi),
        })
    return assets


def write_assets_csv(assets: list[dict]) -> None:
    path = DATA_DIR / "assets.csv"
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["host", "type", "owner", "criticality"])
        w.writeheader()
        w.writerows(assets)
    print(f"wrote {path} ({len(assets)} assets)")


# --- alert builders -------------------------------------------------------

def make_alert(host, user, alert_type, source, severity, timestamp,
               src_ip=None, dest_ip=None, raw_message="", is_true_positive=False):
    return {
        "alert_id": next_id(),
        "timestamp": timestamp,
        "source": source,
        "alert_type": alert_type,
        "severity": severity,
        "host": host,
        "user": user,
        "src_ip": src_ip or fake.ipv4_private(),
        "dest_ip": dest_ip or fake.ipv4_private(),
        "raw_message": raw_message,
        "is_true_positive": is_true_positive,
    }


def benign_noise(n: int, hosts: list[str]) -> list[dict]:
    kinds = [
        ("single_failed_login", "Auth", (1, 2), "single failed login for {user}"),
        ("av_scan_clean", "EDR", (1, 1), "scheduled AV scan completed, no threats found"),
        ("blocked_port_scan", "Firewall", (1, 2), "inbound port scan from {ip} blocked"),
        ("software_update", "EDR", (1, 1), "software update installed successfully"),
        ("password_change", "Auth", (1, 1), "self-service password change for {user}"),
        ("file_access_normal", "EDR", (1, 1), "routine file access by {user}"),
        ("vpn_login_normal", "Auth", (1, 1), "VPN login for {user} from known location"),
    ]
    out = []
    for _ in range(n):
        alert_type, source, (lo, hi), tmpl = random.choice(kinds)
        user = fake.user_name()
        ip = fake.ipv4_public()
        out.append(make_alert(
            host=random.choice(hosts), user=user, alert_type=alert_type, source=source,
            severity=random.randint(lo, hi),
            timestamp=ts(DEMO_DATE, random.uniform(0, 24 * 60)),
            src_ip=ip,
            raw_message=tmpl.format(user=user, ip=ip),
        ))
    return out


def suspicious_but_harmless(n: int, hosts: list[str]) -> list[dict]:
    kinds = [
        ("powershell_exec", "EDR", (2, 3), "admin ran a PowerShell script for scheduled maintenance"),
        ("vpn_login_new_city", "Auth", (2, 3), "VPN login for {user} from a new but plausible city"),
        ("large_backup_upload", "EDR", (2, 3), "large backup upload to approved backup server"),
    ]
    out = []
    for _ in range(n):
        alert_type, source, (lo, hi), tmpl = random.choice(kinds)
        user = fake.user_name()
        out.append(make_alert(
            host=random.choice(hosts), user=user, alert_type=alert_type, source=source,
            severity=random.randint(lo, hi),
            timestamp=ts(DEMO_DATE, random.uniform(0, 24 * 60)),
            raw_message=tmpl.format(user=user),
        ))
    return out


def decoy_test_vm(n: int) -> list[dict]:
    """A noisy but harmless test VM: 200+ low-severity port scans spread
    across the day on one low-criticality host. Should end up as ONE large
    incident with a LOW score, proving ranking uses criticality, not count."""
    out = []
    for _ in range(n):
        out.append(make_alert(
            host="test-vm-01", user="svc_qa", alert_type="port_scan", source="IDS",
            severity=random.randint(1, 2),
            timestamp=ts(DEMO_DATE, random.uniform(0, 24 * 60)),
            src_ip=fake.ipv4_public(),
            raw_message="port scan detected against test-vm-01",
        ))
    return out


def attack_brute_force_payroll() -> list[dict]:
    """Brute force -> data theft on the payroll server."""
    host, user = "payroll-srv-01", "svc_backup"
    start = DEMO_DATE + timedelta(hours=2, minutes=10)  # 02:10
    attacker_ip = fake.ipv4_public()
    out = []
    t = 0.0
    for i in range(24):  # 24 rapid failed logins
        out.append(make_alert(host, user, "failed_login_burst", "Auth", 4,
                               ts(start, t), src_ip=attacker_ip,
                               raw_message=f"failed login attempt {i + 1} for {user}",
                               is_true_positive=True))
        t += random.uniform(0.2, 0.8)
    t += 1
    out.append(make_alert(host, user, "login_after_failures", "Auth", 4, ts(start, t),
                           src_ip=attacker_ip,
                           raw_message=f"successful login for {user} after repeated failures",
                           is_true_positive=True))
    t += 3
    for _ in range(2):
        out.append(make_alert(host, user, "powershell_exec", "EDR", 5, ts(start, t),
                               src_ip=attacker_ip,
                               raw_message="PowerShell executed with encoded command",
                               is_true_positive=True))
        t += random.uniform(2, 5)
    for _ in range(2):
        out.append(make_alert(host, user, "large_upload_external", "IDS", 5, ts(start, t),
                               src_ip=attacker_ip, dest_ip=fake.ipv4_public(),
                               raw_message="2.1 GB upload to external IP",
                               is_true_positive=True))
        t += random.uniform(2, 5)
    return out


def attack_phishing_hr_laptop() -> list[dict]:
    """Phishing -> malware on an HR laptop."""
    host, user = "hr-laptop-07", fake.user_name()
    start = DEMO_DATE + timedelta(hours=10, minutes=5)
    c2_ip = fake.ipv4_public()
    out = [
        make_alert(host, user, "phishing_link_click", "Email", 3, ts(start, 0),
                   raw_message="user clicked a link in a suspicious email", is_true_positive=True),
        make_alert(host, user, "macro_execution", "EDR", 4, ts(start, 4),
                   raw_message="Office macro executed shell command", is_true_positive=True),
        make_alert(host, user, "scheduled_task_created", "EDR", 4, ts(start, 9),
                   raw_message="new scheduled task created for persistence", is_true_positive=True),
    ]
    t = 15
    for _ in range(19):  # repeated beacons -> ~25 alerts total for this story
        out.append(make_alert(host, user, "beacon_external", "IDS", 3, ts(start, t),
                               dest_ip=c2_ip, raw_message="periodic beacon to external host",
                               is_true_positive=True))
        t += random.uniform(8, 20)
    return out


def attack_lateral_movement_dc() -> list[dict]:
    """Lateral movement toward the domain controller."""
    entry_host = "eng-lt-14"
    hop_hosts = ["jump-host-02", "eng-srv-21", "dc-01"]
    user = "svc_admin"
    start = DEMO_DATE + timedelta(hours=1, minutes=30)
    out = [make_alert(entry_host, user, "credential_dump", "EDR", 5, ts(start, 0),
                       raw_message="credentials dumped from LSASS memory", is_true_positive=True)]
    t = 5
    prev = entry_host
    for hop in hop_hosts:
        for _ in range(random.randint(3, 4)):  # multiple attempts per hop
            out.append(make_alert(hop, user, "remote_login", "Auth", 4, ts(start, t),
                                   src_ip=None,
                                   raw_message=f"remote login to {hop} using {user} (from {prev})",
                                   is_true_positive=True))
            t += random.uniform(1, 4)
        prev = hop
    out.append(make_alert("dc-01", user, "admin_group_change", "EDR", 5, ts(start, t),
                           raw_message=f"{user} added to Domain Admins group",
                           is_true_positive=True))
    return out


def attack_insider_slow_leak() -> list[dict]:
    """Low-and-slow insider: repeated off-hours file access on one finance
    laptop, spaced ~15-20 min apart so the sliding 30-min correlation window
    keeps the whole overnight session as one incident, ending in an upload
    to a personal cloud service (adds an Exfiltration stage)."""
    host, user = "fin-laptop-03", "j.mehta"
    start = DEMO_DATE + timedelta(hours=1, minutes=0)  # 01:00, off-hours
    out = []
    t = 0.0
    for i in range(24):
        out.append(make_alert(host, user, "unusual_file_access", "EDR", 2, ts(start, t),
                               raw_message=f"off-hours access to finance file share (batch {i + 1})",
                               is_true_positive=True))
        t += random.uniform(12, 20)  # stays well under the 30-min window
    for _ in range(2):
        out.append(make_alert(host, user, "large_upload_external", "IDS", 4, ts(start, t),
                               dest_ip=fake.ipv4_public(),
                               raw_message="large upload to personal cloud storage",
                               is_true_positive=True))
        t += random.uniform(10, 18)
    return out


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    assets = build_assets()
    write_assets_csv(assets)
    filler_hosts = [a["host"] for a in assets if a["host"] not in
                    {"payroll-srv-01", "dc-01", "hr-laptop-07", "fin-laptop-03", "test-vm-01",
                     "jump-host-02", "eng-lt-14", "eng-srv-21"}]

    alerts = []
    alerts += benign_noise(NUM_BENIGN, filler_hosts)
    alerts += suspicious_but_harmless(NUM_SUSPICIOUS, filler_hosts)
    alerts += decoy_test_vm(NUM_DECOY)
    alerts += attack_brute_force_payroll()
    alerts += attack_phishing_hr_laptop()
    alerts += attack_lateral_movement_dc()
    alerts += attack_insider_slow_leak()

    random.shuffle(alerts)  # alert_id order stays chronological-ish; shuffle so file order isn't grouped by type

    out_path = DATA_DIR / "alerts.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(alerts, f, indent=2)

    tp = sum(1 for a in alerts if a["is_true_positive"])
    print(f"wrote {out_path}")
    print(f"total alerts: {len(alerts)}")
    print(f"  benign noise:            {NUM_BENIGN}")
    print(f"  suspicious but harmless: {NUM_SUSPICIOUS}")
    print(f"  decoy (test-vm-01):      {NUM_DECOY}")
    print(f"  planted attack alerts:   {tp} (across 4 stories)")


if __name__ == "__main__":
    main()
