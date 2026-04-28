import { apiClient } from './client'
import type { AuthResponse } from '../types'

interface LoginPayload {
  email: string
  password: string
  device_name?: string
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object') return value as Record<string, unknown>
  return {}
}

function extractToken(data: Record<string, unknown>): string | null {
  const candidates = [
    data.token,
    data.access_token,
    data.accessToken,
    (data.data as Record<string, unknown> | undefined)?.token,
    (data.data as Record<string, unknown> | undefined)?.access_token,
    (data.data as Record<string, unknown> | undefined)?.accessToken,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }

  return null
}

function extractUser(data: Record<string, unknown>): AuthResponse['user'] | null {
  const directUser = data.user
  const adminUser = data.admin
  const meUser = data.me
  const nestedData = data.data as Record<string, unknown> | undefined
  const nestedUser = nestedData?.user
  const candidate = directUser ?? adminUser ?? meUser ?? nestedUser ?? nestedData ?? data

  if (!candidate || typeof candidate !== 'object') return null

  const user = candidate as Record<string, unknown>
  const id = Number(user.id)
  const name = user.name
  const email = user.email
  const role = typeof user.role === 'string' ? user.role.toUpperCase() : null
  const location = user.location

  if (
    Number.isFinite(id) &&
    typeof name === 'string' &&
    typeof email === 'string' &&
    typeof role === 'string'
  ) {
    return {
      id,
      name,
      email,
      role: role as AuthResponse['user']['role'],
      location:
        location === 'COMPANY' || location === 'PORT' ? location : null,
    }
  }

  return null
}

export async function login(payload: LoginPayload) {
  const requestBody = {
    email: payload.email,
    password: payload.password,
    device_name: payload.device_name ?? 'admin-web',
  }

  const { data } = await apiClient.post<Record<string, unknown>>('/login', requestBody)

  const token = extractToken(data)
  const user = extractUser(data)
  const payloadRecord = asRecord(data)
  const nested = asRecord(payloadRecord.data)
  const expiresAt =
    (typeof payloadRecord.expires_at === 'string' && payloadRecord.expires_at) ||
    (typeof nested.expires_at === 'string' && nested.expires_at) ||
    null

  if (!token || !user) {
    throw new Error('Réponse d’authentification invalide')
  }

  return { token, user, expires_at: expiresAt } satisfies AuthResponse
}

export async function logout() {
  await apiClient.post('/logout')
}

export async function getMe() {
  const { data } = await apiClient.get<Record<string, unknown>>('/me')
  const payload = asRecord(data)
  const user = extractUser(payload)

  if (!user) {
    throw new Error('Réponse utilisateur invalide')
  }

  return user
}
