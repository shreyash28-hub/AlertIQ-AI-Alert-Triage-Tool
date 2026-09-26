import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Gauge,
  Layers,
  Server,
  Shield,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react"
import { motion } from "motion/react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const steps = [
  { icon: Database, title: "Ingest", desc: "Thousands of raw alerts from firewalls, EDR, IDS, auth and email land in one place." },
  { icon: Layers, title: "Correlate", desc: "Alerts that share a host, user or external IP within a rolling window merge into one incident." },
  { icon: Target, title: "MITRE map", desc: "Every alert type is mapped to an ATT&CK technique and tactic, showing kill-chain progression." },
  { icon: Gauge, title: "Score & rank", desc: "A 0-100 risk score weighs severity, asset criticality, kill-chain progress and anomalies." },
  { icon: BrainCircuit, title: "AI brief", desc: "Phi-4-mini writes a 5-line shift-handover brief for the incidents that matter most." },
  { icon: ClipboardCheck, title: "Decide", desc: "An analyst confirms, dismisses or escalates. Nothing closes itself. Every decision is logged." },
]

const stats = [
  { value: "98.7%", label: "fewer items to review" },
  { value: "4/4", label: "planted attacks ranked in the top 5" },
  { value: "<2h", label: "triage time per shift, down from ~50h" },
]

const tech = [
  "Microsoft Phi-4-mini", "MITRE ATT&CK", "Supabase", "FastAPI", "React", "Ollama",
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div
            className="flex size-8 items-center justify-center rounded-lg"
            style={{ backgroundImage: "var(--gradient-brand)" }}
          >
            <Shield className="size-4.5 text-white" />
          </div>
          <span className="text-lg font-semibold tracking-tight">AlertIQ</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/login">
            <Button variant="ghost">Sign in</Button>
          </Link>
          <Link to="/signup">
            <Button>Get started</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-16 pb-24 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-32 -z-10 mx-auto h-96 max-w-3xl opacity-25 blur-3xl"
          style={{ backgroundImage: "var(--gradient-brand)" }}
        />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            Microsoft Hackathon &mdash; "3,000 Alerts, One Analyst"
          </div>
          <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            3,000 alerts a day.{" "}
            <span className="text-gradient-brand">One analyst.</span>{" "}
            AlertIQ makes it possible.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            AlertIQ groups, maps and ranks the noise into the handful of incidents that
            actually matter &mdash; then writes the shift-handover brief for you.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link to="/signup">
              <Button size="lg" className="gap-2">
                Sign up free <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline">Sign in</Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Stats */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.1 }}
            >
              <Card>
                <CardContent className="text-center">
                  <p className="text-gradient-brand font-mono text-3xl font-bold">{s.value}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-3xl px-6 pb-20 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">The problem</h2>
        <p className="mt-3 text-muted-foreground">
          A tier-1 analyst at a managed security provider gets thousands of alerts a day.
          Most are false positives. Real attacks get buried, and reviewing every alert by
          hand is impossible. Think of a building with 100 cameras and one guard &mdash;
          every cat or shadow triggers a beep. AlertIQ is the guard's helper.
        </p>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="mb-8 text-center text-2xl font-semibold tracking-tight">How it works</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.06 }}
            >
              <Card className="h-full">
                <CardContent className="flex flex-col gap-2">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-accent">
                    <step.icon className="size-4.5 text-accent-foreground" />
                  </div>
                  <p className="font-medium">{i + 1}. {step.title}</p>
                  <p className="text-sm text-muted-foreground">{step.desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Human in the loop */}
      <section className="mx-auto max-w-3xl px-6 pb-20 text-center">
        <ShieldCheck className="mx-auto mb-3 size-8 text-primary" />
        <h2 className="text-2xl font-semibold tracking-tight">The AI explains. You decide.</h2>
        <p className="mt-3 text-muted-foreground">
          The risk score and ranking come from a transparent rule engine &mdash; not a black
          box. The AI only writes the summary. Every incident starts as New, and only an
          analyst can confirm, dismiss or escalate it. Every decision is logged with who,
          when, and why.
        </p>
      </section>

      {/* Tech */}
      <section className="mx-auto max-w-4xl px-6 pb-20 text-center">
        <p className="mb-4 text-sm font-medium text-muted-foreground">Built with</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {tech.map((t) => (
            <span key={t} className="rounded-full border border-border bg-card px-3 py-1 text-sm">
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 pb-24 text-center">
        <Card className="mx-auto max-w-2xl overflow-hidden">
          <div className="h-1 w-full" style={{ backgroundImage: "var(--gradient-brand)" }} />
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <CheckCircle2 className="size-8 text-primary" />
            <h2 className="text-xl font-semibold">Ready to see it in action?</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Create a free analyst account and run a live triage in seconds.
            </p>
            <Link to="/signup">
              <Button size="lg" className="gap-2">
                Sign up free <ArrowRight className="size-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>

      <footer className="border-t border-border px-6 py-8 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-1.5">
          <Server className="size-3.5" /> AlertIQ &mdash; a Microsoft Hackathon project
        </div>
      </footer>
    </div>
  )
}
