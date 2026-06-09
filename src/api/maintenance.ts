import { apiClient } from './client'
import { asRecord, getApiErrorMessage, parsePaginated, type PaginationResult } from './http'
import type { MaintenanceRecord, Truck } from '../types'

export interface ListMaintenanceParams {
  limit?: number
  page?: number
  truck_id?: number
}

export interface MaintenancePayload {
  truck_id: number
  trip_id?: number | null
  type: string
  description: string
  cost: string | number
  date: string
}

function normalizeMaintenanceRecord(raw: unknown): MaintenanceRecord {
  const row = asRecord(raw)
  return {
    id: Number(row.id ?? 0),
    truck_id: Number(row.truck_id ?? 0),
    trip_id: row.trip_id ? Number(row.trip_id) : null,
    type: String(row.type ?? ''),
    description: String(row.description ?? ''),
    cost: row.cost ? String(row.cost) : '0',
    date: String(row.date ?? ''),
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
    truck: row.truck ? (row.truck as Truck) : undefined,
  }
}

export { getApiErrorMessage }

export async function getMaintenanceRecords(params: ListMaintenanceParams = {}): Promise<PaginationResult<MaintenanceRecord>> {
  const { data } = await apiClient.get<unknown>('/maintenance', { params })
  return parsePaginated(data, normalizeMaintenanceRecord)
}

export async function getMaintenanceById(id: number): Promise<MaintenanceRecord> {
  const { data } = await apiClient.get<unknown>(`/maintenance/${id}`)
  const payload = asRecord(data)
  const nested = payload.data ?? payload.maintenance ?? data
  return normalizeMaintenanceRecord(nested)
}

export async function createMaintenanceRecord(payload: MaintenancePayload): Promise<MaintenanceRecord> {
  const { data } = await apiClient.post<unknown>('/maintenance', payload)
  const source = asRecord(data)
  const nested = source.data ?? source.maintenance ?? data
  return normalizeMaintenanceRecord(nested)
}

export async function updateMaintenanceRecord(id: number, payload: MaintenancePayload): Promise<MaintenanceRecord> {
  const { data } = await apiClient.put<unknown>(`/maintenance/${id}`, payload)
  const source = asRecord(data)
  const nested = source.data ?? source.maintenance ?? data
  return normalizeMaintenanceRecord(nested)
}

export async function deleteMaintenanceRecord(id: number): Promise<void> {
  await apiClient.delete(`/maintenance/${id}`)
}
