import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getApiErrorMessage } from '../api/http'
import { getTrips } from '../api/trips'
import { DataTable } from '../components/common/DataTable'
import { PageHeader } from '../components/common/PageHeader'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import type { Trip } from '../types'
import { formatDate } from '../utils/format'
import { toFriendlyTripStatus } from '../utils/labels'

const PAGE_SIZE = 20
const SEARCH_FETCH_LIMIT = 100

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase()
}

function extractTripDateKey(dateTime: string | null | undefined) {
  if (!dateTime) return null
  const value = String(dateTime)
  const match = value.match(/\d{4}-\d{2}-\d{2}/)
  return match ? match[0] : null
}

function isInDateRange(dateKey: string | null, from: string, to: string) {
  if (!dateKey) return false
  if (from && dateKey < from) return false
  if (to && dateKey > to) return false
  return true
}

export function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [truckSearch, setTruckSearch] = useState('')
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    let active = true

    async function loadTrips() {
      setError('')

      if (fromDate && toDate && fromDate > toDate) {
        if (active) {
          setTrips([])
          setLastPage(1)
          setError('La date de fin doit être supérieure ou égale à la date de début')
        }
        return
      }

      try {
        const normalizedSearch = normalizeSearchText(truckSearch)
        const hasSearch = Boolean(normalizedSearch)
        const hasDateFilter = Boolean(fromDate || toDate)
        const useClientFiltering = hasSearch || hasDateFilter

        if (!useClientFiltering) {
          const response = await getTrips({
            limit: PAGE_SIZE,
            page,
            status: statusFilter === 'ALL' ? undefined : statusFilter,
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
          status: statusFilter === 'ALL' ? undefined : statusFilter,
        })

        const pageRequests: Array<ReturnType<typeof getTrips>> = []
        for (let currentPage = 2; currentPage <= firstPage.lastPage; currentPage += 1) {
          pageRequests.push(
            getTrips({
              limit: SEARCH_FETCH_LIMIT,
              page: currentPage,
              status: statusFilter === 'ALL' ? undefined : statusFilter,
            }),
          )
        }

        const remainingPages = pageRequests.length ? await Promise.all(pageRequests) : []
        const allTrips = [firstPage, ...remainingPages].flatMap((response) => response.items)

        const filteredTrips = allTrips.filter((trip) => {
          const dateKey = extractTripDateKey(trip.started_at) ?? extractTripDateKey(trip.completed_at)
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
          setError(getApiErrorMessage(requestError))
        }
      }
    }

    void loadTrips()

    return () => {
      active = false
    }
  }, [fromDate, page, statusFilter, toDate, truckSearch])

  return (
    <div>
      <PageHeader title="Suivi des trajets" description="Filtrez les trajets et consultez les détails et logs de scan." />

      <section className="mb-4 grid gap-3 md:grid-cols-5">
        <Select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value)
            setPage(1)
          }}
        >
          <option value="ALL">Tous les statuts</option>
          <option value="STARTED">Depart en cours</option>
          <option value="ARRIVED_PORT">Arrive au port</option>
          <option value="LEFT_PORT">Sortie du port</option>
          <option value="COMPLETED">Trajet termine</option>
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

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

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
            render: (trip) => formatDate(trip.started_at),
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
  )
}
