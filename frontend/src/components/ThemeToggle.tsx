import { Laptop, Moon, Sun } from "lucide-react"
import { useTheme, type ThemePreference } from "@/lib/theme"
import { cn } from "@/lib/utils"

const options: { value: ThemePreference; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "system", icon: Laptop, label: "System" },
]

export function ThemeToggle() {
  const { preference, setPreference } = useTheme()

  return (
    <div className="flex items-center gap-1 rounded-lg border border-sidebar-border bg-sidebar-accent/50 p-1">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          title={label}
          aria-label={label}
          onClick={() => setPreference(value)}
          className={cn(
            "flex flex-1 items-center justify-center rounded-md py-1.5 transition-colors",
            preference === value
              ? "bg-primary text-primary-foreground"
              : "text-sidebar-foreground/60 hover:text-sidebar-foreground",
          )}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  )
}
