import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getApiErrorMessage } from '../api/http'
import { getTrips, getTripsByDay, getTripsCalendar } from '../api/trips'
import { DataTable } from '../components/common/DataTable'
import { PageHeader } from '../components/common/PageHeader'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import type { Trip, TripCalendarDay, TripsByDaySummary } from '../types'
import { formatDate } from '../utils/format'
import { toFriendlyTripStatus } from '../utils/labels'
import { cn } from '../utils/cn'

const PAGE_SIZE = 20
const SEARCH_FETCH_LIMIT = 100
const WEEK_START = 1
const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const EMPTY_DAY_SUMMARY: TripsByDaySummary = { total: 0, active: 0, completed: 0, by_status: {} }

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase()
}

function extractTripDateKey(dateTime: string | null | undefined) {
  if (!dateTime) return null
  const value = String(dateTime)
  const match = value.match(/\d{4}-\d{2}-\d{2}/)
  return match ? match[0] : null
}

function getTripDateKey(trip: Trip) {
  return (
    extractTripDateKey(trip.created_at) ??
    extractTripDateKey(trip.started_at) ??
    extractTripDateKey(trip.completed_at)
  )
}

function isInDateRange(dateKey: string | null, from: string, to: string) {
  if (!dateKey) return false
  if (from && dateKey < from) return false
  if (to && dateKey > to) return false
  return true
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

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function calendarHasTrips(days: TripCalendarDay[]) {
  return days.some((day) => (day.total ?? 0) > 0 || (day.trips?.length ?? 0) > 0)
}

function latestCalendarDay(days: TripCalendarDay[]) {
  return [...days].reverse().find((day) => (day.total ?? 0) > 0 || (day.trips?.length ?? 0) > 0)
}

function buildCalendarRange(cursor: Date) {
  const monthStart = startOfMonth(cursor)
  const monthEnd = endOfMonth(cursor)
  const rangeStart = startOfWeek(monthStart, WEEK_START)
  const rangeEnd = endOfWeek(monthEnd, WEEK_START)

  return {
    rangeStart,
    rangeEnd,
    from: toDateKey(rangeStart),
    to: toDateKey(rangeEnd),
  }
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function startOfWeek(date: Date, weekStart: number) {
  const weekday = date.getDay()
  const diff = (weekday - weekStart + 7) % 7
  return addDays(date, -diff)
}

function endOfWeek(date: Date, weekStart: number) {
  return addDays(startOfWeek(date, weekStart), 6)
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(date)
}

function formatDayLabel(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(parseDateKey(value))
}

function formatLongDayLabel(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(parseDateKey(value))
}

export function TripsPage() {
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')
  const [trips, setTrips] = useState<Trip[]>([])
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [truckSearch, setTruckSearch] = useState('')
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [listError, setListError] = useState('')

  const todayKey = useMemo(() => toDateKey(new Date()), [])
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()))
  const [selectedDay, setSelectedDay] = useState(todayKey)
  const [calendarDays, setCalendarDays] = useState<TripCalendarDay[]>([])
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [calendarError, setCalendarError] = useState('')
  const [dayTrips, setDayTrips] = useState<Trip[]>([])
  const [daySummary, setDaySummary] = useState<TripsByDaySummary>(EMPTY_DAY_SUMMARY)
  const [dayPage, setDayPage] = useState(1)
  const [dayLastPage, setDayLastPage] = useState(1)
  const [dayLoading, setDayLoading] = useState(false)
  const [dayError, setDayError] = useState('')
  const hasBootstrappedCalendar = useRef(false)
  const navigate = useNavigate()

  const calendarRange = useMemo(() => {
    return buildCalendarRange(monthCursor)
  }, [monthCursor])

  const calendarMap = useMemo(() => {
    return new Map(calendarDays.map((day) => [day.day, day]))
  }, [calendarDays])

  const calendarCells = useMemo(() => {
    const cells: Array<{
      key: string
      date: Date
      summary: TripCalendarDay | undefined
      isCurrentMonth: boolean
      isSelected: boolean
      isToday: boolean
    }> = []

    const endTime = calendarRange.rangeEnd.getTime()
    for (let cursor = new Date(calendarRange.rangeStart); cursor.getTime() <= endTime; cursor = addDays(cursor, 1)) {
      const key = toDateKey(cursor)
      const summary = calendarMap.get(key)
      cells.push({
        key,
        date: new Date(cursor),
        summary,
        isCurrentMonth: cursor.getMonth() === monthCursor.getMonth(),
        isSelected: key === selectedDay,
        isToday: key === todayKey,
      })
    }

    return cells
  }, [calendarMap, calendarRange, monthCursor, selectedDay, todayKey])

  const selectedCalendarDay = useMemo(() => calendarMap.get(selectedDay), [calendarMap, selectedDay])

  const selectedCalendarTrips = useMemo(() => {
    return selectedCalendarDay?.trips ?? []
  }, [selectedCalendarDay])

  const dayStatusBreakdown = useMemo(() => {
    return Object.entries(daySummary.by_status)
      .map(([status, count]) => ({
        status,
        label: toFriendlyTripStatus(status),
        count,
      }))
      .sort((a, b) => b.count - a.count)
  }, [daySummary])

  useEffect(() => {
    if (viewMode !== 'list') return

    let active = true

    async function loadTrips() {
      setListError('')

      if (fromDate && toDate && fromDate > toDate) {
        if (active) {
          setTrips([])
          setLastPage(1)
          setListError('La date de fin doit être supérieure ou égale à la date de début')
        }
        return
      }

      try {
        const normalizedSearch = normalizeSearchText(truckSearch)
        const hasSearch = Boolean(normalizedSearch)
        const baseParams = {
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          from: fromDate || undefined,
          to: toDate || undefined,
        }

        if (!hasSearch) {
          const response = await getTrips({
            limit: PAGE_SIZE,
            page,
            ...baseParams,
          })

          if (active) {
            setTrips(response.items)
            setLastPage(response.lastPage)
          }

          return
        }

        const firstPage = await getTrips({
          limit: SEARCH_FETCH_LIMIT,
          page: 1,
          ...baseParams,
        })

        const pageRequests: Array<ReturnType<typeof getTrips>> = []
        for (let currentPage = 2; currentPage <= firstPage.lastPage; currentPage += 1) {
          pageRequests.push(
            getTrips({
              limit: SEARCH_FETCH_LIMIT,
              page: currentPage,
              ...baseParams,
            }),
          )
        }

        const remainingPages = pageRequests.length ? await Promise.all(pageRequests) : []
        const allTrips = [firstPage, ...remainingPages].flatMap((response) => response.items)

        const filteredTrips = allTrips.filter((trip) => {
          const dateKey = getTripDateKey(trip)
          if (!isInDateRange(dateKey, fromDate, toDate)) {
            return false
          }

          if (!hasSearch) {
            return true
          }

          const registration = normalizeSearchText(trip.truck_registration_number ?? '')
          const driverName = normalizeSearchText(trip.truck_driver_name ?? '')

          return registration.includes(normalizedSearch) || driverName.includes(normalizedSearch)
        })

        const computedLastPage = Math.max(1, Math.ceil(filteredTrips.length / PAGE_SIZE))
        const safePage = Math.min(page, computedLastPage)
        const startIndex = (safePage - 1) * PAGE_SIZE
        const pagedTrips = filteredTrips.slice(startIndex, startIndex + PAGE_SIZE)

        if (active) {
          if (safePage !== page) {
            setPage(safePage)
          }
          setTrips(pagedTrips)
          setLastPage(computedLastPage)
        }
      } catch (requestError) {
        if (active) {
          setListError(getApiErrorMessage(requestError))
        }
      }
    }

    void loadTrips()

    return () => {
      active = false
    }
  }, [fromDate, page, statusFilter, toDate, truckSearch, viewMode])

  useEffect(() => {
    if (viewMode !== 'calendar') return

    let active = true

    async function loadCalendar() {
      setCalendarError('')
      setCalendarLoading(true)

      try {
        if (import.meta.env.DEV) {
          console.log('[TripsPage] loadCalendar:start', {
            from: calendarRange.from,
            to: calendarRange.to,
            status: statusFilter === 'ALL' ? undefined : statusFilter,
            monthCursor: monthCursor.toISOString(),
          })
        }

        let nextMonthCursor: Date | null = null
        let data = await getTripsCalendar({
          from: calendarRange.from,
          to: calendarRange.to,
          status: statusFilter === 'ALL' ? undefined : statusFilter,
        })

        if (import.meta.env.DEV) {
          console.log('[TripsPage] loadCalendar:current-month-result', {
            dayCount: data.length,
            daysWithTrips: data.filter((day) => (day.total ?? 0) > 0 || (day.trips?.length ?? 0) > 0).length,
            firstDay: data[0]?.day ?? null,
            lastDay: data[data.length - 1]?.day ?? null,
          })
        }

        if (!hasBootstrappedCalendar.current && !calendarHasTrips(data)) {
          for (let offset = 1; offset <= 6; offset += 1) {
            const candidateCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() - offset, 1)
            const candidateRange = buildCalendarRange(candidateCursor)

            if (import.meta.env.DEV) {
              console.log('[TripsPage] loadCalendar:fallback-attempt', {
                offset,
                from: candidateRange.from,
                to: candidateRange.to,
              })
            }

            const candidateData = await getTripsCalendar({
              from: candidateRange.from,
              to: candidateRange.to,
              status: statusFilter === 'ALL' ? undefined : statusFilter,
            })

            if (import.meta.env.DEV) {
              console.log('[TripsPage] loadCalendar:fallback-result', {
                offset,
                dayCount: candidateData.length,
                daysWithTrips: candidateData.filter((day) => (day.total ?? 0) > 0 || (day.trips?.length ?? 0) > 0).length,
              })
            }

            if (calendarHasTrips(candidateData)) {
              data = candidateData
              nextMonthCursor = candidateCursor
              break
            }
          }
        }

        if (active) {
          setCalendarDays(data)

          if (import.meta.env.DEV) {
            console.log('[TripsPage] loadCalendar:applied', {
              selectedDay: latestCalendarDay(data)?.day ?? null,
              calendarDays: data.length,
            })
          }

          const selectedData = latestCalendarDay(data)
          if (selectedData) {
            setSelectedDay(selectedData.day)
            const parsedSelectedDay = parseDateKey(selectedData.day)
            if (parsedSelectedDay.getMonth() !== monthCursor.getMonth() || parsedSelectedDay.getFullYear() !== monthCursor.getFullYear()) {
              setMonthCursor(startOfMonth(parsedSelectedDay))
            }
          } else if (!hasBootstrappedCalendar.current) {
            setSelectedDay(todayKey)
          }

          if (nextMonthCursor) {
            setMonthCursor(nextMonthCursor)
          }

          hasBootstrappedCalendar.current = true
        }
      } catch (requestError) {
        if (active) {
          setCalendarError(getApiErrorMessage(requestError))
        }
      } finally {
        if (active) {
          setCalendarLoading(false)
        }
      }
    }

    void loadCalendar()

    return () => {
      active = false
    }
  }, [calendarRange.from, calendarRange.to, monthCursor, statusFilter, todayKey, viewMode])

  useEffect(() => {
    if (viewMode !== 'calendar') return

    let active = true

    async function loadDayTrips() {
      setDayError('')
      setDayLoading(true)

      const hasEmbeddedTrips = Array.isArray(selectedCalendarDay?.trips)
      const shouldUseEmbeddedTrips = hasEmbeddedTrips && (selectedCalendarTrips.length > 0 || (selectedCalendarDay?.total ?? 0) === 0)

      if (import.meta.env.DEV) {
        console.log('[TripsPage] loadDayTrips:start', {
          selectedDay,
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          hasEmbeddedTrips,
          embeddedTripCount: selectedCalendarTrips.length,
          selectedCalendarDayTotal: selectedCalendarDay?.total ?? null,
          shouldUseEmbeddedTrips,
        })
      }

      if (shouldUseEmbeddedTrips) {
        if (active) {
          setDayTrips(selectedCalendarTrips)
          setDaySummary({
            total: selectedCalendarDay?.total ?? selectedCalendarTrips.length,
            active: selectedCalendarDay?.active ?? 0,
            completed: selectedCalendarDay?.completed ?? 0,
            by_status: selectedCalendarDay?.by_status ?? {},
          })
          setDayLastPage(1)
          setDayPage(1)
          setDayLoading(false)
        }
        return
      }

      try {
        const response = await getTripsByDay({
          day: selectedDay,
          all: true,
          status: statusFilter === 'ALL' ? undefined : statusFilter,
        })

        if (import.meta.env.DEV) {
          console.log('[TripsPage] loadDayTrips:response', {
            itemCount: response.items.length,
            total: response.total,
            lastPage: response.lastPage,
            page: response.page,
            perPage: response.perPage,
            totalItems: response.total_items ?? null,
            window: response.window ?? null,
            summary: response.summary,
            firstTrip: response.items[0] ?? null,
          })
        }

        if (active) {
          setDayTrips(response.items)
          setDayLastPage(1)
          setDayPage(1)
          setDaySummary(response.summary)
        }
      } catch (requestError) {
        if (active) {
          setDayError(getApiErrorMessage(requestError))
          setDayTrips([])
          setDayLastPage(1)
          setDaySummary(EMPTY_DAY_SUMMARY)
        }
      } finally {
        if (active) {
          setDayLoading(false)
        }
      }
    }

    void loadDayTrips()

    return () => {
      active = false
    }
  }, [selectedCalendarDay, selectedCalendarTrips, selectedDay, statusFilter, viewMode])

  useEffect(() => {
    if (viewMode !== 'calendar') return
    setDayPage(1)
  }, [selectedDay, statusFilter, viewMode])

  function handleSelectDay(dayKey: string) {
    setSelectedDay(dayKey)
    const nextDate = parseDateKey(dayKey)
    if (nextDate.getMonth() !== monthCursor.getMonth() || nextDate.getFullYear() !== monthCursor.getFullYear()) {
      setMonthCursor(startOfMonth(nextDate))
    }
  }

  function shiftMonth(offset: number) {
    const next = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + offset, 1)
    setMonthCursor(next)
    setSelectedDay(toDateKey(next))
  }

  function jumpToToday() {
    const today = new Date()
    setMonthCursor(startOfMonth(today))
    setSelectedDay(toDateKey(today))
  }

  return (
    <div>
      <PageHeader
        title="Suivi des trajets"
        description="Analysez les trajets par tranche 7h → 7h ou en liste détaillée."
        actions={
          <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-1">
            <Button
              type="button"
              variant="ghost"
              className={cn(
                'h-8 rounded-md px-3 text-xs font-semibold',
                viewMode === 'calendar'
                  ? 'bg-zinc-900 text-white hover:bg-zinc-800'
                  : 'text-zinc-600 hover:bg-zinc-100',
              )}
              onClick={() => setViewMode('calendar')}
            >
              Calendrier 7h → 7h
            </Button>
            <Button
              type="button"
              variant="ghost"
              className={cn(
                'h-8 rounded-md px-3 text-xs font-semibold',
                viewMode === 'list'
                  ? 'bg-zinc-900 text-white hover:bg-zinc-800'
                  : 'text-zinc-600 hover:bg-zinc-100',
              )}
              onClick={() => setViewMode('list')}
            >
              Liste
            </Button>
          </div>
        }
      />

      {viewMode === 'calendar' ? (
        <div className="space-y-4">
          <Card className="bg-gradient-to-br from-white via-amber-50/40 to-zinc-50">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Mois sélectionné</p>
                <h2 className="mt-1 text-xl font-semibold text-zinc-900">{formatMonthLabel(monthCursor)}</h2>
                <p className="text-xs text-zinc-500">Période 7h → 7h, regroupée par jour</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="ghost" onClick={() => shiftMonth(-1)}>
                  Mois précédent
                </Button>
                <Button type="button" variant="secondary" onClick={jumpToToday}>
                  Aujourd’hui
                </Button>
                <Button type="button" variant="ghost" onClick={() => shiftMonth(1)}>
                  Mois suivant
                </Button>
                <Select
                  className="min-w-[180px]"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="ALL">Tous les statuts</option>
                  <option value="STARTED">Départ en cours</option>
                  <option value="ARRIVED_PORT">Arrivé au port</option>
                  <option value="LEFT_PORT">Sortie du port</option>
                  <option value="COMPLETED">Trajet terminé</option>
                </Select>
              </div>
            </div>

            {calendarError ? <p className="mt-3 text-sm text-red-600">{calendarError}</p> : null}
            {calendarLoading ? <p className="mt-3 text-sm text-zinc-500">Chargement du calendrier...</p> : null}

            <div className="mt-4 grid grid-cols-7 gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {DAY_LABELS.map((label) => (
                <div key={label} className="text-center">
                  {label}
                </div>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-7 gap-2">
              {calendarCells.map((cell) => {
                const total = cell.summary?.total ?? 0
                const active = cell.summary?.active ?? 0
                const completed = cell.summary?.completed ?? 0

                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => handleSelectDay(cell.key)}
                    className={cn(
                      'flex min-h-[120px] flex-col justify-between rounded-xl border p-2 text-left transition',
                      cell.isSelected
                        ? 'border-zinc-900 bg-white shadow-md'
                        : 'border-zinc-200 bg-white/80 hover:-translate-y-0.5 hover:border-zinc-300 hover:bg-white',
                      cell.isCurrentMonth ? 'text-zinc-900' : 'text-zinc-400',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn('text-sm font-semibold', cell.isToday && 'text-amber-700')}>
                        {cell.date.getDate()}
                      </span>
                      {cell.isToday ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          Aujourd’hui
                        </span>
                      ) : null}
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-zinc-900">{total}</p>
                      <p className="text-[11px] text-zinc-500">trajets</p>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                        Actifs {active}
                      </span>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-semibold text-zinc-600">
                        Terminés {completed}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Card>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Jour sélectionné</p>
                  <h3 className="mt-1 text-lg font-semibold text-zinc-900">{formatLongDayLabel(selectedDay)}</h3>
                  <p className="text-xs text-zinc-500">Fenêtre 07:00 → 07:00</p>
                </div>
                <div className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-600">
                  {formatDayLabel(selectedDay)}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-zinc-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Total</p>
                  <p className="mt-1 text-lg font-semibold text-zinc-900">{daySummary.total}</p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Actifs</p>
                  <p className="mt-1 text-lg font-semibold text-emerald-800">{daySummary.active}</p>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Terminés</p>
                  <p className="mt-1 text-lg font-semibold text-zinc-900">{daySummary.completed}</p>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Par statut</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {dayStatusBreakdown.length ? (
                    dayStatusBreakdown.map((item) => (
                      <span
                        key={item.status}
                        className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700"
                      >
                        {item.label}: {item.count}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-zinc-500">Aucun statut disponible</span>
                  )}
                </div>
              </div>

              {dayError ? <p className="mt-3 text-sm text-red-600">{dayError}</p> : null}
              {dayLoading ? <p className="mt-3 text-sm text-zinc-500">Chargement des trajets...</p> : null}

              <div className="mt-4">
                <DataTable
                  data={dayTrips}
                  emptyText="Aucun trajet pour cette période"
                  columns={[
                    { key: 'id', header: 'ID', render: (trip) => `#${trip.id}` },
                    {
                      key: 'camion',
                      header: 'Camion',
                      render: (trip) => trip.truck_registration_number ?? '-',
                    },
                    {
                      key: 'chauffeur',
                      header: 'Chauffeur',
                      render: (trip) => trip.truck_driver_name ?? '-',
                    },
                    {
                      key: 'statut',
                      header: 'Statut',
                      render: (trip) => toFriendlyTripStatus(trip.status),
                    },
                    {
                      key: 'depart',
                      header: 'Départ',
                      render: (trip) => formatDate(trip.created_at ?? trip.started_at),
                    },
                    {
                      key: 'retour',
                      header: 'Retour',
                      render: (trip) => formatDate(trip.completed_at),
                    },
                    {
                      key: 'actions',
                      header: 'Actions',
                      render: (trip) => (
                        <Button variant="secondary" onClick={() => navigate(`/trips/${trip.id}`)}>
                          Voir détail
                        </Button>
                      ),
                    },
                  ]}
                />
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <Button variant="ghost" disabled={dayPage <= 1} onClick={() => setDayPage((prev) => prev - 1)}>
                  Précédent
                </Button>
                <span className="text-sm text-zinc-600">
                  Page {dayPage} / {dayLastPage}
                </span>
                <Button variant="ghost" disabled={dayPage >= dayLastPage} onClick={() => setDayPage((prev) => prev + 1)}>
                  Suivant
                </Button>
              </div>
            </Card>

            <Card>
              <h3 className="text-sm font-semibold text-zinc-900">Résumé du jour</h3>
              <div className="mt-3 space-y-3 text-sm text-zinc-600">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Total du jour</p>
                  <p className="mt-1 text-lg font-semibold text-zinc-900">{daySummary.total}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Actifs</p>
                  <p className="mt-1 text-sm text-zinc-900">{daySummary.active}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Terminés</p>
                  <p className="mt-1 text-sm text-zinc-900">{daySummary.completed}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Journée sélectionnée</p>
                  <p className="mt-1 text-sm text-zinc-900">
                    {selectedCalendarDay ? formatDayLabel(selectedCalendarDay.day) : formatDayLabel(selectedDay)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Fenêtre horaire</p>
                  <p className="mt-1 text-sm text-zinc-900">07:00 → 07:00</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : (
        <div>
          <section className="mb-4 grid gap-3 md:grid-cols-5">
            <Select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value)
                setPage(1)
              }}
            >
              <option value="ALL">Tous les statuts</option>
              <option value="STARTED">Départ en cours</option>
              <option value="ARRIVED_PORT">Arrivé au port</option>
              <option value="LEFT_PORT">Sortie du port</option>
              <option value="COMPLETED">Trajet terminé</option>
            </Select>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Du</label>
              <Input
                type="date"
                value={fromDate}
                onChange={(event) => {
                  setFromDate(event.target.value)
                  setPage(1)
                }}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Au</label>
              <Input
                type="date"
                value={toDate}
                onChange={(event) => {
                  setToDate(event.target.value)
                  setPage(1)
                }}
              />
            </div>

            <Input
              type="text"
              placeholder="Rechercher par immatriculation ou chauffeur"
              value={truckSearch}
              onChange={(event) => {
                setTruckSearch(event.target.value)
                setPage(1)
              }}
            />

            <Button
              variant="ghost"
              onClick={() => {
                setStatusFilter('ALL')
                setFromDate('')
                setToDate('')
                setTruckSearch('')
                setPage(1)
              }}
            >
              Réinitialiser
            </Button>
          </section>

          {listError ? <p className="mb-3 text-sm text-red-600">{listError}</p> : null}

          <DataTable
            data={trips}
            columns={[
              { key: 'id', header: 'ID', render: (trip) => `#${trip.id}` },
              {
                key: 'camion',
                header: 'Camion',
                render: (trip) => trip.truck_registration_number ?? '-',
              },
              {
                key: 'chauffeur',
                header: 'Chauffeur',
                render: (trip) => trip.truck_driver_name ?? '-',
              },
              { key: 'statut', header: 'Statut', render: (trip) => toFriendlyTripStatus(trip.status) },
              {
                key: 'depart',
                header: 'Heure départ',
                    render: (trip) => formatDate(trip.created_at ?? trip.started_at),
              },
              {
                key: 'retour',
                header: 'Heure retour',
                render: (trip) => formatDate(trip.completed_at),
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (trip) => (
                  <Button variant="secondary" onClick={() => navigate(`/trips/${trip.id}`)}>
                    Voir détail
                  </Button>
                ),
              },
            ]}
          />

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((prev) => prev - 1)}>
              Précédent
            </Button>
            <span className="text-sm text-zinc-600">
              Page {page} / {lastPage}
            </span>
            <Button variant="ghost" disabled={page >= lastPage} onClick={() => setPage((prev) => prev + 1)}>
              Suivant
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
