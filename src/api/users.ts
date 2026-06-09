import { apiClient } from './client'
import {
  asRecord,
  getApiErrorMessage,
  parsePaginated,
  type PaginationResult,
} from './http'
import type { LocationType, Role, User, UserStats } from '../types'

export interface ListUsersParams {
  limit?: number
  page?: number
  role?: Role
  location?: LocationType
}

export interface CreateUserPayload {
  name: string
  email: string
  password: string
  role: Role
  location?: LocationType | null
}

export interface UpdateUserPayload {
  name?: string
  email?: string
  password?: string
  role?: Role
  location?: LocationType | null
}

function normalizeUser(raw: unknown): User {
  const row = asRecord(raw)
  const rawLocation = row.location
  const location = rawLocation === 'COMPANY' || rawLocation === 'PORT' ? rawLocation : null

  return {
    id: Number(row.id ?? 0),
    name: String(row.name ?? ''),
    email: String(row.email ?? ''),
    role: String(row.role ?? 'COMPANY_OPERATOR') as Role,
    location,
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  }
}

function extractUser(data: unknown): User {
  const payload = asRecord(data)
  const nested = payload.data ?? payload.user ?? data
  return normalizeUser(nested)
}

export { getApiErrorMessage }

export async function getUsers(params: ListUsersParams = {}): Promise<PaginationResult<User>> {
  const { data } = await apiClient.get<unknown>('/users', { params })
  return parsePaginated(data, normalizeUser)
}

export async function createUser(payload: CreateUserPayload) {
  const requestBody = {
    name: payload.name.trim(),
    email: payload.email.trim(),
    password: payload.password,
    role: payload.role,
    location: payload.location ?? null,
  }

  const { data } = await apiClient.post<unknown>('/users', requestBody)
  return extractUser(data)
}

export async function getUserById(id: number) {
  const { data } = await apiClient.get<unknown>(`/users/${id}`)
  return extractUser(data)
}

export async function updateUser(id: number, payload: UpdateUserPayload) {
  const requestBody = {
    ...payload,
    name: payload.name?.trim(),
    email: payload.email?.trim(),
    location: payload.location ?? null,
  }

  const { data } = await apiClient.put<unknown>(`/users/${id}`, requestBody)
  return extractUser(data)
}

export async function deleteUser(id: number) {
  await apiClient.delete(`/users/${id}`)
}

export async function searchUsers(query: string, role?: Role) {
  const params: Record<string, unknown> = { search: query }
  if (role && role !== 'ALL' as any) {
    params.role = role
  }
  const { data } = await apiClient.get<unknown>('/users/search', { params })
  return parsePaginated(data, normalizeUser).items
}

export async function getUserStats(): Promise<UserStats> {
  const { data } = await apiClient.get<unknown>('/users/stats')
  const payload = asRecord(data)
  const source = payload.data ? asRecord(payload.data) : payload
  return {
    total: Number(source.total ?? 0),
    by_role: asRecord(source.by_role) as Record<string, number>,
    by_location: asRecord(source.by_location) as Record<string, number>,
  }
}

export async function getUserActivity(id: number) {
  const { data } = await apiClient.get<unknown>(`/users/${id}/activity`)
  const payload = asRecord(data)
  const source = payload.data ? asRecord(payload.data) : payload
  return {
    scans: Number(source.scans ?? 0),
    latest_scan: source.latest_scan ? String(source.latest_scan) : null,
  }
}

export async function resetUserPassword(id: number, password: string) {
  await apiClient.patch(`/users/${id}/reset-password`, { password })
}
