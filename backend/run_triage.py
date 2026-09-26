"""Phase 2 checkpoint script — run the triage engine end to end and print a
terminal summary, with no API or database involved.

Run:
    cd backend
    venv\\Scripts\\python.exe run_triage.py
"""

from engine.pipeline import run_triage


def main():
    result = run_triage()
    incidents = result["incidents"]

    print(f"{result['total_alerts']:,} alerts -> {result['total_incidents']} incidents "
          f"({result['duration_ms']} ms)")
    reduction = 1 - result["total_incidents"] / result["total_alerts"]
    print(f"noise reduction: {reduction:.1%}")

    print("\nTop 5 incidents:")
    top5 = incidents[:5]
    for rank, inc in enumerate(top5, start=1):
        flag = "PLANTED ATTACK" if inc["contains_planted_attack"] else ""
        print(f"  {rank}. {inc['incident_id']}  {inc['risk_level']:8s} "
              f"score={inc['risk_score']:5.1f}  {inc['alert_count']:3d} alerts  "
              f"{inc['title']}  {flag}")

    planted_total = sum(1 for inc in incidents if inc["contains_planted_attack"])
    planted_in_top5 = sum(1 for inc in top5 if inc["contains_planted_attack"])
    print(f"\nplanted-attack incidents found: {planted_total} "
          f"(expected 4: brute force, phishing, lateral movement, insider)")
    print(f"planted-attack incidents in top 5: {planted_in_top5}/{planted_total}")

    decoy = next((inc for inc in incidents if inc["primary_host"] == "test-vm-01"), None)
    if decoy:
        rank = incidents.index(decoy) + 1
        print(f"\ndecoy (test-vm-01): rank {rank}/{len(incidents)}, "
              f"score={decoy['risk_score']}, level={decoy['risk_level']}, "
              f"{decoy['alert_count']} alerts")


if __name__ == "__main__":
    main()
