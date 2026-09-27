import { motion } from "motion/react"
import { Outlet, useLocation } from "react-router-dom"
import { Sidebar } from "./Sidebar"

export function AppLayout() {
  const { pathname } = useLocation()
  return (
    // h-screen + overflow-hidden (not min-h-screen) confines scrolling to
    // <main> only, so the sidebar stays put instead of scrolling away with
    // the page - that was the "sign out button moves upward" bug.
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  )
}
