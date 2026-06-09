import { apiClient } from './client'
import {
  asArray,
  asRecord,
  parsePaginated,
  type PaginationResult,
} from './http'
import type { Trip, TripCalendarDay, TripLog, TripsByDaySummary, TripStats, TripTimelineEvent } from '../types'

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
  all?: boolean
  page?: number
  limit?: number
  status?: string
  truck_id?: number
  registration_number?: string
  driver_name?: string
}

export interface TripsByDayResponse extends PaginationResult<Trip> {
  summary: TripsByDaySummary
  window?: {
    start_at: string
    end_at: string
  }
  total_items?: number
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
    next_expected_step: asNullableString(row.next_expected_step) ?? undefined,
    current_location: asNullableString(row.current_location) ?? undefined,
    last_scan_at: asNullableString(row.last_scan_at),
    is_active: typeof row.is_active === 'boolean' ? row.is_active : row.is_active == null ? null : undefined,
    durations: row.durations ? (row.durations as any) : undefined,
    created_at: asNullableString(row.created_at ?? row.createdAt) ?? undefined,
    started_at: String(row.started_at ?? row.created_at ?? ''),
    arrived_port_at: asNullableString(row.arrived_port_at),
    left_port_at: asNullableString(row.left_port_at),
    completed_at: asNullableString(row.completed_at),
    cancelled_at: asNullableString(row.cancelled_at),
    notes: asNullableString(row.notes),
    truck: row.truck ? (row.truck as any) : undefined,
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
  const rawDay = String(row.day ?? row.date ?? row.label ?? '')
  const match = rawDay.match(/\d{4}-\d{2}-\d{2}/)
  const day = match ? match[0] : rawDay
  const tripSource: unknown = row.trips ?? asRecord(row.data).trips ?? asRecord(row.items).trips
  const nestedTrips = asArray(tripSource)

  return {
    day,
    start_at: String(row.start_at ?? row.startAt ?? ''),
    end_at: String(row.end_at ?? row.endAt ?? ''),
    total: toNumber(row.total ?? row.count ?? row.trips),
    active: toNumber(row.active ?? row.active_trips),
    completed: toNumber(row.completed ?? row.completed_trips),
    by_status: normalizeStatusCounts(row.by_status ?? row.byStatus),
    trips: nestedTrips.map(normalizeTrip),
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
  const nested = asRecord(payload.data)
  const deepNested = asRecord(nested.data)
  const rows = Array.isArray(payload.data)
    ? payload.data
    : Array.isArray(nested.data)
      ? nested.data
      : Array.isArray(deepNested.data)
        ? deepNested.data
    : Array.isArray(payload.days)
      ? payload.days
      : Array.isArray(payload.items)
        ? payload.items
        : Array.isArray(payload.trips)
          ? payload.trips
          : Array.isArray(nested.days)
            ? nested.days
            : Array.isArray(nested.items)
              ? nested.items
              : Array.isArray(nested.trips)
                ? nested.trips
                : asArray(data)
  return rows.map(normalizeCalendarDay)
}

export async function getTripsByDay(params: TripsByDayParams): Promise<TripsByDayResponse> {
  const { data } = await apiClient.get<unknown>('/trips/by-day', { params })
  const parsed = parsePaginated(data, normalizeTrip)
  const payload = asRecord(data)
  const nested = asRecord(payload.data)
  const summarySource = payload.summary ?? nested.summary ?? asRecord(payload.meta).summary
  const windowSource = asRecord(payload.window ?? nested.window)
  const totalItems = toNumber(
    payload.total_items ?? payload.totalItems ?? nested.total_items ?? nested.totalItems,
    parsed.total,
  )

  return {
    ...parsed,
    summary: normalizeDaySummary(summarySource),
    window: windowSource.start_at && windowSource.end_at
      ? {
          start_at: String(windowSource.start_at),
          end_at: String(windowSource.end_at),
        }
      : undefined,
    total_items: totalItems,
  }
}

export async function searchTrips(params: ListTripsParams) {
  const { data } = await apiClient.get<unknown>('/trips/search', { params })
  return parsePaginated(data, normalizeTrip).items
}

export async function getTripStats(): Promise<TripStats> {
  const { data } = await apiClient.get<unknown>('/trips/stats')
  const payload = asRecord(data)
  const source = payload.data ? asRecord(payload.data) : payload
  return {
    total: Number(source.total ?? 0),
    active: Number(source.active ?? 0),
    completed: Number(source.completed ?? 0),
    cancelled: Number(source.cancelled ?? 0),
  }
}

export async function getTripTimeline(id: number): Promise<TripTimelineEvent[]> {
  const { data } = await apiClient.get<unknown>(`/trips/${id}/timeline`)
  const payload = asRecord(data)
  const source = Array.isArray(payload.data) ? payload.data : Array.isArray(data) ? data : []
  return source.map((item) => {
    const row = asRecord(item)
    return {
      action: String(row.action ?? ''),
      location: row.location ? String(row.location) : null,
      scanned_at: String(row.scanned_at ?? ''),
      user_name: row.user_name ? String(row.user_name) : null,
    }
  })
}

export async function cancelTrip(id: number, notes?: string) {
  await apiClient.patch(`/trips/${id}/cancel`, { notes })
}

export async function updateTripNotes(id: number, notes: string) {
  await apiClient.patch(`/trips/${id}/notes`, { notes })
}

export async function deleteTrip(id: number) {
  await apiClient.delete(`/trips/${id}`)
}
