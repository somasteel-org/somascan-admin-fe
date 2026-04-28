import { apiClient } from './client'
import { asArray, asRecord } from './http'
import type { LocationType, Role, ScanAction, ScanLogEntry, ScanLogsSummary } from '../types'

export interface ScanLogsFilters {
  limit?: number
  page?: number
  user_id?: number
  truck_id?: number
  trip_id?: number
  role?: Role
  location?: LocationType
  action?: ScanAction
  registration_number?: string
  from?: string
  to?: string
  search?: string
}

export interface ScanLogsResult {
  items: ScanLogEntry[]
  page: number
  perPage: number
  total: number
  lastPage: number
  summary: ScanLogsSummary
  appliedFilters: Record<string, unknown>
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toBoolean(value: unknown) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true'
  return false
}

function toNullableString(value: unknown): string | null {
  if (value == null) return null
  const normalized = String(value).trim()
  return normalized ? normalized : null
}

function normalizeLocation(value: unknown): LocationType | null {
  if (value === 'COMPANY' || value === 'PORT') return value
  return null
}

function normalizeOperator(raw: unknown): ScanLogEntry['operator'] {
  const row = asRecord(raw)
  if (!Object.keys(row).length) return null

  return {
    id: toNumber(row.id),
    name: String(row.name ?? '-'),
    email: String(row.email ?? '-'),
    role: String(row.role ?? 'PORT_OPERATOR') as Role,
    location: normalizeLocation(row.location),
  }
}

function normalizeTruck(raw: unknown): ScanLogEntry['truck'] {
  const row = asRecord(raw)
  if (!Object.keys(row).length) return null

  return {
    id: toNumber(row.id),
    registration_number: String(row.registration_number ?? '-'),
    driver_name: toNullableString(row.driver_name),
    qr_code: toNullableString(row.qr_code),
  }
}

function normalizeTrip(raw: unknown): ScanLogEntry['trip'] {
  const row = asRecord(raw)
  if (!Object.keys(row).length) return null

  return {
    id: toNumber(row.id),
    status: String(row.status ?? 'UNKNOWN'),
    is_active: toBoolean(row.is_active),
  }
}

function normalizeItem(raw: unknown): ScanLogEntry {
  const row = asRecord(raw)

  return {
    id: toNumber(row.id),
    action: String(row.action ?? 'START') as ScanAction,
    action_label: String(row.action_label ?? ''),
    location: normalizeLocation(row.location),
    device_id: toNullableString(row.device_id),
    scanned_at: String(row.scanned_at ?? row.created_at ?? ''),
    created_at: String(row.created_at ?? row.scanned_at ?? ''),
    operator: normalizeOperator(row.operator),
    truck: normalizeTruck(row.truck),
    trip: normalizeTrip(row.trip),
  }
}

function normalizeSummary(raw: unknown): ScanLogsSummary {
  const row = asRecord(raw)
  const byActionRaw = asRecord(row.by_action)
  const byLocationRaw = asRecord(row.by_location)

  const byAction = Object.fromEntries(
    Object.entries(byActionRaw).map(([key, value]) => [key, toNumber(value)]),
  )

  const byLocation = Object.fromEntries(
    Object.entries(byLocationRaw).map(([key, value]) => [key, toNumber(value)]),
  )

  return {
    total_logs: toNumber(row.total_logs),
    unique_operators: toNumber(row.unique_operators),
    by_action: byAction,
    by_location: byLocation,
  }
}

export async function getScanLogs(params: ScanLogsFilters = {}): Promise<ScanLogsResult> {
  const { data } = await apiClient.get<unknown>('/scan-logs', { params })
  const payload = asRecord(data)
  const nested = asRecord(payload.data)
  const items = asArray(nested.items)
  const pagination = asRecord(nested.pagination)
  const summary = normalizeSummary(nested.summary)

  return {
    items: items.map(normalizeItem),
    page: toNumber(pagination.current_page, 1),
    perPage: toNumber(pagination.per_page, params.limit ?? 20),
    total: toNumber(pagination.total),
    lastPage: toNumber(pagination.last_page, 1),
    summary,
    appliedFilters: asRecord(nested.applied_filters),
  }
}
