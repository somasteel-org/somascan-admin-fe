import { apiClient } from './client'
import {
  asArray,
  asRecord,
  parsePaginated,
  type PaginationResult,
} from './http'
import type { Trip, TripCalendarDay, TripLog, TripsByDaySummary } from '../types'

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

export interface TripCalendarParams {
  from: string
  to: string
  day_start?: string
  timezone?: string
  status?: string
  truck_id?: number
  registration_number?: string
  driver_name?: string
}

export interface TripsByDayParams {
  day: string
  day_start?: string
  timezone?: string
  page?: number
  limit?: number
  status?: string
  truck_id?: number
  registration_number?: string
  driver_name?: string
}

export interface TripsByDayResponse extends PaginationResult<Trip> {
  summary: TripsByDaySummary
}

function asNullableString(value: unknown): string | null {
  if (value == null) return null
  const stringValue = String(value)
  return stringValue.trim() ? stringValue : null
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeStatusCounts(raw: unknown): Record<string, number> {
  const record = asRecord(raw)
  return Object.entries(record).reduce<Record<string, number>>((acc, [key, value]) => {
    acc[key] = toNumber(value)
    return acc
  }, {})
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

function normalizeCalendarDay(raw: unknown): TripCalendarDay {
  const row = asRecord(raw)

  return {
    day: String(row.day ?? row.date ?? row.label ?? ''),
    start_at: String(row.start_at ?? row.startAt ?? ''),
    end_at: String(row.end_at ?? row.endAt ?? ''),
    total: toNumber(row.total ?? row.count ?? row.trips),
    active: toNumber(row.active ?? row.active_trips),
    completed: toNumber(row.completed ?? row.completed_trips),
    by_status: normalizeStatusCounts(row.by_status ?? row.byStatus),
  }
}

function normalizeDaySummary(raw: unknown): TripsByDaySummary {
  const row = asRecord(raw)

  return {
    total: toNumber(row.total ?? row.count ?? row.trips),
    active: toNumber(row.active ?? row.active_trips),
    completed: toNumber(row.completed ?? row.completed_trips),
    by_status: normalizeStatusCounts(row.by_status ?? row.byStatus ?? row.status_counts),
  }
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

export async function getTripsCalendar(params: TripCalendarParams): Promise<TripCalendarDay[]> {
  const { data } = await apiClient.get<unknown>('/trips/calendar', { params })
  const payload = asRecord(data)
  const rows = asArray(payload.data ?? payload.days ?? payload.items ?? data)
  return rows.map(normalizeCalendarDay)
}

export async function getTripsByDay(params: TripsByDayParams): Promise<TripsByDayResponse> {
  const { data } = await apiClient.get<unknown>('/trips/by-day', { params })
  const parsed = parsePaginated(data, normalizeTrip)
  const payload = asRecord(data)
  const nested = asRecord(payload.data)
  const summarySource = payload.summary ?? nested.summary ?? asRecord(payload.meta).summary

  return {
    ...parsed,
    summary: normalizeDaySummary(summarySource),
  }
}
