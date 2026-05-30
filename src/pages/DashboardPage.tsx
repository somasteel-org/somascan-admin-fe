import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getReportsDurations, getReportsEvolution, getReportsSummary } from '../api/reports'
import { getScanLogs } from '../api/scanLogs'
import { getTrucks } from '../api/trucks'
import { getTrips, getTripsCalendar } from '../api/trips'
import { DataTable } from '../components/common/DataTable'
import { KpiCard } from '../components/common/KpiCard'
import { Modal } from '../components/common/Modal'
import { PageHeader } from '../components/common/PageHeader'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import type {
  DailyTripEvolution,
  DurationDistribution,
  ReportSummary,
  ScanLogsSummary,
  Trip,
  TripCalendarDay,
  Truck,
} from '../types'
import { formatDate, formatDuration, getDurationMinutes } from '../utils/format'
import { toFriendlyLocation, toFriendlyTripAction, toFriendlyTripStatus } from '../utils/labels'

const PIE_COLORS = ['#F2B841', '#0EA5E9', '#22C55E', '#F97316', '#EF4444', '#64748B', '#14B8A6']
const CALENDAR_DAY_START = '07:00'
const DEFAULT_TIMEZONE = 'UTC'
const DASHBOARD_CALENDAR_DAYS = 30
const DASHBOARD_CALENDAR_PREVIEW = 7

type DashboardModalKey =
  | 'kpis'
  | 'evolution'
  | 'durations'
  | 'status'
  | 'topTrucks'
  | 'highlights'
  | 'recentTrips'
  | 'longestTrips'
  | 'calendar'
  | 'scanActivity'
  | 'scanActions'
  | 'scanLocations'

function useChartReady<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect?.width ?? 0
      setReady(width > 0)
    })

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return { ref, ready }
}

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function formatCalendarLabel(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(parseDateKey(value))
}

function getRecentRange(days: number) {
  const today = new Date()
  const from = addDays(today, -(days - 1))
  return {
    from: toDateKey(from),
    to: toDateKey(today),
  }
}

function toTimestamp(value?: string | null): number | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.getTime()
}

function pickLatestDate(current: string | null, candidate?: string | null): string | null {
  const normalizedCandidate = candidate ?? null
  const currentTime = toTimestamp(current)
  const candidateTime = toTimestamp(normalizedCandidate)

  if (candidateTime == null) return current
  if (currentTime == null || candidateTime > currentTime) return normalizedCandidate
  return current
}

async function fetchAllTrucks(limit = 100): Promise<Truck[]> {
  const first = await getTrucks({ limit, page: 1 })
  const pages = Math.max(1, first.lastPage)

  if (pages === 1) return first.items

  const requests: Array<ReturnType<typeof getTrucks>> = []
  for (let page = 2; page <= pages; page += 1) {
    requests.push(getTrucks({ limit, page }))
  }

  const rest = await Promise.all(requests)
  return [first, ...rest].flatMap((result) => result.items)
}

async function fetchAllTrips(limit = 100): Promise<Trip[]> {
  const first = await getTrips({ limit, page: 1 })
  const pages = Math.max(1, first.lastPage)

  if (pages === 1) return first.items

  const requests: Array<ReturnType<typeof getTrips>> = []
  for (let page = 2; page <= pages; page += 1) {
    requests.push(getTrips({ limit, page }))
  }

  const rest = await Promise.all(requests)
  return [first, ...rest].flatMap((result) => result.items)
}

const defaultSummary: ReportSummary = {
  totalTrips: 0,
  activeTrips: 0,
  avgCompanyToPort: 0,
  avgPortDuration: 0,
  avgPortToCompany: 0,
}

export function DashboardPage() {
  const [summary, setSummary] = useState<ReportSummary>(defaultSummary)
  const [evolution, setEvolution] = useState<DailyTripEvolution[]>([])
  const [durations, setDurations] = useState<DurationDistribution[]>([])
  const [trips, setTrips] = useState<Trip[]>([])
  const [trucks, setTrucks] = useState<Truck[]>([])
  const [scanSummary, setScanSummary] = useState<ScanLogsSummary | null>(null)
  const [calendarDays, setCalendarDays] = useState<TripCalendarDay[]>([])
  const [calendarError, setCalendarError] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [activeModal, setActiveModal] = useState<DashboardModalKey | null>(null)
  const evolutionChart = useChartReady<HTMLDivElement>()
  const durationsChart = useChartReady<HTMLDivElement>()
  const statusChart = useChartReady<HTMLDivElement>()
  const scanActionChart = useChartReady<HTMLDivElement>()
  const scanLocationChart = useChartReady<HTMLDivElement>()

  useEffect(() => {
    let active = true

    async function loadData() {
      setError('')
      setCalendarError('')
      setIsLoading(true)

      const calendarRange = getRecentRange(DASHBOARD_CALENDAR_DAYS)

      const results = await Promise.allSettled([
        getReportsSummary(),
        getReportsEvolution(),
        getReportsDurations(),
        fetchAllTrips(),
        fetchAllTrucks(),
        getScanLogs({ limit: 1, page: 1 }),
        getTripsCalendar({
          from: calendarRange.from,
          to: calendarRange.to,
          day_start: CALENDAR_DAY_START,
          timezone: DEFAULT_TIMEZONE,
        }),
      ])

      if (!active) return

      const [
        summaryResult,
        evolutionResult,
        durationsResult,
        tripsResult,
        trucksResult,
        scanResult,
        calendarResult,
      ] = results

      if (summaryResult.status === 'fulfilled') {
        setSummary(summaryResult.value)
      }
      if (evolutionResult.status === 'fulfilled') {
        setEvolution(evolutionResult.value)
      }
      if (durationsResult.status === 'fulfilled') {
        setDurations(durationsResult.value)
      }
      if (tripsResult.status === 'fulfilled') {
        setTrips(tripsResult.value)
      }
      if (trucksResult.status === 'fulfilled') {
        setTrucks(trucksResult.value)
      }
      if (scanResult.status === 'fulfilled') {
        setScanSummary(scanResult.value.summary)
      }
      if (calendarResult.status === 'fulfilled') {
        setCalendarDays(calendarResult.value)
      } else {
        setCalendarError('Calendrier indisponible')
      }

      if (results.some((result) => result.status === 'rejected')) {
        setError('Certaines données n’ont pas pu être chargées')
      }

      setIsLoading(false)
    }

    void loadData()

    return () => {
      active = false
    }
  }, [])

  const truckTotals = useMemo(() => {
    const total = trucks.length
    const active = trucks.filter((truck) => truck.is_active).length
    return {
      total,
      active,
      inactive: Math.max(0, total - active),
    }
  }, [trucks])

  const tripStatusData = useMemo(() => {
    const counts = new Map<string, number>()
    trips.forEach((trip) => {
      const status = trip.status || 'UNKNOWN'
      counts.set(status, (counts.get(status) ?? 0) + 1)
    })

    return Array.from(counts.entries())
      .map(([status, value]) => ({
        name: toFriendlyTripStatus(status),
        rawStatus: status,
        value,
      }))
      .sort((a, b) => b.value - a.value)
  }, [trips])

  const tripDurationStats = useMemo(() => {
    const completedTrips = trips.filter((trip) => trip.completed_at || trip.status === 'COMPLETED')
    const durationsList = completedTrips
      .map((trip) => getDurationMinutes(trip.started_at, trip.completed_at))
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

    const totalMinutes = durationsList.reduce((sum, value) => sum + value, 0)
    const averageMinutes = durationsList.length ? totalMinutes / durationsList.length : 0

    const lastTripAt = trips.reduce<string | null>((latest, trip) => {
      const candidate = trip.completed_at ?? trip.started_at
      return pickLatestDate(latest, candidate)
    }, null)

    return {
      completedCount: completedTrips.length,
      totalMinutes,
      averageMinutes,
      lastTripAt,
    }
  }, [trips])

  const kpiDetails = useMemo(
    () => [
      { label: 'Nombre total de trajets', value: summary.totalTrips },
      { label: 'Nombre de trajets actifs', value: summary.activeTrips },
      { label: 'Camions enregistrés', value: truckTotals.total },
      { label: 'Camions actifs / inactifs', value: `${truckTotals.active} / ${truckTotals.inactive}` },
      { label: 'Durée moyenne d’un trajet', value: formatDuration(tripDurationStats.averageMinutes) },
      { label: 'Temps moyen (Entreprise → Port)', value: formatDuration(summary.avgCompanyToPort) },
      { label: 'Temps moyen au port', value: formatDuration(summary.avgPortDuration) },
      { label: 'Temps moyen (Port → Entreprise)', value: formatDuration(summary.avgPortToCompany) },
    ],
    [summary, truckTotals, tripDurationStats],
  )

  const truckInsights = useMemo(() => {
    const map = new Map<string, {
      key: string
      truckId: number | null
      registration: string
      driverName: string | null
      totalTrips: number
      completedTrips: number
      activeTrips: number
      totalMinutes: number
      lastTripAt: string | null
    }>()

    const truckIndex = new Map<number, Truck>()
    trucks.forEach((truck) => {
      truckIndex.set(truck.id, truck)
      const key = `id:${truck.id}`
      map.set(key, {
        key,
        truckId: truck.id,
        registration: truck.registration_number || 'Inconnu',
        driverName: truck.driver_name ?? null,
        totalTrips: 0,
        completedTrips: 0,
        activeTrips: 0,
        totalMinutes: 0,
        lastTripAt: null,
      })
    })

    trips.forEach((trip) => {
      const truckId = trip.truck_id ?? null
      const linkedTruck = truckId != null ? truckIndex.get(truckId) : undefined
      const registration = trip.truck_registration_number?.trim()
        || linkedTruck?.registration_number
        || 'Inconnu'
      const driverName = trip.truck_driver_name ?? linkedTruck?.driver_name ?? null
      const key = truckId != null ? `id:${truckId}` : `reg:${registration}`

      if (!map.has(key)) {
        map.set(key, {
          key,
          truckId,
          registration,
          driverName,
          totalTrips: 0,
          completedTrips: 0,
          activeTrips: 0,
          totalMinutes: 0,
          lastTripAt: null,
        })
      }

      const entry = map.get(key)
      if (!entry) return

      entry.totalTrips += 1

      const isCompleted = Boolean(trip.completed_at) || trip.status === 'COMPLETED'
      if (isCompleted) {
        entry.completedTrips += 1
      } else {
        entry.activeTrips += 1
      }

      const duration = getDurationMinutes(trip.started_at, trip.completed_at)
      if (duration != null) {
        entry.totalMinutes += duration
      }

      entry.lastTripAt = pickLatestDate(entry.lastTripAt, trip.completed_at ?? trip.started_at)
    })

    return Array.from(map.values())
      .map((entry) => ({
        ...entry,
        averageMinutes: entry.completedTrips ? entry.totalMinutes / entry.completedTrips : 0,
      }))
      .sort((a, b) => {
        if (b.totalTrips !== a.totalTrips) return b.totalTrips - a.totalTrips
        return b.totalMinutes - a.totalMinutes
      })
  }, [trips, trucks])

  const topTrucks = useMemo(() => truckInsights.slice(0, 5), [truckInsights])
  const mostActiveTruck = topTrucks[0]

  const highlightDetails = useMemo(
    () => [
      {
        label: 'Camion le plus actif',
        value: mostActiveTruck ? `${mostActiveTruck.registration} (${mostActiveTruck.totalTrips} trajets)` : '—',
      },
      { label: 'Trajets terminés', value: tripDurationStats.completedCount },
      { label: 'Temps cumulé (trajets terminés)', value: formatDuration(tripDurationStats.totalMinutes) },
      { label: 'Durée moyenne d’un trajet', value: formatDuration(tripDurationStats.averageMinutes) },
      {
        label: 'Dernier trajet enregistré',
        value: tripDurationStats.lastTripAt ? formatDate(tripDurationStats.lastTripAt) : '-',
      },
    ],
    [mostActiveTruck, tripDurationStats],
  )

  const sortedTrips = useMemo(() => {
    return [...trips].sort((a, b) => {
      const aTime = Math.max(toTimestamp(a.started_at) ?? 0, toTimestamp(a.completed_at) ?? 0)
      const bTime = Math.max(toTimestamp(b.started_at) ?? 0, toTimestamp(b.completed_at) ?? 0)
      return bTime - aTime
    })
  }, [trips])

  const recentTrips = useMemo(() => sortedTrips.slice(0, 6), [sortedTrips])

  const tripsByDuration = useMemo(() => {
    const withDuration = trips
      .map((trip) => ({
        trip,
        duration: getDurationMinutes(trip.started_at, trip.completed_at),
      }))
      .filter((item): item is { trip: Trip; duration: number } => typeof item.duration === 'number')

    return withDuration.sort((a, b) => b.duration - a.duration)
  }, [trips])

  const longestTrips = useMemo(() => tripsByDuration.slice(0, 6), [tripsByDuration])

  const recentCalendarPreview = useMemo(() => {
    const map = new Map(calendarDays.map((d) => [d.day, d]))
    const today = new Date()
    const days: TripCalendarDay[] = []

    for (let i = DASHBOARD_CALENDAR_PREVIEW - 1; i >= 0; i -= 1) {
      const d = addDays(today, -i)
      const key = toDateKey(d)
      const entry = map.get(key) ?? {
        day: key,
        start_at: '',
        end_at: '',
        total: 0,
        active: 0,
        completed: 0,
        by_status: {},
      }
      days.push(entry)
    }

    return days
  }, [calendarDays])

  const scanActionData = useMemo(() => {
    if (!scanSummary) return []

    return Object.entries(scanSummary.by_action)
      .map(([action, value]) => ({
        name: toFriendlyTripAction(action),
        rawAction: action,
        value,
      }))
      .sort((a, b) => b.value - a.value)
  }, [scanSummary])

  const scanLocationData = useMemo(() => {
    if (!scanSummary) return []

    return Object.entries(scanSummary.by_location)
      .map(([location, value]) => ({
        name: toFriendlyLocation(location as 'COMPANY' | 'PORT'),
        rawLocation: location,
        value,
      }))
      .sort((a, b) => b.value - a.value)
  }, [scanSummary])

  const modalTitle = useMemo(() => {
    switch (activeModal) {
      case 'kpis':
        return 'Indicateurs clés'
      case 'evolution':
        return 'Évolution des trajets'
      case 'durations':
        return 'Répartition des durées'
      case 'status':
        return 'Répartition des statuts'
      case 'topTrucks':
        return 'Tous les camions'
      case 'highlights':
        return 'Faits marquants'
      case 'recentTrips':
        return 'Tous les derniers trajets'
      case 'longestTrips':
        return 'Trajets les plus longs'
      case 'scanActivity':
        return 'Activité des scans'
      case 'scanActions':
        return 'Répartition des actions'
      case 'scanLocations':
        return 'Répartition des lieux'
      default:
        return ''
    }
  }, [activeModal])

  function renderModalContent() {
    switch (activeModal) {
      case 'kpis':
        return (
          <div className="max-h-[60vh] overflow-auto">
            <DataTable
              data={kpiDetails}
              emptyText="Aucun indicateur"
              columns={[
                { key: 'label', header: 'Indicateur', render: (item) => item.label },
                { key: 'value', header: 'Valeur', render: (item) => item.value },
              ]}
            />
          </div>
        )
      case 'evolution':
        return (
          <div className="max-h-[60vh] overflow-auto">
            <DataTable
              data={evolution}
              emptyText="Aucune évolution disponible"
              columns={[
                { key: 'date', header: 'Date', render: (item) => item.date },
                { key: 'count', header: 'Trajets', render: (item) => item.count },
              ]}
            />
          </div>
        )
      case 'durations':
        return (
          <div className="max-h-[60vh] overflow-auto">
            <DataTable
              data={durations}
              emptyText="Aucune distribution disponible"
              columns={[
                { key: 'range', header: 'Plage', render: (item) => item.range },
                { key: 'value', header: 'Trajets', render: (item) => item.value },
              ]}
            />
          </div>
        )
      case 'status':
        return (
          <div className="max-h-[60vh] overflow-auto">
            <DataTable
              data={tripStatusData}
              emptyText="Aucun statut disponible"
              columns={[
                { key: 'status', header: 'Statut', render: (item) => item.name },
                { key: 'value', header: 'Trajets', render: (item) => item.value },
              ]}
            />
          </div>
        )
      case 'topTrucks':
        return (
          <div className="max-h-[60vh] overflow-auto">
            <DataTable
              data={truckInsights}
              emptyText="Aucun camion disponible"
              columns={[
                {
                  key: 'camion',
                  header: 'Camion',
                  render: (item) => item.registration,
                },
                {
                  key: 'chauffeur',
                  header: 'Chauffeur',
                  render: (item) => item.driverName ?? '-',
                },
                {
                  key: 'total',
                  header: 'Trajets',
                  render: (item) => item.totalTrips,
                },
                {
                  key: 'actifs',
                  header: 'Actifs',
                  render: (item) => item.activeTrips,
                },
                {
                  key: 'termines',
                  header: 'Terminés',
                  render: (item) => item.completedTrips,
                },
                {
                  key: 'temps',
                  header: 'Temps total',
                  render: (item) => formatDuration(item.totalMinutes),
                },
                {
                  key: 'moyenne',
                  header: 'Moyenne',
                  render: (item) => formatDuration(item.averageMinutes),
                },
                {
                  key: 'dernier',
                  header: 'Dernier trajet',
                  render: (item) => (item.lastTripAt ? formatDate(item.lastTripAt) : '-'),
                },
              ]}
            />
          </div>
        )
      case 'highlights':
        return (
          <div className="max-h-[60vh] overflow-auto">
            <DataTable
              data={highlightDetails}
              emptyText="Aucun fait marquant"
              columns={[
                { key: 'label', header: 'Indicateur', render: (item) => item.label },
                { key: 'value', header: 'Valeur', render: (item) => item.value },
              ]}
            />
          </div>
        )
      case 'recentTrips':
        return (
          <div className="max-h-[60vh] overflow-auto">
            <DataTable
              data={sortedTrips}
              emptyText="Aucun trajet disponible"
              columns={[
                { key: 'id', header: 'ID', render: (trip) => `#${trip.id}` },
                {
                  key: 'camion',
                  header: 'Camion',
                  render: (trip) => trip.truck_registration_number ?? '-',
                },
                {
                  key: 'statut',
                  header: 'Statut',
                  render: (trip) => toFriendlyTripStatus(trip.status),
                },
                {
                  key: 'depart',
                  header: 'Départ',
                  render: (trip) => formatDate(trip.started_at),
                },
                {
                  key: 'retour',
                  header: 'Retour',
                  render: (trip) => formatDate(trip.completed_at),
                },
              ]}
            />
          </div>
        )
      case 'longestTrips':
        return (
          <div className="max-h-[60vh] overflow-auto">
            <DataTable
              data={tripsByDuration}
              emptyText="Aucun trajet terminé"
              columns={[
                {
                  key: 'camion',
                  header: 'Camion',
                  render: (item) => item.trip.truck_registration_number ?? '-',
                },
                {
                  key: 'duree',
                  header: 'Durée',
                  render: (item) => formatDuration(item.duration),
                },
                {
                  key: 'depart',
                  header: 'Départ',
                  render: (item) => formatDate(item.trip.started_at),
                },
                {
                  key: 'retour',
                  header: 'Retour',
                  render: (item) => formatDate(item.trip.completed_at),
                },
              ]}
            />
          </div>
        )
      case 'scanActivity':
        return (
          <div className="max-h-[60vh] overflow-auto space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Total scans</p>
                <p className="mt-1 text-sm text-zinc-900">{scanSummary?.total_logs ?? 0}</p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Opérateurs uniques</p>
                <p className="mt-1 text-sm text-zinc-900">{scanSummary?.unique_operators ?? 0}</p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Scans entreprise / port</p>
                <p className="mt-1 text-sm text-zinc-900">
                  {(scanSummary?.by_location?.COMPANY ?? 0)} / {(scanSummary?.by_location?.PORT ?? 0)}
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-zinc-900">Par action</h3>
                <DataTable
                  data={scanActionData}
                  emptyText="Aucune action"
                  columns={[
                    { key: 'action', header: 'Action', render: (item) => item.name },
                    { key: 'value', header: 'Total', render: (item) => item.value },
                  ]}
                />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-zinc-900">Par localisation</h3>
                <DataTable
                  data={scanLocationData}
                  emptyText="Aucune localisation"
                  columns={[
                    { key: 'location', header: 'Localisation', render: (item) => item.name },
                    { key: 'value', header: 'Total', render: (item) => item.value },
                  ]}
                />
              </div>
            </div>
          </div>
        )
      case 'scanActions':
        return (
          <div className="max-h-[60vh] overflow-auto">
            <DataTable
              data={scanActionData}
              emptyText="Aucune action"
              columns={[
                { key: 'action', header: 'Action', render: (item) => item.name },
                { key: 'value', header: 'Total', render: (item) => item.value },
              ]}
            />
          </div>
        )
      case 'scanLocations':
        return (
          <div className="max-h-[60vh] overflow-auto">
            <DataTable
              data={scanLocationData}
              emptyText="Aucune localisation"
              columns={[
                { key: 'location', header: 'Localisation', render: (item) => item.name },
                { key: 'value', header: 'Total', render: (item) => item.value },
              ]}
            />
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div>
      <PageHeader
        title="Tableau de bord"
        description="Vue globale des trajets, performances et indicateurs clés."
      />

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
      {isLoading ? <p className="mb-4 text-sm text-zinc-500">Chargement des statistiques...</p> : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-900">Indicateurs clés</h2>
          <Button variant="ghost" onClick={() => setActiveModal('kpis')}>
            Voir plus
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Nombre total de trajets" value={summary.totalTrips} />
          <KpiCard label="Nombre de trajets actifs" value={summary.activeTrips} />
          <KpiCard label="Camions enregistrés" value={truckTotals.total} />
          <KpiCard label="Camions actifs / inactifs" value={`${truckTotals.active} / ${truckTotals.inactive}`} />
          <KpiCard label="Durée moyenne d’un trajet" value={formatDuration(tripDurationStats.averageMinutes)} />
          <KpiCard label="Temps moyen (Entreprise → Port)" value={formatDuration(summary.avgCompanyToPort)} />
          <KpiCard label="Temps moyen au port" value={formatDuration(summary.avgPortDuration)} />
          <KpiCard label="Temps moyen (Port → Entreprise)" value={formatDuration(summary.avgPortToCompany)} />
        </div>
      </section>

      <section className="mt-4">
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">Aperçu calendrier ({DASHBOARD_CALENDAR_PREVIEW} jours)</h2>
          </div>

          {calendarError ? <p className="mb-2 text-sm text-red-600">{calendarError}</p> : null}

          <div className="mt-2 flex gap-2 overflow-x-auto">
            {recentCalendarPreview.map((day) => (
              <div key={day.day} className="min-w-[110px] rounded-lg border border-zinc-200 bg-white p-2 text-center">
                <div className="text-xs text-zinc-500">{formatCalendarLabel(day.day)}</div>
                <div className="mt-1 text-lg font-semibold text-zinc-900">{day.total}</div>
                <div className="text-[11px] text-zinc-500">trajets</div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">Évolution des trajets</h2>
            <Button variant="ghost" onClick={() => setActiveModal('evolution')}>
              Voir plus
            </Button>
          </div>
          <div ref={evolutionChart.ref} className="h-[260px] min-w-0">
            {evolutionChart.ready ? (
              <ResponsiveContainer width="100%" height={260} minWidth={0} minHeight={260}>
                <LineChart data={evolution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line dataKey="count" stroke="#F2B841" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </Card>

        <Card className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">Répartition des durées</h2>
            <Button variant="ghost" onClick={() => setActiveModal('durations')}>
              Voir plus
            </Button>
          </div>
          <div ref={durationsChart.ref} className="h-[260px] min-w-0">
            {durationsChart.ready ? (
              <ResponsiveContainer width="100%" height={260} minWidth={0} minHeight={260}>
                <BarChart data={durations}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#F2B841" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </Card>

        <Card className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">Répartition des statuts</h2>
            <Button variant="ghost" onClick={() => setActiveModal('status')}>
              Voir plus
            </Button>
          </div>
          <div ref={statusChart.ref} className="h-[260px] min-w-0">
            {statusChart.ready ? (
              <ResponsiveContainer width="100%" height={260} minWidth={0} minHeight={260}>
                <PieChart>
                  <Pie data={tripStatusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
                    {tripStatusData.map((entry, index) => (
                      <Cell key={entry.rawStatus} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">Camions les plus actifs</h2>
            <Button variant="ghost" onClick={() => setActiveModal('topTrucks')}>
              Voir plus
            </Button>
          </div>
          <DataTable
            data={topTrucks}
            emptyText="Aucun trajet disponible"
            columns={[
              {
                key: 'camion',
                header: 'Camion',
                render: (item) => item.registration,
              },
              {
                key: 'chauffeur',
                header: 'Chauffeur',
                render: (item) => item.driverName ?? '-',
              },
              {
                key: 'total',
                header: 'Trajets',
                render: (item) => item.totalTrips,
              },
              {
                key: 'actifs',
                header: 'Actifs',
                render: (item) => item.activeTrips,
              },
              {
                key: 'totalTemps',
                header: 'Temps total',
                render: (item) => formatDuration(item.totalMinutes),
              },
              {
                key: 'moyenne',
                header: 'Moyenne',
                render: (item) => formatDuration(item.averageMinutes),
              },
            ]}
          />
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">Faits marquants</h2>
            <Button variant="ghost" onClick={() => setActiveModal('highlights')}>
              Voir plus
            </Button>
          </div>
          <div className="space-y-3 text-sm text-zinc-600">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Camion le plus actif</p>
              <p className="mt-1 text-sm text-zinc-900">
                {mostActiveTruck ? `${mostActiveTruck.registration} (${mostActiveTruck.totalTrips} trajets)` : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Temps cumulé (trajets terminés)</p>
              <p className="mt-1 text-sm text-zinc-900">
                {formatDuration(tripDurationStats.totalMinutes)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Dernier trajet enregistré</p>
              <p className="mt-1 text-sm text-zinc-900">
                {tripDurationStats.lastTripAt ? formatDate(tripDurationStats.lastTripAt) : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Trajets terminés</p>
              <p className="mt-1 text-sm text-zinc-900">{tripDurationStats.completedCount}</p>
            </div>
          </div>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">Derniers trajets</h2>
            <Button variant="ghost" onClick={() => setActiveModal('recentTrips')}>
              Voir plus
            </Button>
          </div>
          <DataTable
            data={recentTrips}
            emptyText="Aucun trajet disponible"
            columns={[
              { key: 'id', header: 'ID', render: (trip) => `#${trip.id}` },
              {
                key: 'camion',
                header: 'Camion',
                render: (trip) => trip.truck_registration_number ?? '-',
              },
              {
                key: 'statut',
                header: 'Statut',
                render: (trip) => toFriendlyTripStatus(trip.status),
              },
              {
                key: 'depart',
                header: 'Départ',
                render: (trip) => formatDate(trip.started_at),
              },
              {
                key: 'retour',
                header: 'Retour',
                render: (trip) => formatDate(trip.completed_at),
              },
            ]}
          />
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">Trajets les plus longs</h2>
            <Button variant="ghost" onClick={() => setActiveModal('longestTrips')}>
              Voir plus
            </Button>
          </div>
          <DataTable
            data={longestTrips}
            emptyText="Aucun trajet terminé"
            columns={[
              {
                key: 'camion',
                header: 'Camion',
                render: (item) => item.trip.truck_registration_number ?? '-',
              },
              {
                key: 'duree',
                header: 'Durée',
                render: (item) => formatDuration(item.duration),
              },
              {
                key: 'depart',
                header: 'Départ',
                render: (item) => formatDate(item.trip.started_at),
              },
              {
                key: 'retour',
                header: 'Retour',
                render: (item) => formatDate(item.trip.completed_at),
              },
            ]}
          />
        </Card>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">Activité des scans</h2>
            <Button variant="ghost" onClick={() => setActiveModal('scanActivity')}>
              Voir plus
            </Button>
          </div>
          <div className="space-y-3 text-sm text-zinc-600">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Total scans</p>
              <p className="mt-1 text-sm text-zinc-900">{scanSummary?.total_logs ?? 0}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Opérateurs uniques</p>
              <p className="mt-1 text-sm text-zinc-900">{scanSummary?.unique_operators ?? 0}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Scans entreprise / port</p>
              <p className="mt-1 text-sm text-zinc-900">
                {(scanSummary?.by_location?.COMPANY ?? 0)} / {(scanSummary?.by_location?.PORT ?? 0)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">Répartition des actions</h2>
            <Button variant="ghost" onClick={() => setActiveModal('scanActions')}>
              Voir plus
            </Button>
          </div>
          <div ref={scanActionChart.ref} className="h-[240px] min-w-0">
            {scanActionChart.ready ? (
              <ResponsiveContainer width="100%" height={240} minWidth={0} minHeight={240}>
                <PieChart>
                  <Pie data={scanActionData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85}>
                    {scanActionData.map((entry, index) => (
                      <Cell key={entry.rawAction} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </Card>

        <Card className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">Répartition des lieux</h2>
            <Button variant="ghost" onClick={() => setActiveModal('scanLocations')}>
              Voir plus
            </Button>
          </div>
          <div ref={scanLocationChart.ref} className="h-[240px] min-w-0">
            {scanLocationChart.ready ? (
              <ResponsiveContainer width="100%" height={240} minWidth={0} minHeight={240}>
                <PieChart>
                  <Pie data={scanLocationData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85}>
                    {scanLocationData.map((entry, index) => (
                      <Cell key={entry.rawLocation} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </Card>
      </section>

      <Modal open={activeModal !== null} title={modalTitle} onClose={() => setActiveModal(null)}>
        {renderModalContent()}
      </Modal>
    </div>
  )
}
