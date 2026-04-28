import { apiClient } from './client'
import {
  asRecord,
  parsePaginated,
  type PaginationResult,
} from './http'
import type { Trip, TripLog } from '../types'

export interface ListTripsParams {
  limit?: number
  page?: number
  status?: string
  truck_id?: number
  registration_number?: string
  driver_name?: string
  from?: string
  to?: string
}

export interface ListSimpleTripsParams {
  limit?: number
  page?: number
}

function asNullableString(value: unknown): string | null {
  if (value == null) return null
  const stringValue = String(value)
  return stringValue.trim() ? stringValue : null
}

function normalizeTrip(raw: unknown): Trip {
  const row = asRecord(raw)
  const truck = asRecord(row.truck)

  return {
    id: Number(row.id ?? 0),
    truck_id: row.truck_id ? Number(row.truck_id) : undefined,
    truck_registration_number: asNullableString(
      row.truck_registration_number ?? row.registration_number ?? truck.registration_number,
    ) ?? undefined,
    truck_driver_name: asNullableString(
      row.truck_driver_name ?? row.driver_name ?? truck.driver_name,
    ) ?? undefined,
    status: String(row.status ?? 'UNKNOWN'),
    started_at: String(row.started_at ?? row.created_at ?? ''),
    arrived_port_at: asNullableString(row.arrived_port_at),
    left_port_at: asNullableString(row.left_port_at),
    completed_at: asNullableString(row.completed_at),
  }
}

function normalizeTripLog(raw: unknown): TripLog {
  const row = asRecord(raw)
  const rawLocation = row.location
  const location = rawLocation === 'COMPANY' || rawLocation === 'PORT' ? rawLocation : null
  const action = row.action ?? row.status ?? row.step

  return {
    id: Number(row.id ?? 0),
    timestamp: String(row.timestamp ?? row.scanned_at ?? row.created_at ?? ''),
    action: String(action ?? 'UNKNOWN'),
    operator: String(row.operator ?? row.operator_name ?? '-'),
    location,
  }
}

function extractSingle(data: unknown): unknown {
  const payload = asRecord(data)
  return payload.data ?? payload.trip ?? data
}

export async function getTrips(params: ListTripsParams = {}): Promise<PaginationResult<Trip>> {
  const { data } = await apiClient.get<unknown>('/trips', { params })
  return parsePaginated(data, normalizeTrip)
}

export async function getActiveTrips(params: ListSimpleTripsParams = {}): Promise<PaginationResult<Trip>> {
  const { data } = await apiClient.get<unknown>('/trips/active', { params })
  return parsePaginated(data, normalizeTrip)
}

export async function getTripHistory(params: ListSimpleTripsParams = {}): Promise<PaginationResult<Trip>> {
  try {
    const { data } = await apiClient.get<unknown>('/trips/history', { params })
    return parsePaginated(data, normalizeTrip)
  } catch {
    return getTrips({
      limit: params.limit,
      page: params.page,
      status: 'COMPLETED',
    })
  }
}

export async function getTripById(id: number) {
  const { data } = await apiClient.get<unknown>(`/trips/${id}`)
  return normalizeTrip(extractSingle(data))
}

export async function getTripLogs(id: number) {
  const { data } = await apiClient.get<unknown>(`/trips/${id}/logs`)
  const payload = asRecord(data)
  const nested = asRecord(payload.data)
  const rows = Array.isArray(payload.data)
    ? payload.data
    : Array.isArray(nested.logs)
      ? nested.logs
      : Array.isArray(payload.logs)
        ? payload.logs
        : Array.isArray(data)
          ? data
          : []
  return rows.map(normalizeTripLog)
}
