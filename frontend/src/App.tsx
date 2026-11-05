import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LandingPage from './pages/LandingPage'
import Dashboard from './pages/Dashboard'
import ProfilePage from './pages/ProfilePage'
import FlashTradePage from './pages/FlashTradePage'
import Navbar from './components/Navbar'

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
          <p className="text-xs uppercase tracking-widest font-semibold text-text-muted">
            Initialising WorldAuth...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col selection:bg-accent-soft selection:text-accent">
      {isAuthenticated && <Navbar />}
      <div className="flex-1 flex flex-col">
        <Routes>
          <Route
            path="/"
            element={isAuthenticated ? <Dashboard /> : <LandingPage />}
          />
          <Route
            path="/flash-trade"
            element={<FlashTradePage />}
          />
          <Route
            path="/profile"
            element={isAuthenticated ? <ProfilePage /> : <Navigate to="/" replace />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
