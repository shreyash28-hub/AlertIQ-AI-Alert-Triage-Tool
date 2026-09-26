import { Outlet } from "react-router-dom"
import { Sidebar } from "./Sidebar"

export function AppLayout() {
  return (
    // h-screen + overflow-hidden (not min-h-screen) confines scrolling to
    // <main> only, so the sidebar stays put instead of scrolling away with
    // the page - that was the "sign out button moves upward" bug.
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
