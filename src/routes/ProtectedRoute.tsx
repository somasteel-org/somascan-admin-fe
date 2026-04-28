import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { getMe } from '../api/auth'
import { useAuth } from '../hooks/useAuth'
import { sanitizeRedirectPath } from '../utils/routing'

export function ProtectedRoute() {
  const { isAuthenticated, hasHydrated, user, setUser, logout } = useAuth()
  const location = useLocation()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let active = true

    async function validateSession() {
      if (!hasHydrated || !isAuthenticated) {
        if (active) setChecking(false)
        return
      }

      try {
        const currentUser = await getMe()
        const normalizedRole = String(currentUser.role).toUpperCase()

        if (normalizedRole !== 'ADMIN') {
          logout()
          return
        }

        if (active) {
          setUser({
            id: currentUser.id,
            name: currentUser.name,
            email: currentUser.email,
            role: normalizedRole,
            location: currentUser.location ?? null,
          })
          setChecking(false)
        }
      } catch (error) {
        const status = (error as { response?: { status?: number } })?.response?.status

        if (status === 401 || status === 403) {
          logout()
          return
        }

        if (active) {
          setChecking(false)
        }
      }
    }

    void validateSession()

    return () => {
      active = false
    }
  }, [hasHydrated, isAuthenticated, logout, setUser])

  if (!hasHydrated) {
    return <p className="p-6 text-sm text-zinc-500">Vérification de la session...</p>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: sanitizeRedirectPath(`${location.pathname}${location.search}`) }} />
  }

  if (!checking && String(user?.role ?? '').toUpperCase() !== 'ADMIN') {
    return <Navigate to="/unauthorized" replace />
  }

  if (checking) {
    return <p className="p-6 text-sm text-zinc-500">Vérification de la session...</p>
  }

  return <Outlet />
}
