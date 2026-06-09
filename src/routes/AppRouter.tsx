import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AdminLayout } from '../layouts/AdminLayout'
import { DashboardPage } from '../pages/DashboardPage'
import { LoginPage } from '../pages/LoginPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { ReportsPage } from '../pages/ReportsPage'
import { ScanFlowPage } from '../pages/ScanFlowPage'
import { ScanLogsPage } from '../pages/ScanLogsPage'
import { TripDetailPage } from '../pages/TripDetailPage'
import { TripsPage } from '../pages/TripsPage'
import { UnauthorizedPage } from '../pages/UnauthorizedPage'
import { TrucksPage } from '../pages/TrucksPage'
import { UsersPage } from '../pages/UsersPage'

import { ROUTER_MODE } from '../utils/constants'
import { ProtectedRoute } from './ProtectedRoute'

export function AppRouter() {
  const Router = ROUTER_MODE === 'hash' ? HashRouter : BrowserRouter

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AdminLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/trucks" element={<TrucksPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/trips" element={<TripsPage />} />
            <Route path="/trips/:id" element={<TripDetailPage />} />

            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/scan-logs" element={<ScanLogsPage />} />
            <Route path="/scan-flow" element={<ScanFlowPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
  )
}
