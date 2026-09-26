// Mirrors backend/data/mitre_map.json (copied into src/data - see that
// file's header comment in ai/summarizer.py for why: it's the same fix for
// the same problem, here so AttackChain can group techniques under the
// right tactic without a backend call).

import mitreMap from "@/data/mitre_map.json"

export const KILL_CHAIN_ORDER = [
  "Initial Access", "Execution", "Persistence", "Privilege Escalation",
  "Defense Evasion", "Credential Access", "Discovery", "Lateral Movement",
  "Collection", "Command and Control", "Exfiltration", "Impact",
]

type MitreEntry = { technique: string | null; name: string | null; tactic: string | null }

const TECHNIQUE_TACTIC: Record<string, string> = {}
const TECHNIQUE_NAME: Record<string, string> = {}
for (const entry of Object.values(mitreMap) as MitreEntry[]) {
  if (entry.technique && entry.tactic) {
    TECHNIQUE_TACTIC[entry.technique] = entry.tactic
    if (entry.name) TECHNIQUE_NAME[entry.technique] = entry.name
  }
}

export function tacticFor(technique: string): string {
  return TECHNIQUE_TACTIC[technique] ?? "Unknown"
}

export function nameFor(technique: string): string {
  return TECHNIQUE_NAME[technique] ?? technique
}

/** Groups a flat technique list by tactic, ordered along the kill chain. */
export function groupByTactic(techniques: string[]): { tactic: string; techniques: string[] }[] {
  const byTactic = new Map<string, string[]>()
  for (const t of techniques) {
    const tactic = tacticFor(t)
    if (!byTactic.has(tactic)) byTactic.set(tactic, [])
    byTactic.get(tactic)!.push(t)
  }
  return [...byTactic.entries()]
    .sort(([a], [b]) => {
      const ia = KILL_CHAIN_ORDER.indexOf(a)
      const ib = KILL_CHAIN_ORDER.indexOf(b)
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
    })
    .map(([tactic, techniques]) => ({ tactic, techniques }))
}
