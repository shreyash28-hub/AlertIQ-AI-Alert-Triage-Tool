import { Navigate, Route, Routes } from "react-router-dom"
import { AppLayout } from "@/components/AppLayout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import Dashboard from "@/pages/Dashboard"
import IncidentDetail from "@/pages/IncidentDetail"
import Landing from "@/pages/Landing"
import Login from "@/pages/Login"
import Metrics from "@/pages/Metrics"
import Signup from "@/pages/Signup"
import Simulator from "@/pages/Simulator"

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="incidents/:id" element={<IncidentDetail />} />
        <Route path="metrics" element={<Metrics />} />
        <Route path="simulator" element={<Simulator />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
