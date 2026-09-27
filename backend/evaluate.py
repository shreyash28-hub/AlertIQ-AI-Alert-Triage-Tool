"""Reproducible evaluation of the AlertIQ triage engine.

Run:
    cd backend
    venv\\Scripts\\python.exe evaluate.py            # seed 42 (the demo dataset) + 20 other seeds + scale test
    venv\\Scripts\\python.exe evaluate.py --seeds 5  # fewer extra seeds, faster

Everything here is measured on the team's OWN synthetic dataset
(generator/generate_alerts.py). The ground-truth labels (`is_true_positive`,
`attack_id`) are used ONLY to score results after the fact; the triage
engine never reads them. Nothing here says anything about real-world
detection accuracy.

What can and cannot be claimed is printed at the end.
"""

import argparse
import json
import statistics
import time
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path

from engine.correlate import correlate
from engine.mitre import enrich, load_mitre_map
from engine.normalize import normalize
from engine.scoring import score_and_rank
from generator.generate_alerts import SEED, build_dataset

FLAG_THRESHOLD = 60.0   # "High" or above, per scoring._risk_level
TOP_K = 5


def _assets_dict(assets: list[dict]) -> dict:
    return {a["host"].lower(): {"type": a["type"], "owner": a["owner"],
                                "criticality": int(a["criticality"])} for a in assets}


def run_engine(raw_alerts, assets, grouping=None):
    """Full pipeline on in-memory data. grouping=None uses the real
    correlation engine; a callable replaces it (used for the baseline)."""
    alerts = normalize(raw_alerts, _assets_dict(assets))
    enrich(alerts, load_mitre_map())
    groups = correlate(alerts) if grouping is None else grouping(alerts)
    return alerts, score_and_rank(groups)


def _host_day_grouping(alerts):
    """Baseline: no correlation at all - one group per host per calendar day."""
    by = defaultdict(list)
    for a in alerts:
        by[(a["host"], a["timestamp"].date())].append(a)
    return [{"alerts": g, "is_rollup": False} for g in by.values()]


def _attack_stats(alerts, incidents):
    """Per-attack-story ranking and correlation quality (needs attack_id labels)."""
    inc_of = {}
    for inc in incidents:
        for aid in inc["alert_ids"]:
            inc_of[aid] = inc["incident_id"]
    rank_of = {inc["incident_id"]: r for r, inc in enumerate(incidents, start=1)}
    inc_by_id = {inc["incident_id"]: inc for inc in incidents}
    story_alerts = defaultdict(list)
    for a in alerts:
        if a.get("attack_id"):
            story_alerts[a["attack_id"]].append(a)

    out = {}
    for story, al in sorted(story_alerts.items()):
        spread = Counter(inc_of[a["alert_id"]] for a in al)
        main_id, main_n = spread.most_common(1)[0]
        main = inc_by_id[main_id]
        out[story] = {
            "story_alerts": len(al),
            "incidents_containing_story": len(spread),          # 1 = story kept whole
            "rank_of_main_incident": rank_of[main_id],
            "main_incident_score": main["risk_score"],
            "story_alerts_in_main_incident": main_n,
            "story_recall_in_main_incident": round(main_n / len(al), 3),
            "main_incident_purity": round(main_n / main["alert_count"], 3),  # share of the incident that is attack alerts
        }
    return out


def evaluate_dataset(raw_alerts, assets, grouping=None):
    alerts, incidents = run_engine(raw_alerts, assets, grouping)
    label = {a["alert_id"]: bool(a["is_true_positive"]) for a in alerts}
    n_unique = len(alerts)
    n_inc = len(incidents)

    for inc in incidents:
        inc["_has_attack"] = any(label[i] for i in inc["alert_ids"])
    attack_incs = [i for i in incidents if i["_has_attack"]]
    top = incidents[:TOP_K]
    tp_top = sum(1 for i in top if i["_has_attack"])
    story = _attack_stats(alerts, incidents)
    n_stories = len(story)

    flagged = [i for i in incidents if i["risk_score"] >= FLAG_THRESHOLD]
    tp = sum(1 for i in flagged if i["_has_attack"])
    fp = len(flagged) - tp
    fn = len(attack_incs) - tp
    tn = n_inc - len(flagged) - fn

    attack_alerts_total = sum(label.values())
    attack_alerts_flagged = sum(1 for i in flagged for a in i["alert_ids"] if label[a])
    alerts_in_flagged = sum(i["alert_count"] for i in flagged)

    decoy = [(r, i) for r, i in enumerate(incidents, start=1) if i["primary_host"] == "test-vm-01"]

    return {
        "alerts_unique": n_unique,
        "attack_alerts": attack_alerts_total,
        "attack_stories": n_stories,
        "incidents": n_inc,
        "incidents_not_routine": sum(1 for i in incidents if not _is_rollup_like(i)),
        "review_volume_reduction_pct": round((1 - n_inc / n_unique) * 100, 2),
        "incidents_containing_attack": len(attack_incs),
        f"attack_incidents_in_top_{TOP_K}": tp_top,
        f"precision_at_{TOP_K}": round(tp_top / TOP_K, 3),
        f"recall_at_{TOP_K}": round(tp_top / len(attack_incs), 3) if attack_incs else None,
        "ranks_of_attack_incidents": [r for r, i in enumerate(incidents, start=1) if i["_has_attack"]],
        "stories": story,
        "incident_level_at_score_ge_60": {
            "flagged": len(flagged), "TP": tp, "FP": fp, "FN": fn, "TN": tn,
            "precision": round(tp / len(flagged), 3) if flagged else None,
            "recall": round(tp / (tp + fn), 3) if tp + fn else None,
            "false_positive_rate": round(fp / (fp + tn), 3) if fp + tn else None,
        },
        "alert_level_at_score_ge_60": {
            "attack_alerts_in_flagged_incidents": attack_alerts_flagged,
            "alert_recall": round(attack_alerts_flagged / attack_alerts_total, 3),
            "alerts_to_review_in_flagged_incidents": alerts_in_flagged,
        },
        "decoy_test_vm": [{"rank": r, "score": i["risk_score"], "alerts": i["alert_count"],
                           "title": i["title"]} for r, i in decoy],
        "top5": [{"rank": r, "score": i["risk_score"], "alerts": i["alert_count"],
                  "host": i["primary_host"], "level": i["risk_level"],
                  "contains_attack": i["_has_attack"]} for r, i in enumerate(top, start=1)],
    }


def _is_rollup_like(inc):
    return inc["title"].startswith("Routine activity")


def severity_baseline(raw_alerts):
    """Baseline: review raw alerts by descending severity (no correlation).
    For each attack story, the position of its earliest-reached alert.
    Ties in severity are unresolvable from the data, so report the best and
    worst case: best = attack alert is first among equal-severity alerts,
    worst = it is last."""
    sev = Counter(a["severity"] for a in raw_alerts)
    greater = lambda s: sum(c for k, c in sev.items() if k > s)
    at_least = lambda s: sum(c for k, c in sev.items() if k >= s)
    best_sev = defaultdict(int)
    for a in raw_alerts:
        if a.get("attack_id"):
            best_sev[a["attack_id"]] = max(best_sev[a["attack_id"]], a["severity"])
    return {s: {"max_severity": v, "best_case_position": greater(v) + 1, "worst_case_position": at_least(v)}
            for s, v in sorted(best_sev.items())}


def scale_test(raw_alerts, assets, days):
    """Replicate the dataset over N days (new ids, shifted timestamps) and
    time the engine only (in-memory; no database, no AI)."""
    big = []
    for d in range(days):
        for a in raw_alerts:
            b = dict(a)
            b["alert_id"] = f"{a['alert_id']}-d{d}"
            t = datetime.strptime(a["timestamp"], "%Y-%m-%d %H:%M:%S") + timedelta(days=d)
            b["timestamp"] = t.strftime("%Y-%m-%d %H:%M:%S")
            big.append(b)
    t0 = time.perf_counter()
    alerts, incidents = run_engine(big, assets)
    secs = time.perf_counter() - t0
    return {"alerts": len(alerts), "incidents": len(incidents), "seconds": round(secs, 2)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seeds", type=int, default=20, help="number of additional seeds to test")
    ap.add_argument("--scale-days", type=int, default=10)
    args = ap.parse_args()

    assets, raw = build_dataset(SEED)
    res = {"dataset": {"seed": SEED, "raw_alerts": len(raw), "assets": len(assets)}}

    print(f"== Demo dataset (seed {SEED}): {len(raw)} raw alerts, {len(assets)} assets ==")
    main_res = evaluate_dataset(raw, assets)
    res["alertiq"] = main_res
    print(f"unique alerts after de-duplication : {main_res['alerts_unique']}")
    print(f"planted attack alerts / stories     : {main_res['attack_alerts']} / {main_res['attack_stories']}")
    print(f"incidents                           : {main_res['incidents']}")
    print(f"review-volume reduction             : {main_res['review_volume_reduction_pct']}%  (1 - incidents/alerts; NOT a false-positive rate)")
    print(f"attack incidents in top {TOP_K}          : {main_res[f'attack_incidents_in_top_{TOP_K}']}/{main_res['incidents_containing_attack']}"
          f"   ranks of attack incidents: {main_res['ranks_of_attack_incidents']}")
    print(f"precision@{TOP_K} / recall@{TOP_K}            : {main_res[f'precision_at_{TOP_K}']} / {main_res[f'recall_at_{TOP_K}']}")
    for s, v in main_res["stories"].items():
        print(f"  {s:22s} rank {v['rank_of_main_incident']:2d}  score {v['main_incident_score']:5.1f}  "
              f"in {v['incidents_containing_story']} incident(s)  story recall {v['story_recall_in_main_incident']}  "
              f"incident purity {v['main_incident_purity']}")
    il = main_res["incident_level_at_score_ge_60"]
    print(f"incident-level @ score>=60          : flagged {il['flagged']}  TP {il['TP']} FP {il['FP']} FN {il['FN']} TN {il['TN']}"
          f"  precision {il['precision']} recall {il['recall']} FPR {il['false_positive_rate']}")
    al = main_res["alert_level_at_score_ge_60"]
    print(f"alert-level @ score>=60             : {al['attack_alerts_in_flagged_incidents']}/{main_res['attack_alerts']} attack alerts inside flagged incidents "
          f"(alert recall {al['alert_recall']}); analyst reads {al['alerts_to_review_in_flagged_incidents']} alerts' worth of flagged incidents")
    print(f"decoy test-vm-01 incident(s)        : {main_res['decoy_test_vm']}")
    print("top 5:")
    for t in main_res["top5"]:
        print(f"  {t['rank']}. score {t['score']:5.1f} {t['level']:8s} {t['alerts']:3d} alerts  {t['host']:16s} {'ATTACK' if t['contains_attack'] else ''}")

    print("\n== Baseline A: rank raw alerts by severity only (no correlation) ==")
    sb = severity_baseline(raw)
    res["baseline_severity_only"] = sb
    for s, v in sb.items():
        print(f"  {s:22s} max severity {v['max_severity']}  first alert of story is at position {v['best_case_position']}-{v['worst_case_position']} of {len(raw)}")

    print("\n== Baseline B: group by host+day (no correlation window, no cross-host linking), same scoring ==")
    b = evaluate_dataset(raw, assets, grouping=_host_day_grouping)
    res["baseline_host_day"] = {k: b[k] for k in ("incidents", "review_volume_reduction_pct", f"attack_incidents_in_top_{TOP_K}",
                                                   "incidents_containing_attack", "ranks_of_attack_incidents", "stories")}
    print(f"  incidents {b['incidents']}  attack incidents in top {TOP_K}: {b[f'attack_incidents_in_top_{TOP_K}']}/{b['incidents_containing_attack']}  "
          f"ranks {b['ranks_of_attack_incidents']}")
    for s, v in b["stories"].items():
        print(f"  {s:22s} split across {v['incidents_containing_story']} incident(s)  story recall in main {v['story_recall_in_main_incident']}")

    print(f"\n== Robustness: {args.seeds} other generator seeds (1..{args.seeds}) - thresholds were tuned on seed {SEED} ==")
    rows = []
    for sd in range(1, args.seeds + 1):
        a2, r2 = build_dataset(sd)
        e = evaluate_dataset(r2, a2)
        whole = sum(1 for v in e["stories"].values() if v["incidents_containing_story"] == 1)
        rows.append({"seed": sd, "incidents": e["incidents"], "reduction": e["review_volume_reduction_pct"],
                     "attack_in_top5": e[f"attack_incidents_in_top_{TOP_K}"], "attack_incidents": e["incidents_containing_attack"],
                     "worst_attack_rank": max(e["ranks_of_attack_incidents"]) if e["ranks_of_attack_incidents"] else None,
                     "stories_kept_whole": whole})
    res["other_seeds"] = rows
    if rows:
        print(f"  attack incidents in top {TOP_K} (of 4 stories): min {min(r['attack_in_top5'] for r in rows)}, "
              f"mean {statistics.mean(r['attack_in_top5'] for r in rows):.2f}")
        print(f"  seeds with all 4 in top {TOP_K}: {sum(1 for r in rows if r['attack_in_top5'] == 4)}/{len(rows)}")
        print(f"  stories kept in a single incident: min {min(r['stories_kept_whole'] for r in rows)}/4, "
              f"mean {statistics.mean(r['stories_kept_whole'] for r in rows):.2f}/4")
        print(f"  incidents: {min(r['incidents'] for r in rows)}-{max(r['incidents'] for r in rows)}; "
              f"review-volume reduction: {min(r['reduction'] for r in rows)}-{max(r['reduction'] for r in rows)}%")

    print(f"\n== Scale: dataset replicated over {args.scale_days} days (engine only, in-memory) ==")
    sc = scale_test(raw, assets, args.scale_days)
    res["scale"] = sc
    print(f"  {sc['alerts']:,} alerts -> {sc['incidents']} incidents in {sc['seconds']} s")

    print("""
== What can and cannot be claimed ==
CAN (on the team's synthetic dataset, reproducible with this script):
  - review-volume reduction from raw alerts to incidents
  - whether planted attacks rank in the top-k, story fragmentation, incident purity
  - incident-level precision/recall/FPR at a fixed score threshold (labels are synthetic)
  - engine run time on the replicated dataset
CANNOT (labels / data do not support it):
  - "noise reduction" as a false-positive rate: the label says 'part of a planted attack', not 'proven benign'
  - any detection accuracy on real-world traffic or real attacks
  - superiority over SIEM/XDR products (no baseline against them was run)
  - analyst time saved (no timed study was run; the app's MTTT figures are assumptions: 1 min/alert vs 2 min/incident)
  - AI-brief quality (no rating study was run)
""")

    out = Path(__file__).parent / "evaluation_results.json"
    out.write_text(json.dumps(res, indent=2), encoding="utf-8")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
