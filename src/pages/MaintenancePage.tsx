import { useEffect, useState } from 'react'
import { getMaintenanceRecords, createMaintenanceRecord, deleteMaintenanceRecord } from '../api/maintenance'
import { getTrucks } from '../api/trucks'
import { DataTable } from '../components/common/DataTable'
import { PageHeader } from '../components/common/PageHeader'
import { Modal } from '../components/common/Modal'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import type { MaintenanceRecord, Truck } from '../types'
import { formatDate } from '../utils/format'
import { getApiErrorMessage } from '../api/http'

export function MaintenancePage() {
  const [records, setRecords] = useState<MaintenanceRecord[]>([])
  const [trucks, setTrucks] = useState<Truck[]>([])
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [error, setError] = useState('')
  const [truckFilter, setTruckFilter] = useState<number | 'ALL'>('ALL')
  
  const [openModal, setOpenModal] = useState(false)
  const [truckId, setTruckId] = useState<number | ''>('')
  const [type, setType] = useState('')
  const [description, setDescription] = useState('')
  const [cost, setCost] = useState('')
  const [date, setDate] = useState('')
  
  const [recordToDelete, setRecordToDelete] = useState<MaintenanceRecord | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  async function loadRecords(targetPage = page) {
    try {
      const response = await getMaintenanceRecords({
        limit: 20,
        page: targetPage,
        truck_id: truckFilter === 'ALL' ? undefined : truckFilter
      })
      setRecords(response.items)
      setPage(response.page)
      setLastPage(response.lastPage)
    } catch (e) {
      setError(getApiErrorMessage(e))
    }
  }

  useEffect(() => {
    let active = true
    async function init() {
      try {
        const trucksData = await getTrucks({ limit: 100 })
        if (active) setTrucks(trucksData.items)
      } catch {
        // ignore
      }
    }
    init()
    return () => { active = false }
  }, [])

  useEffect(() => {
    void loadRecords()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, truckFilter])

  function openCreateModal() {
    setTruckId('')
    setType('')
    setDescription('')
    setCost('')
    setDate('')
    setOpenModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!truckId) return
    try {
      await createMaintenanceRecord({
        truck_id: Number(truckId),
        type,
        description,
        cost: Number(cost),
        date
      })
      setOpenModal(false)
      loadRecords(1)
    } catch (err) {
      setError(getApiErrorMessage(err))
    }
  }

  async function handleDelete() {
    if (!recordToDelete) return
    setIsDeleting(true)
    try {
      await deleteMaintenanceRecord(recordToDelete.id)
      setRecordToDelete(null)
      loadRecords()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Maintenance"
        description="Gestion des entretiens et réparations des camions."
        actions={<Button onClick={openCreateModal}>Ajouter</Button>}
      />

      <div className="mb-4 max-w-xs">
        <Select
          value={truckFilter}
          onChange={(event) => {
            const val = event.target.value
            setTruckFilter(val === 'ALL' ? 'ALL' : Number(val))
            setPage(1)
          }}
        >
          <option value="ALL">Tous les camions</option>
          {trucks.map(t => (
            <option key={t.id} value={t.id}>{t.registration_number}</option>
          ))}
        </Select>
      </div>

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      <DataTable
        data={records}
        emptyText="Aucun enregistrement"
        columns={[
          { key: 'id', header: 'ID', render: r => `#${r.id}` },
          { key: 'truck', header: 'Camion', render: r => r.truck?.registration_number ?? '-' },
          { key: 'type', header: 'Type', render: r => r.type },
          { key: 'desc', header: 'Description', render: r => r.description },
          { key: 'cost', header: 'Coût', render: r => r.cost },
          { key: 'date', header: 'Date', render: r => formatDate(r.date) },
          {
            key: 'actions',
            header: 'Actions',
            render: r => (
              <Button variant="danger" onClick={() => setRecordToDelete(r)}>Supprimer</Button>
            )
          }
        ]}
      />

      <div className="mt-4 flex items-center justify-end gap-2">
        <Button variant="ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Précédent</Button>
        <span className="text-sm text-zinc-600">Page {page} / {lastPage}</span>
        <Button variant="ghost" disabled={page >= lastPage} onClick={() => setPage(p => p + 1)}>Suivant</Button>
      </div>

      <Modal open={openModal} title="Ajouter une maintenance" onClose={() => setOpenModal(false)}>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block mb-1 text-sm font-medium">Camion</label>
            <Select value={truckId} onChange={e => setTruckId(Number(e.target.value))} required>
              <option value="">Sélectionner...</option>
              {trucks.map(t => <option key={t.id} value={t.id}>{t.registration_number}</option>)}
            </Select>
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium">Type</label>
            <Input value={type} onChange={e => setType(e.target.value)} required placeholder="Ex: Révision" />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium">Description</label>
            <Input value={description} onChange={e => setDescription(e.target.value)} required />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium">Coût</label>
            <Input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value)} required />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium">Date</label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
          </div>
          <div className="flex justify-end">
            <Button type="submit">Enregistrer</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(recordToDelete)}
        title="Supprimer"
        description="Confirmer la suppression ?"
        confirmLabel="Oui"
        loading={isDeleting}
        onCancel={() => setRecordToDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  )
}
