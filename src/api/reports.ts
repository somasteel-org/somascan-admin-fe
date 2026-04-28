import { apiClient } from './client'
import { asArray, asRecord } from './http'
import { getTrips } from './trips'
import type {
  DailyTripEvolution,
  DelayItem,
  Trip,
  DurationDistribution,
  ReportSummary,
} from '../types'

export interface ExportReportPayload {
  generated_at?: string
  summary?: Record<string, unknown>
  durations?: unknown[]
  delays?: unknown[]
  [key: string]: unknown
}

function toNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function getDurationMinutes(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null

  const startDate = new Date(start)
  const endDate = new Date(end)

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null
  }

  return Math.max(0, (endDate.getTime() - startDate.getTime()) / 60000)
}

function average(values: Array<number | null>): number {
  const valid = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (!valid.length) return 0

  const total = valid.reduce((sum, value) => sum + value, 0)
  return total / valid.length
}

async function fetchAllHistoryTrips(limit = 100): Promise<Trip[]> {
  const first = await getTrips({ limit, page: 1, status: 'COMPLETED' })
  const pages = Math.max(1, first.lastPage)

  if (pages === 1) {
    return first.items
  }

  const requests: Array<ReturnType<typeof getTrips>> = []
  for (let page = 2; page <= pages; page += 1) {
    requests.push(getTrips({ limit, page, status: 'COMPLETED' }))
  }

  const rest = await Promise.all(requests)
  return [first, ...rest].flatMap((result) => result.items)
}

function buildDurationDistribution(trips: Trip[]): DurationDistribution[] {
  const ranges = [
    { label: '0-30 min', min: 0, max: 30 },
    { label: '30-60 min', min: 30, max: 60 },
    { label: '1-2 h', min: 60, max: 120 },
    { label: '2-4 h', min: 120, max: 240 },
    { label: '4h+', min: 240, max: Number.POSITIVE_INFINITY },
  ]

  const counts = new Map<string, number>()
  ranges.forEach((range) => counts.set(range.label, 0))

  trips.forEach((trip) => {
    const totalDuration = getDurationMinutes(trip.started_at, trip.completed_at)
    if (totalDuration == null) return

    const matchedRange = ranges.find((range) => totalDuration >= range.min && totalDuration < range.max)
    if (!matchedRange) return

    const current = counts.get(matchedRange.label) ?? 0
    counts.set(matchedRange.label, current + 1)
  })

  return ranges.map((range) => ({
    range: range.label,
    value: counts.get(range.label) ?? 0,
  }))
}

async function getActiveTripCount(): Promise<number> {
  const activeStatuses = ['STARTED', 'ARRIVED_PORT', 'LEFT_PORT']
  const responses = await Promise.all(
    activeStatuses.map((status) => getTrips({ limit: 1, page: 1, status })),
  )

  return responses.reduce((sum, result) => sum + result.total, 0)
}

async function computeSummaryFromTrips(): Promise<ReportSummary> {
  const [historyTrips, activeTripCount, allTrips] = await Promise.all([
    fetchAllHistoryTrips(),
    getActiveTripCount(),
    getTrips({ limit: 1, page: 1 }),
  ])

  const avgCompanyToPort = average(
    historyTrips.map((trip) => getDurationMinutes(trip.started_at, trip.arrived_port_at)),
  )
  const avgPortDuration = average(
    historyTrips.map((trip) => getDurationMinutes(trip.arrived_port_at, trip.left_port_at)),
  )
  const avgPortToCompany = average(
    historyTrips.map((trip) => getDurationMinutes(trip.left_port_at, trip.completed_at)),
  )

  return {
    totalTrips: allTrips.total,
    activeTrips: activeTripCount,
    avgCompanyToPort,
    avgPortDuration,
    avgPortToCompany,
  }
}

export async function getReportsSummary() {
  try {
    const { data } = await apiClient.get<unknown>('/reports/summary')
    const payload = asRecord(data)
    const nested = asRecord(payload.data)
    const source = Object.keys(nested).length ? nested : payload

    const summary: ReportSummary = {
      totalTrips: toNumber(source.totalTrips ?? source.total_trips),
      activeTrips: toNumber(source.activeTrips ?? source.active_trips),
      avgCompanyToPort: toNumber(
        source.avgCompanyToPort ?? source.avg_company_to_port ?? asRecord(source.average_durations).company_to_port,
      ),
      avgPortDuration: toNumber(
        source.avgPortDuration ?? source.avg_port_duration ?? asRecord(source.average_durations).port_duration,
      ),
      avgPortToCompany: toNumber(
        source.avgPortToCompany ?? source.avg_port_to_company ?? asRecord(source.average_durations).port_to_company,
      ),
    }

    if (summary.avgCompanyToPort > 0 || summary.avgPortDuration > 0 || summary.avgPortToCompany > 0) {
      return summary
    }

    const computed = await computeSummaryFromTrips()
    return {
      ...summary,
      avgCompanyToPort: computed.avgCompanyToPort,
      avgPortDuration: computed.avgPortDuration,
      avgPortToCompany: computed.avgPortToCompany,
      totalTrips: summary.totalTrips || computed.totalTrips,
      activeTrips: summary.activeTrips || computed.activeTrips,
    }
  } catch {
    return computeSummaryFromTrips()
  }
}

export async function getReportsDurations() {
  try {
    const { data } = await apiClient.get<unknown>('/reports/durations')
    const payload = asRecord(data)
    const source = asArray(payload.data ?? data)

    const endpointDurations = source.map((item) => {
      const row = asRecord(item)

      return {
        range: String(row.range ?? row.label ?? row.duration_range ?? 'N/A'),
        value: toNumber(row.value ?? row.count ?? row.total ?? row.minutes),
      } satisfies DurationDistribution
    })

    if (endpointDurations.some((item) => item.value > 0)) {
      return endpointDurations
    }

    const historyTrips = await fetchAllHistoryTrips()
    return buildDurationDistribution(historyTrips)
  } catch {
    const historyTrips = await fetchAllHistoryTrips()
    return buildDurationDistribution(historyTrips)
  }
}

export async function getReportsDelays() {
  const { data } = await apiClient.get<unknown>('/reports/delays')

  return asArray(asRecord(data).data ?? data).map((item) => {
    const row = asRecord(item)

    return {
      truck: String(
        row.truck ?? row.registration_number ?? row.truck_registration_number ?? '-',
      ),
      delayMinutes: toNumber(row.delayMinutes ?? row.delay_minutes ?? row.delay),
      date: String(row.date ?? row.trip_date ?? row.created_at ?? ''),
    } satisfies DelayItem
  })
}

export async function getReportsEvolution() {
  try {
    const history = await getTrips({ limit: 100, page: 1, status: 'COMPLETED' })
    const map = new Map<string, number>()

    history.items.forEach((trip) => {
      const startedAt = trip.started_at
      if (!startedAt) return

      const dateKey = new Date(startedAt).toISOString().slice(0, 10)
      const current = map.get(dateKey) ?? 0
      map.set(dateKey, current + 1)
    })

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count } satisfies DailyTripEvolution))
  } catch {
    return []
  }
}

export async function getTruckReport(truckId: number) {
  const { data } = await apiClient.get(`/reports/truck/${truckId}`)
  return data
}

export async function exportReports() {
  const { data } = await apiClient.get<ExportReportPayload>('/reports/export')
  const payload = asRecord(data)
  return payload
}
