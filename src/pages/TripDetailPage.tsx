import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getTripById, getTripLogs } from '../api/trips'
import { DataTable } from '../components/common/DataTable'
import { PageHeader } from '../components/common/PageHeader'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import type { Trip, TripLog } from '../types'
import { formatDate, formatDuration, getDurationMinutes } from '../utils/format'
import { toFriendlyLocation, toFriendlyTripAction, toFriendlyTripStatus } from '../utils/labels'

export function TripDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [trip, setTrip] = useState<Trip | null>(null)
  const [logs, setLogs] = useState<TripLog[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadData() {
      if (!id) return

      setError('')
      try {
        const [tripData, logsData] = await Promise.all([getTripById(Number(id)), getTripLogs(Number(id))])
        setTrip(tripData)
        setLogs(logsData)
      } catch {
        setError('Une erreur est survenue')
      }
    }

    loadData()
  }, [id])

  const durations = useMemo(() => {
    if (!trip) return null

    return {
      companyToPort: getDurationMinutes(trip.started_at, trip.arrived_port_at),
      portDuration: getDurationMinutes(trip.arrived_port_at, trip.left_port_at),
      portToCompany: getDurationMinutes(trip.left_port_at, trip.completed_at),
    }
  }, [trip])

  if (!trip && !error) {
    return <p className="text-sm text-zinc-500">Chargement...</p>
  }

  return (
    <div>
      <PageHeader
        title={`Détail trajet #${trip?.id ?? id}`}
        description="Horodatage complet, durées calculées et logs de scan."
        actions={
          <Button variant="ghost" onClick={() => navigate('/trips')}>
            Retour aux trajets
          </Button>
        }
      />

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      {trip ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-zinc-900">Chronologie</h2>
            <ul className="space-y-2 text-sm text-zinc-700">
              <li>Camion: {trip.truck_registration_number ?? '-'}</li>
              <li>Chauffeur: {trip.truck_driver_name ?? '-'}</li>
              <li>Heure départ: {formatDate(trip.started_at)}</li>
              <li>Heure arrivée port: {formatDate(trip.arrived_port_at)}</li>
              <li>Heure sortie port: {formatDate(trip.left_port_at)}</li>
              <li>Heure retour: {formatDate(trip.completed_at)}</li>
              <li>Statut: {toFriendlyTripStatus(trip.status)}</li>
            </ul>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-zinc-900">Durées calculées</h2>
            <ul className="space-y-2 text-sm text-zinc-700">
              <li>Entreprise → Port: {formatDuration(durations?.companyToPort ?? null)}</li>
              <li>Temps au port: {formatDuration(durations?.portDuration ?? null)}</li>
              <li>Port → Entreprise: {formatDuration(durations?.portToCompany ?? null)}</li>
            </ul>
          </Card>
        </section>
      ) : null}

      <section className="mt-4">
        <h2 className="mb-2 text-sm font-semibold text-zinc-900">Logs de scan</h2>
        <DataTable
          data={logs}
          emptyText="Aucun log disponible"
          columns={[
            {
              key: 'timestamp',
              header: 'Horodatage',
              render: (log) => formatDate(log.timestamp),
            },
            { key: 'action', header: 'Action', render: (log) => toFriendlyTripAction(log.action) },
            { key: 'operateur', header: 'Opérateur', render: (log) => log.operator },
            { key: 'location', header: 'Localisation', render: (log) => toFriendlyLocation(log.location) },
          ]}
        />
      </section>
    </div>
  )
}
