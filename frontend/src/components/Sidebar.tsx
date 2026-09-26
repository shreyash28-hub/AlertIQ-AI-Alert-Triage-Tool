import { useQuery } from "@tanstack/react-query"
import { LayoutDashboard, LogOut, Radio, Shield, BarChart3 } from "lucide-react"
import { NavLink } from "react-router-dom"
import { ThemeToggle } from "@/components/ThemeToggle"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"

export function Sidebar() {
  const { session } = useAuth()
  const email = session?.user.email ?? ""
  const fullName = (session?.user.user_metadata?.full_name as string | undefined) ?? email.split("@")[0]
  const initials = fullName.slice(0, 2).toUpperCase()

  const { data: incidents } = useQuery({
    queryKey: ["incidents", "all"],
    queryFn: () => api.listIncidents(),
    staleTime: 30_000,
  })
  const pendingCount = incidents?.filter((i) => i.status === "New").length ?? 0

  const links = [
    { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true, badge: pendingCount },
    { to: "/app/metrics", label: "Metrics", icon: BarChart3, end: false, badge: 0 },
  ]

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-4 py-5">
        <div
          className="flex size-7 items-center justify-center rounded-lg"
          style={{ backgroundImage: "var(--gradient-brand)" }}
        >
          <Shield className="size-4 text-white" />
        </div>
        <span className="text-lg font-semibold tracking-tight">AlertIQ</span>
      </div>

      <div className="mx-3 mb-3 flex items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {initials || "AN"}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{fullName || "Analyst"}</p>
          <p className="truncate text-xs text-sidebar-foreground/60">Tier-1 Analyst</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {links.map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )
            }
          >
            <Icon className="size-4" />
            <span className="flex-1">{label}</span>
            {badge > 0 && (
              <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1 text-xs">
                {badge}
              </Badge>
            )}
          </NavLink>
        ))}

        <div className="mt-auto flex items-center gap-2 rounded-md px-3 py-2 text-xs text-sidebar-foreground/50">
          <Radio className="size-3.5 text-green-500" />
          Live via Supabase Realtime
        </div>
      </nav>

      <div className="flex flex-col gap-3 border-t border-sidebar-border p-3">
        <ThemeToggle />
        <button
          onClick={() => supabase.auth.signOut()}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
