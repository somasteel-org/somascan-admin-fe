import { apiClient } from './client'
import {
  asRecord,
  getApiErrorMessage,
  parsePaginated,
  type PaginationResult,
} from './http'
import type { Truck, TruckStats, Trip } from '../types'

export interface ListTrucksParams {
  limit?: number
  page?: number
  is_active?: boolean
}

export interface TruckPayload {
  registration_number: string
  driver_name?: string
  qr_code?: string | null
  is_active?: boolean
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true'
  return false
}

function normalizeTruck(raw: unknown): Truck {
  const row = asRecord(raw)

  return {
    id: Number(row.id ?? 0),
    registration_number: String(row.registration_number ?? ''),
    driver_name: row.driver_name == null ? null : String(row.driver_name),
    qr_code: row.qr_code ? String(row.qr_code) : null,
    is_active: toBoolean(row.is_active),
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
    active_trip: row.active_trip ? (row.active_trip as Trip) : null,
  }
}

function extractTruck(data: unknown): Truck {
  const payload = asRecord(data)
  const nested = payload.data ?? payload.truck ?? data
  return normalizeTruck(nested)
}

export { getApiErrorMessage }

export async function getTrucks(params: ListTrucksParams = {}): Promise<PaginationResult<Truck>> {
  const { data } = await apiClient.get<unknown>('/trucks', { params })
  return parsePaginated(data, normalizeTruck)
}

export async function createTruck(payload: TruckPayload) {
  const requestBody = {
    registration_number: payload.registration_number.trim(),
    driver_name: payload.driver_name?.trim(),
    qr_code: payload.qr_code?.trim() || undefined,
    is_active: payload.is_active,
  }

  const { data } = await apiClient.post<unknown>('/trucks', requestBody)
  return extractTruck(data)
}

export async function getTruckById(id: number) {
  const { data } = await apiClient.get<unknown>(`/trucks/${id}`)
  return extractTruck(data)
}

export async function updateTruck(id: number, payload: TruckPayload) {
  const requestBody = {
    registration_number: payload.registration_number.trim(),
    driver_name: payload.driver_name?.trim(),
    qr_code: payload.qr_code?.trim() || undefined,
    is_active: payload.is_active,
  }

  const { data } = await apiClient.put<unknown>(`/trucks/${id}`, requestBody)
  return extractTruck(data)
}

export async function deleteTruck(id: number) {
  await apiClient.delete(`/trucks/${id}`)
}

export async function activateTruck(id: number) {
  await apiClient.patch(`/trucks/${id}/activate`)
}

export async function deactivateTruck(id: number) {
  await apiClient.patch(`/trucks/${id}/deactivate`)
}

export async function generateTruckQr(id: number) {
  const { data } = await apiClient.post<unknown>(`/trucks/${id}/generate-qr`)
  const payload = asRecord(data)
  const nested = asRecord(payload.data)

  return {
    id: Number(payload.id ?? nested.id ?? id),
    qr_code: String(payload.qr_code ?? nested.qr_code ?? ''),
  }
}

export async function getTruckBasic(id: number) {
  const { data } = await apiClient.get<unknown>(`/trucks/${id}/basic`)
  const payload = asRecord(data)
  const nested = asRecord(payload.data)
  const source = Object.keys(nested).length ? nested : payload

  return {
    id: Number(source.id ?? id),
    registration_number: String(source.registration_number ?? ''),
    driver_name: source.driver_name == null ? null : String(source.driver_name),
    qr_code: source.qr_code ? String(source.qr_code) : null,
    is_active: toBoolean(source.is_active),
    active_trip_status: source.active_trip_status ? String(source.active_trip_status) : null,
  }
}

export async function searchTrucks(query: string, is_active?: boolean) {
  const params: Record<string, unknown> = { search: query }
  if (typeof is_active === 'boolean') {
    params.is_active = is_active
  }
  const { data } = await apiClient.get<unknown>('/trucks/search', { params })
  return parsePaginated(data, normalizeTruck).items
}

export async function getTruckStats(): Promise<TruckStats> {
  const { data } = await apiClient.get<unknown>('/trucks/stats')
  const payload = asRecord(data)
  const source = payload.data ? asRecord(payload.data) : payload
  return {
    total: Number(source.total ?? 0),
    active: Number(source.active ?? 0),
    inactive: Number(source.inactive ?? 0),
  }
}

export async function bulkActivateTrucks(truck_ids: number[]) {
  await apiClient.post('/trucks/bulk-activate', { truck_ids })
}

export async function bulkDeactivateTrucks(truck_ids: number[]) {
  await apiClient.post('/trucks/bulk-deactivate', { truck_ids })
}

export async function getTruckTrips(id: number) {
  const { data } = await apiClient.get<unknown>(`/trucks/${id}/trips`)
  return parsePaginated(data, (raw) => asRecord(raw) as unknown as Trip).items
}
