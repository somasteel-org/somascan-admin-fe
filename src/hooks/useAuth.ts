import { useAuthStore } from '../store/authStore'

export function useAuth() {
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)
  const expiresAt = useAuthStore((state) => state.expiresAt)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const hasHydrated = useAuthStore((state) => state.hasHydrated)
  const setAuth = useAuthStore((state) => state.setAuth)
  const setUser = useAuthStore((state) => state.setUser)
  const logout = useAuthStore((state) => state.logout)
  const hydrate = useAuthStore((state) => state.hydrate)

  return { token, user, expiresAt, isAuthenticated, hasHydrated, setAuth, setUser, logout, hydrate }
}
