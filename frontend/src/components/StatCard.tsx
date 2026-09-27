import { useEffect, useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

// Numbers count up on load - shows the scale of the reduction (blueprint's
// Motion animation rules). Skips the animation under prefers-reduced-motion.
function useCountUp(target: number, durationMs = 500) {
  const reduceMotion = useReducedMotion()
  const [value, setValue] = useState(reduceMotion ? target : 0)

  useEffect(() => {
    if (reduceMotion) {
      setValue(target)
      return
    }
    let raf: number
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1)
      setValue(target * (1 - Math.pow(1 - progress, 3))) // ease-out cubic
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs, reduceMotion])

  return value
}

export function StatCard({
  label,
  value,
  suffix = "",
  decimals = 0,
  icon: Icon,
  className,
}: {
  label: string
  value: number
  suffix?: string
  decimals?: number
  icon?: LucideIcon
  className?: string
}) {
  const animated = useCountUp(value)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -2 }}
    >
      <Card className={cn("transition-shadow hover:shadow-lg hover:shadow-black/20", className)}>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="font-mono text-2xl font-semibold tabular-nums">
              {animated.toFixed(decimals)}
              {suffix}
            </p>
          </div>
          {Icon && <Icon className="size-8 text-primary/60" />}
        </CardContent>
      </Card>
    </motion.div>
  )
}
