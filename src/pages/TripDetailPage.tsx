import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getTripById, getTripLogs, getTripTimeline, cancelTrip, deleteTrip, updateTripNotes } from '../api/trips'
import { DataTable } from '../components/common/DataTable'
import { PageHeader } from '../components/common/PageHeader'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import type { Trip, TripLog, TripTimelineEvent } from '../types'
import { formatDate, formatDuration, getDurationMinutes } from '../utils/format'
import { toFriendlyLocation, toFriendlyTripAction, toFriendlyTripStatus } from '../utils/labels'

export function TripDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [trip, setTrip] = useState<Trip | null>(null)
  const [logs, setLogs] = useState<TripLog[]>([])
  const [timeline, setTimeline] = useState<TripTimelineEvent[]>([])
  const [notes, setNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [tripToDelete, setTripToDelete] = useState<Trip | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadData() {
      if (!id) return

      setError('')
      try {
        const [tripData, logsData, timelineData] = await Promise.all([
          getTripById(Number(id)), 
          getTripLogs(Number(id)),
          getTripTimeline(Number(id)).catch(() => []) // Timeline might not be implemented in backend completely, fail gracefully
        ])
        setTrip(tripData)
        setNotes(tripData.notes ?? '')
        setLogs(logsData)
        setTimeline(timelineData)
      } catch {
        setError('Une erreur est survenue')
      }
    }

    loadData()
  }, [id])

  async function handleSaveNotes() {
    if (!trip) return
    setNotesSaving(true)
    try {
      await updateTripNotes(trip.id, notes)
      alert('Notes enregistrées.')
    } catch {
      setError('Erreur lors de la sauvegarde des notes.')
    } finally {
      setNotesSaving(false)
    }
  }

  async function handleCancelTrip() {
    if (!trip) return
    if (!confirm('Voulez-vous vraiment annuler ce trajet ?')) return
    setIsCancelling(true)
    try {
      await cancelTrip(trip.id)
      const tripData = await getTripById(trip.id)
      setTrip(tripData)
    } catch {
      setError('Erreur lors de l\'annulation du trajet.')
    } finally {
      setIsCancelling(false)
    }
  }

  async function handleDeleteTrip() {
    if (!tripToDelete) return
    setIsDeleting(true)
    try {
      await deleteTrip(tripToDelete.id)
      navigate('/trips')
    } catch {
      setError('Erreur lors de la suppression du trajet.')
    } finally {
      setIsDeleting(false)
      setTripToDelete(null)
    }
  }

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
          <div className="flex items-center gap-2">
            {trip && trip.status !== 'COMPLETED' && trip.status !== 'CANCELLED' && (
              <Button variant="ghost" onClick={handleCancelTrip} disabled={isCancelling}>
                {isCancelling ? 'Annulation...' : 'Annuler le trajet'}
              </Button>
            )}
            {trip && (
              <Button variant="danger" onClick={() => setTripToDelete(trip)}>
                Supprimer
              </Button>
            )}
            <Button variant="ghost" onClick={() => navigate('/trips')}>
              Retour aux trajets
            </Button>
          </div>
        }
      />

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      {trip?.status === 'CANCELLED' && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 text-red-800">
            <span className="font-bold">⚠️ Trajet Annulé</span>
            {trip.cancelled_at && <span>le {formatDate(trip.cancelled_at)}</span>}
          </div>
          {trip.notes && <p className="mt-2 text-sm text-red-700">Raison / Notes: {trip.notes}</p>}
        </div>
      )}

      {trip?.is_delayed && trip.status !== 'CANCELLED' && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-amber-800">
            <span className="font-bold">⚠️ Trajet en retard</span>
            <span>Ce trajet a dépassé la durée prévue.</span>
          </div>
        </div>
      )}

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
              {trip.cancelled_at && <li className="font-medium text-red-600">Heure annulation: {formatDate(trip.cancelled_at)}</li>}
              <li>Statut: {toFriendlyTripStatus(trip.status)}</li>
            </ul>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-zinc-900">Durées calculées</h2>
            <ul className="space-y-2 text-sm text-zinc-700">
              <li>Entreprise → Port: {formatDuration(durations?.companyToPort ?? null)}</li>
              <li>Temps au port: {formatDuration(durations?.portDuration ?? null)}</li>
              <li>Port → Entreprise: {formatDuration(durations?.portToCompany ?? null)}</li>
              <li>Temps total: {formatDuration(trip.total_duration_minutes ?? null)}</li>
            </ul>
          </Card>
          
          <Card className="lg:col-span-2">
            <h2 className="mb-3 text-sm font-semibold text-zinc-900">Notes</h2>
            <div className="flex gap-2">
              <Input 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
                placeholder="Ajouter des notes..." 
                className="flex-1"
              />
              <Button onClick={handleSaveNotes} disabled={notesSaving}>
                {notesSaving ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </div>
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

      {timeline && timeline.length > 0 && (
        <section className="mt-4">
          <h2 className="mb-2 text-sm font-semibold text-zinc-900">Timeline (V2)</h2>
          <DataTable
            data={timeline}
            emptyText="Aucune timeline"
            columns={[
              { key: 'action', header: 'Action', render: (e) => e.action },
              { key: 'scanned_at', header: 'Horodatage', render: (e) => formatDate(e.scanned_at) },
              { key: 'details', header: 'Détails', render: (e) => `${e.location ?? '-'} (par ${e.user_name ?? 'inconnu'})` },
            ]}
          />
        </section>
      )}

      <ConfirmDialog
        open={Boolean(tripToDelete)}
        title="Confirmer la suppression"
        description={`Voulez-vous vraiment supprimer le trajet #${tripToDelete?.id ?? ''} ? Cette action est irreversible.`}
        confirmLabel="Oui, supprimer"
        loading={isDeleting}
        onCancel={() => setTripToDelete(null)}
        onConfirm={handleDeleteTrip}
      />
    </div>
  )
}
