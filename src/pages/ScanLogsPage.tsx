import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getScanLogs, type ScanLogsFilters } from '../api/scanLogs'
import { asRecord, getApiErrorMessage } from '../api/http'
import { getUsers } from '../api/users'
import { DataTable } from '../components/common/DataTable'
import { KpiCard } from '../components/common/KpiCard'
import { PageHeader } from '../components/common/PageHeader'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Button } from '../components/ui/Button'
import type { LocationType, Role, ScanAction, ScanLogEntry, ScanLogsSummary, User } from '../types'
import { formatDate } from '../utils/format'
import { toFriendlyLocation, toFriendlyRole, toFriendlyTripAction, toFriendlyTripStatus } from '../utils/labels'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

const DEFAULT_SUMMARY: ScanLogsSummary = {
  total_logs: 0,
  unique_operators: 0,
  by_action: {},
  by_location: {},
}

const ACTION_OPTIONS: Array<{ value: ''; label: string } | { value: ScanAction; label: string }> = [
  { value: '', label: 'Toutes les actions' },
  { value: 'START', label: 'Depart' },
  { value: 'ARRIVE', label: 'Arrivee' },
  { value: 'LEAVE', label: 'Sortie' },
  { value: 'RETURN', label: 'Retour' },
]

const ROLE_OPTIONS: Array<{ value: ''; label: string } | { value: Role; label: string }> = [
  { value: '', label: 'Tous les roles' },
  { value: 'ADMIN', label: 'Administrateur' },
  { value: 'COMPANY_OPERATOR', label: 'Operateur entreprise' },
  { value: 'PORT_OPERATOR', label: 'Operateur port' },
]

const LOCATION_OPTIONS: Array<{ value: ''; label: string } | { value: LocationType; label: string }> = [
  { value: '', label: 'Toutes les localisations' },
  { value: 'COMPANY', label: 'Entreprise' },
  { value: 'PORT', label: 'Port' },
]

function toPositiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback
  }

  return parsed
}

function clampLimit(value: number) {
  return Math.min(MAX_LIMIT, Math.max(1, value))
}

function normalizeInput(value: string | null) {
  return value?.trim() ?? ''
}

function getFieldFirstError(value: unknown) {
  if (!Array.isArray(value)) return ''
  return typeof value[0] === 'string' ? value[0] : ''
}

function formatRoleLabel(role: string | null | undefined) {
  if (!role) return '-'
  if (role === 'ADMIN' || role === 'COMPANY_OPERATOR' || role === 'PORT_OPERATOR') {
    return toFriendlyRole(role)
  }

  return role
}

function formatLocationLabel(location: string | null | undefined) {
  if (!location) return '-'
  if (location === 'COMPANY' || location === 'PORT') {
    return toFriendlyLocation(location)
  }

  return location
}

export function ScanLogsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [rows, setRows] = useState<ScanLogEntry[]>([])
  const [operators, setOperators] = useState<User[]>([])
  const [summary, setSummary] = useState<ScanLogsSummary>(DEFAULT_SUMMARY)
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fromError, setFromError] = useState('')
  const [toError, setToError] = useState('')

  const queryPage = toPositiveInteger(searchParams.get('page'), 1)
  const queryLimit = clampLimit(toPositiveInteger(searchParams.get('limit'), DEFAULT_LIMIT))
  const queryFrom = normalizeInput(searchParams.get('from'))
  const queryTo = normalizeInput(searchParams.get('to'))
  const queryAction = normalizeInput(searchParams.get('action'))
  const queryLocation = normalizeInput(searchParams.get('location'))
  const queryRole = normalizeInput(searchParams.get('role'))
  const queryUserId = normalizeInput(searchParams.get('user_id'))
  const queryTruckId = normalizeInput(searchParams.get('truck_id'))
  const queryTripId = normalizeInput(searchParams.get('trip_id'))
  const queryRegistration = normalizeInput(searchParams.get('registration_number'))
  const querySearch = normalizeInput(searchParams.get('search'))

  const actionSummaryRows = useMemo(
    () =>
      Object.entries(summary.by_action)
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count),
    [summary.by_action],
  )

  const locationSummaryRows = useMemo(
    () =>
      Object.entries(summary.by_location)
        .map(([location, count]) => ({ location, count }))
        .sort((a, b) => b.count - a.count),
    [summary.by_location],
  )

  function updateParams(
    updates: Record<string, string | null>,
    options: { resetPage?: boolean } = { resetPage: true },
  ) {
    const next = new URLSearchParams(searchParams)

    Object.entries(updates).forEach(([key, value]) => {
      const normalized = normalizeInput(value)
      if (!normalized) {
        next.delete(key)
      } else {
        next.set(key, normalized)
      }
    })

    if (!next.get('limit')) {
      next.set('limit', String(queryLimit))
    }

    if (options.resetPage !== false) {
      next.set('page', '1')
    }

    setSearchParams(next)
  }

  useEffect(() => {
    let active = true

    async function loadOperators() {
      try {
        const firstPage = await getUsers({ limit: MAX_LIMIT, page: 1 })
        const requests: Array<ReturnType<typeof getUsers>> = []

        for (let currentPage = 2; currentPage <= firstPage.lastPage; currentPage += 1) {
          requests.push(getUsers({ limit: MAX_LIMIT, page: currentPage }))
        }

        const remaining = requests.length ? await Promise.all(requests) : []
        const allUsers = [firstPage, ...remaining].flatMap((response) => response.items)

        if (active) {
          const sorted = [...allUsers].sort((a, b) => a.name.localeCompare(b.name))
          setOperators(sorted)
        }
      } catch {
        if (active) {
          setOperators([])
        }
      }
    }

    void loadOperators()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    async function loadScanLogs() {
      setError('')
      setFromError('')
      setToError('')
      setLoading(true)

      if (queryFrom && queryTo && queryTo < queryFrom) {
        if (active) {
          setRows([])
          setSummary(DEFAULT_SUMMARY)
          setTotal(0)
          setPage(1)
          setLastPage(1)
          setError('La date de fin doit etre superieure ou egale a la date de debut')
          setToError('Date de fin invalide')
          setLoading(false)
        }
        return
      }

      const params: ScanLogsFilters = {
        limit: queryLimit,
        page: queryPage,
      }

      if (queryUserId) params.user_id = toPositiveInteger(queryUserId, 0)
      if (queryTruckId) params.truck_id = toPositiveInteger(queryTruckId, 0)
      if (queryTripId) params.trip_id = toPositiveInteger(queryTripId, 0)
      if (queryRole === 'ADMIN' || queryRole === 'COMPANY_OPERATOR' || queryRole === 'PORT_OPERATOR') {
        params.role = queryRole
      }
      if (queryLocation === 'COMPANY' || queryLocation === 'PORT') {
        params.location = queryLocation
      }
      if (queryAction === 'START' || queryAction === 'ARRIVE' || queryAction === 'LEAVE' || queryAction === 'RETURN') {
        params.action = queryAction
      }
      if (queryRegistration) params.registration_number = queryRegistration
      if (queryFrom) params.from = queryFrom
      if (queryTo) params.to = queryTo
      if (querySearch) params.search = querySearch

      try {
        const response = await getScanLogs(params)

        if (!active) return

        setRows(response.items)
        setSummary(response.summary)
        setTotal(response.total)
        setPage(response.page)
        setLastPage(response.lastPage)
      } catch (requestError) {
        if (!active) return

        const status = (requestError as { response?: { status?: number } })?.response?.status
        if (status === 403) {
          navigate('/unauthorized', { replace: true })
          return
        }

        const payload = asRecord((requestError as { response?: { data?: unknown } })?.response?.data)
        const errors = asRecord(payload.errors)
        setFromError(getFieldFirstError(errors.from))
        setToError(getFieldFirstError(errors.to))
        setError(getApiErrorMessage(requestError))
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadScanLogs()

    return () => {
      active = false
    }
  }, [
    navigate,
    queryAction,
    queryFrom,
    queryLimit,
    queryLocation,
    queryPage,
    queryRegistration,
    queryRole,
    querySearch,
    queryTo,
    queryTripId,
    queryTruckId,
    queryUserId,
  ])

  return (
    <div>
      <PageHeader
        title="Logs de scan"
        description="Traceabilite complete des scans par operateur, camion et trajet."
      />

      <section className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total logs" value={summary.total_logs} />
        <KpiCard label="Operateurs uniques" value={summary.unique_operators} />

        <Card>
          <h2 className="mb-2 text-sm font-semibold text-zinc-900">Distribution par action</h2>
          <ul className="space-y-1 text-sm text-zinc-700">
            {actionSummaryRows.length ? (
              actionSummaryRows.map((item) => (
                <li key={item.action} className="flex items-center justify-between">
                  <span>{toFriendlyTripAction(item.action)}</span>
                  <strong>{item.count}</strong>
                </li>
              ))
            ) : (
              <li>Aucune donnee</li>
            )}
          </ul>
        </Card>

        <Card>
          <h2 className="mb-2 text-sm font-semibold text-zinc-900">Distribution par localisation</h2>
          <ul className="space-y-1 text-sm text-zinc-700">
            {locationSummaryRows.length ? (
              locationSummaryRows.map((item) => (
                <li key={item.location} className="flex items-center justify-between">
                  <span>{formatLocationLabel(item.location)}</span>
                  <strong>{item.count}</strong>
                </li>
              ))
            ) : (
              <li>Aucune donnee</li>
            )}
          </ul>
        </Card>
      </section>

      <section className="mb-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Du</label>
            <Input
              type="date"
              value={queryFrom}
              onChange={(event) => updateParams({ from: event.target.value })}
            />
            {fromError ? <p className="mt-1 text-xs text-red-600">{fromError}</p> : null}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Au</label>
            <Input
              type="date"
              value={queryTo}
              onChange={(event) => updateParams({ to: event.target.value })}
            />
            {toError ? <p className="mt-1 text-xs text-red-600">{toError}</p> : null}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Action</label>
            <Select value={queryAction} onChange={(event) => updateParams({ action: event.target.value })}>
              {ACTION_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Localisation</label>
            <Select value={queryLocation} onChange={(event) => updateParams({ location: event.target.value })}>
              {LOCATION_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Role operateur</label>
            <Select value={queryRole} onChange={(event) => updateParams({ role: event.target.value })}>
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Operateur</label>
            <Select value={queryUserId} onChange={(event) => updateParams({ user_id: event.target.value })}>
              <option value="">Tous les operateurs</option>
              {operators.map((operator) => (
                <option key={operator.id} value={operator.id}>
                  {operator.name} ({operator.email})
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Immatriculation</label>
            <Input
              type="text"
              value={queryRegistration}
              placeholder="REG-100"
              onChange={(event) => updateParams({ registration_number: event.target.value })}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Recherche globale</label>
            <Input
              type="text"
              value={querySearch}
              placeholder="operateur, qr, driver, device..."
              onChange={(event) => updateParams({ search: event.target.value })}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Truck ID</label>
            <Input
              type="number"
              min={1}
              value={queryTruckId}
              onChange={(event) => updateParams({ truck_id: event.target.value })}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Trip ID</label>
            <Input
              type="number"
              min={1}
              value={queryTripId}
              onChange={(event) => updateParams({ trip_id: event.target.value })}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Par page</label>
            <Select
              value={String(queryLimit)}
              onChange={(event) => updateParams({ limit: event.target.value }, { resetPage: true })}
            >
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setSearchParams(new URLSearchParams({ limit: String(DEFAULT_LIMIT), page: '1' }))
              }}
            >
              Reinitialiser les filtres
            </Button>
          </div>
        </div>
      </section>

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      {loading ? <p className="mb-3 text-sm text-zinc-500">Chargement des logs...</p> : null}

      <DataTable
        data={rows}
        emptyText="Aucun log trouve"
        columns={[
          { key: 'scanned_at', header: 'Scanne le', render: (row) => formatDate(row.scanned_at) },
          {
            key: 'action_label',
            header: 'Action',
            render: (row) => toFriendlyTripStatus(row.action_label || row.action),
          },
          {
            key: 'location',
            header: 'Localisation',
            render: (row) => formatLocationLabel(row.location),
          },
          {
            key: 'operator_name',
            header: 'Operateur',
            render: (row) => row.operator?.name ?? '-',
          },
          {
            key: 'operator_role',
            header: 'Role',
            render: (row) => formatRoleLabel(row.operator?.role),
          },
          {
            key: 'registration_number',
            header: 'Camion',
            render: (row) => row.truck?.registration_number ?? '-',
          },
          {
            key: 'driver_name',
            header: 'Chauffeur',
            render: (row) => row.truck?.driver_name ?? '-',
          },
          {
            key: 'trip_id',
            header: 'Trip ID',
            render: (row) => (row.trip?.id ? `#${row.trip.id}` : '-'),
          },
          {
            key: 'trip_status',
            header: 'Trip statut',
            render: (row) => toFriendlyTripStatus(row.trip?.status),
          },
          {
            key: 'device_id',
            header: 'Device',
            render: (row) => row.device_id ?? '-',
          },
        ]}
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-zinc-600">Total: {total}</span>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            disabled={page <= 1}
            onClick={() => updateParams({ page: String(page - 1) }, { resetPage: false })}
          >
            Precedent
          </Button>
          <span className="text-sm text-zinc-600">
            Page {page} / {lastPage}
          </span>
          <Button
            variant="ghost"
            disabled={page >= lastPage}
            onClick={() => updateParams({ page: String(page + 1) }, { resetPage: false })}
          >
            Suivant
          </Button>
        </div>
      </div>
    </div>
  )
}
