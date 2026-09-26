// Light / dark / system theme, persisted in localStorage. Deliberately
// hand-rolled instead of next-themes (removed in Phase 6) - it's ~30 lines
// and we don't need SSR support.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

export type ThemePreference = "light" | "dark" | "system"

const STORAGE_KEY = "alertiq-theme"

interface ThemeContextValue {
  preference: ThemePreference
  resolved: "light" | "dark"
  setPreference: (p: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

function readStored(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === "light" || stored === "dark" || stored === "system") return stored
  } catch {
    // localStorage unavailable (private browsing etc.) - fall through
  }
  return "dark"
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStored)
  const [resolved, setResolved] = useState<"light" | "dark">(() =>
    preference === "system" ? (systemPrefersDark() ? "dark" : "light") : preference,
  )

  useEffect(() => {
    const next = preference === "system" ? (systemPrefersDark() ? "dark" : "light") : preference
    setResolved(next)
    document.documentElement.classList.toggle("dark", next === "dark")

    if (preference !== "system") return
    const mql = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => {
      const sysDark = mql.matches
      setResolved(sysDark ? "dark" : "light")
      document.documentElement.classList.toggle("dark", sysDark)
    }
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [preference])

  function setPreference(p: ThemePreference) {
    setPreferenceState(p)
    try {
      localStorage.setItem(STORAGE_KEY, p)
    } catch {
      // ignore - non-fatal
    }
  }

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider")
  return ctx
}
