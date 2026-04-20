import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import AppLayout from './components/layout/AppLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Equipment from './pages/Equipment'
import UnitProfile from './pages/UnitProfile'
import WorkOrders from './pages/WorkOrders'
import OpenInvoices from './pages/OpenInvoices'
import Fleet from './pages/Fleet'
import Rentals from './pages/Rentals'
import Inventory from './pages/Inventory'
import Reports from './pages/Reports'
import AuditLog from './pages/AuditLog'
import Settings from './pages/Settings'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-cat-yellow font-display text-lg uppercase tracking-wider">
          Loading...
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-cat-yellow font-display text-lg uppercase tracking-wider">
          Loading...
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/equipment" element={<Equipment />} />
        <Route path="/equipment/:id" element={<UnitProfile />} />
        <Route path="/work-orders" element={<WorkOrders />} />
        <Route path="/open-invoices" element={<OpenInvoices />} />
        <Route path="/fleet" element={<Fleet />} />
        <Route path="/rentals" element={<Rentals />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/audit-log" element={<AuditLog />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
