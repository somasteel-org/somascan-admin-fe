import { apiClient } from './client'
import {
  asRecord,
  getApiErrorMessage,
  parsePaginated,
  type PaginationResult,
} from './http'
import type { LocationType, Role, User } from '../types'

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

  const { data } = await apiClient.patch<unknown>(`/users/${id}`, requestBody)
  return extractUser(data)
}

export async function deleteUser(id: number) {
  await apiClient.delete(`/users/${id}`)
}
