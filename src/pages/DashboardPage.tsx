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
import { getTrips } from '../api/trips'
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
  Truck,
} from '../types'
import { formatDate, formatDuration, getDurationMinutes } from '../utils/format'
import { toFriendlyLocation, toFriendlyTripAction, toFriendlyTripStatus } from '../utils/labels'

const PIE_COLORS = ['#F2B841', '#0EA5E9', '#22C55E', '#F97316', '#EF4444', '#64748B', '#14B8A6']

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

function toTimestamp(value?: string | null): number | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.getTime()
}

function pickLatestDate(current: string | null, candidate?: string | null) {
  const currentTime = toTimestamp(current)
  const candidateTime = toTimestamp(candidate)

  if (candidateTime == null) return current
  if (currentTime == null || candidateTime > currentTime) return candidate
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
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isAllTrucksOpen, setIsAllTrucksOpen] = useState(false)
  const evolutionChart = useChartReady<HTMLDivElement>()
  const durationsChart = useChartReady<HTMLDivElement>()
  const statusChart = useChartReady<HTMLDivElement>()
  const scanActionChart = useChartReady<HTMLDivElement>()
  const scanLocationChart = useChartReady<HTMLDivElement>()

  useEffect(() => {
    let active = true

    async function loadData() {
      setError('')
      setIsLoading(true)

      const results = await Promise.allSettled([
        getReportsSummary(),
        getReportsEvolution(),
        getReportsDurations(),
        fetchAllTrips(),
        fetchAllTrucks(),
        getScanLogs({ limit: 1, page: 1 }),
      ])

      if (!active) return

      const [summaryResult, evolutionResult, durationsResult, tripsResult, trucksResult, scanResult] = results

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

  const recentTrips = useMemo(() => {
    const sorted = [...trips].sort((a, b) => {
      const aTime = Math.max(toTimestamp(a.started_at) ?? 0, toTimestamp(a.completed_at) ?? 0)
      const bTime = Math.max(toTimestamp(b.started_at) ?? 0, toTimestamp(b.completed_at) ?? 0)
      return bTime - aTime
    })

    return sorted.slice(0, 6)
  }, [trips])

  const longestTrips = useMemo(() => {
    const withDuration = trips
      .map((trip) => ({
        trip,
        duration: getDurationMinutes(trip.started_at, trip.completed_at),
      }))
      .filter((item): item is { trip: Trip; duration: number } => typeof item.duration === 'number')

    return withDuration
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 6)
  }, [trips])

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

  return (
    <div>
      <PageHeader
        title="Tableau de bord"
        description="Vue globale des trajets, performances et indicateurs clés."
      />

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
      {isLoading ? <p className="mb-4 text-sm text-zinc-500">Chargement des statistiques...</p> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Nombre total de trajets" value={summary.totalTrips} />
        <KpiCard label="Nombre de trajets actifs" value={summary.activeTrips} />
        <KpiCard label="Camions enregistrés" value={truckTotals.total} />
        <KpiCard label="Camions actifs / inactifs" value={`${truckTotals.active} / ${truckTotals.inactive}`} />
        <KpiCard label="Durée moyenne d’un trajet" value={formatDuration(tripDurationStats.averageMinutes)} />
        <KpiCard label="Temps moyen (Entreprise → Port)" value={formatDuration(summary.avgCompanyToPort)} />
        <KpiCard label="Temps moyen au port" value={formatDuration(summary.avgPortDuration)} />
        <KpiCard label="Temps moyen (Port → Entreprise)" value={formatDuration(summary.avgPortToCompany)} />
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="min-w-0">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Évolution des trajets</h2>
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
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Répartition des durées</h2>
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
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Répartition des statuts</h2>
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
            <Button variant="ghost" onClick={() => setIsAllTrucksOpen(true)}>
              Voir tout
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
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Faits marquants</h2>
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
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Derniers trajets</h2>
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
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Trajets les plus longs</h2>
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
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Activité des scans</h2>
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
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Répartition des actions</h2>
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
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Répartition des lieux</h2>
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

      <Modal open={isAllTrucksOpen} title="Tous les camions" onClose={() => setIsAllTrucksOpen(false)}>
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
      </Modal>
    </div>
  )
}
