import { create } from 'zustand'
import { AUTH_TOKEN_KEY, AUTH_USER_KEY } from '../utils/constants'

interface AuthUser {
  id: number
  name: string
  email: string
  role: string
  location?: 'COMPANY' | 'PORT' | null
}

interface AuthState {
  token: string | null
  user: AuthUser | null
  expiresAt: string | null
  isAuthenticated: boolean
  hasHydrated: boolean
  setAuth: (token: string, user: AuthUser, expiresAt?: string | null) => void
  setUser: (user: AuthUser) => void
  logout: () => void
  hydrate: () => void
}

function readUserFromStorage(): AuthUser | null {
  if (typeof window === 'undefined') return null

  const userRaw = localStorage.getItem(AUTH_USER_KEY)
  if (!userRaw) return null

  try {
    return JSON.parse(userRaw) as AuthUser
  } catch {
    return null
  }
}

function getInitialAuthState() {
  if (typeof window === 'undefined') {
    return {
      token: null,
      user: null,
      expiresAt: null,
      isAuthenticated: false,
      hasHydrated: false,
    }
  }

  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  const user = readUserFromStorage()

  if (!token || !user) {
    return {
      token: null,
      user: null,
      expiresAt: null,
      isAuthenticated: false,
      hasHydrated: true,
    }
  }

  return {
    token,
    user,
    expiresAt: null,
    isAuthenticated: true,
    hasHydrated: true,
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  ...getInitialAuthState(),
  setAuth: (token, user, expiresAt = null) => {
    localStorage.setItem(AUTH_TOKEN_KEY, token)
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
    set({ token, user, expiresAt, isAuthenticated: true, hasHydrated: true })
  },
  setUser: (user) => {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
    set((state) => ({ ...state, user }))
  },
  logout: () => {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(AUTH_USER_KEY)
    set({ token: null, user: null, expiresAt: null, isAuthenticated: false, hasHydrated: true })
  },
  hydrate: () => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY)
    const user = readUserFromStorage()

    if (!token || !user) {
      set({ token: null, user: null, expiresAt: null, isAuthenticated: false, hasHydrated: true })
      return
    }

    set({ token, user, expiresAt: null, isAuthenticated: true, hasHydrated: true })
  },
}))
