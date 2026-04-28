import { type FormEvent, useEffect, useState } from 'react'
import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import {
  activateTruck,
  createTruck,
  deactivateTruck,
  deleteTruck,
  generateTruckQr,
  getApiErrorMessage,
  getTrucks,
  updateTruck,
} from '../api/trucks'
import { asRecord } from '../api/http'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { DataTable } from '../components/common/DataTable'
import { Modal } from '../components/common/Modal'
import { PageHeader } from '../components/common/PageHeader'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import type { Truck } from '../types'

const PAGE_SIZE = 20

export function TrucksPage() {
  const [trucks, setTrucks] = useState<Truck[]>([])
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [openModal, setOpenModal] = useState(false)
  const [editing, setEditing] = useState<Truck | null>(null)
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [driverName, setDriverName] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [qrPreviewOpen, setQrPreviewOpen] = useState(false)
  const [qrGenerating, setQrGenerating] = useState(false)
  const [qrCodeValue, setQrCodeValue] = useState('')
  const [qrImageDataUrl, setQrImageDataUrl] = useState('')
  const [qrTruckRegistration, setQrTruckRegistration] = useState('')
  const [registrationError, setRegistrationError] = useState('')
  const [driverNameError, setDriverNameError] = useState('')
  const [truckToDelete, setTruckToDelete] = useState<Truck | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')

  async function loadTrucks(targetPage = page) {
    const isActiveFilter =
      statusFilter === 'ALL'
        ? undefined
        : statusFilter === 'ACTIVE'
          ? true
          : false

    const response = await getTrucks({
      limit: PAGE_SIZE,
      page: targetPage,
      is_active: isActiveFilter,
    })

    setTrucks(response.items)
    setPage(response.page)
    setLastPage(response.lastPage)
  }

  useEffect(() => {
    let active = true

    async function initialize() {
      setError('')
      try {
        const isActiveFilter =
          statusFilter === 'ALL'
            ? undefined
            : statusFilter === 'ACTIVE'
              ? true
              : false

        const response = await getTrucks({
          limit: PAGE_SIZE,
          page,
          is_active: isActiveFilter,
        })

        if (active) {
          setTrucks(response.items)
          setLastPage(response.lastPage)
        }
      } catch (requestError) {
        if (active) {
          setError(getApiErrorMessage(requestError))
        }
      }
    }

    void initialize()

    return () => {
      active = false
    }
  }, [page, statusFilter])

  function openCreateModal() {
    setEditing(null)
    setRegistrationNumber('')
    setDriverName('')
    setIsActive(true)
    setRegistrationError('')
    setDriverNameError('')
    setOpenModal(true)
  }

  function openEditModal(truck: Truck) {
    setEditing(truck)
    setRegistrationNumber(truck.registration_number)
    setDriverName(truck.driver_name ?? '')
    setIsActive(truck.is_active)
    setRegistrationError('')
    setDriverNameError('')
    setOpenModal(true)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const cleanedRegistrationNumber = registrationNumber.trim()
    const cleanedDriverName = driverName.trim()
    if (!cleanedRegistrationNumber) {
      setError('Données invalides')
      return
    }
    if (!cleanedDriverName) {
      setError('Le nom du chauffeur est requis')
      setDriverNameError('Le nom du chauffeur est requis')
      return
    }

    setRegistrationError('')
    setDriverNameError('')

    try {
      const payload = {
        registration_number: cleanedRegistrationNumber,
        driver_name: cleanedDriverName,
        is_active: isActive,
      }

      if (editing) {
        await updateTruck(editing.id, payload)
      } else {
        await createTruck(payload)
      }

      setOpenModal(false)
      setError('')
      await loadTrucks(1)
    } catch (requestError) {
      const payload = asRecord((requestError as { response?: { data?: unknown } })?.response?.data)
      const errors = asRecord(payload.errors)
      const registrationField = errors.registration_number
      const driverField = errors.driver_name

      if (Array.isArray(registrationField) && typeof registrationField[0] === 'string') {
        setRegistrationError(registrationField[0])
      }

      if (Array.isArray(driverField) && typeof driverField[0] === 'string') {
        setDriverNameError(driverField[0])
      }

      setError(getApiErrorMessage(requestError, 'Données invalides'))
    }
  }

  async function handleToggleActivation(truck: Truck) {
    try {
      if (truck.is_active) {
        await deactivateTruck(truck.id)
      } else {
        await activateTruck(truck.id)
      }
      setError('')
      await loadTrucks()
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    }
  }

  async function handleDelete() {
    if (!truckToDelete) return

    setIsDeleting(true)
    try {
      await deleteTruck(truckToDelete.id)
      setError('')
      setTruckToDelete(null)
      await loadTrucks()
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleGenerateQr(id: number) {
    setQrGenerating(true)
    try {
      const data = await generateTruckQr(id)
      const truck = trucks.find((item) => item.id === id)
      const qrValue = data.qr_code

      if (!qrValue) {
        setError('QR code introuvable')
        return
      }

      const qrDataUrl = await QRCode.toDataURL(qrValue, {
        width: 320,
        margin: 1,
      })

      setQrCodeValue(qrValue)
      setQrImageDataUrl(qrDataUrl)
      setQrTruckRegistration(truck?.registration_number ?? `#${id}`)
      setQrPreviewOpen(true)
      setError('')
      await loadTrucks(page)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setQrGenerating(false)
    }
  }

  async function handleViewQr(truck: Truck) {
    const qrValue = truck.qr_code?.trim()

    if (!qrValue) {
      setError('Ce camion ne possède pas encore de QR code. Utilisez Générer QR.')
      return
    }

    try {
      const qrDataUrl = await QRCode.toDataURL(qrValue, {
        width: 320,
        margin: 1,
      })

      setQrCodeValue(qrValue)
      setQrImageDataUrl(qrDataUrl)
      setQrTruckRegistration(truck.registration_number)
      setQrPreviewOpen(true)
      setError('')
    } catch {
      setError('Impossible d’afficher le QR code')
    }
  }

  function handleDownloadQrPdf() {
    if (!qrImageDataUrl) return

    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const qrSize = pageWidth * 0.9
    const qrX = (pageWidth - qrSize) / 2
    const qrY = 12

    doc.addImage(qrImageDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)

    doc.setFontSize(11)
    const footerText = `Immatriculation: ${qrTruckRegistration} | Valeur QR: ${qrCodeValue}`
    doc.text(footerText, pageWidth / 2, pageHeight - 14, { align: 'center' })

    doc.save(`qr-camion-${qrTruckRegistration}.pdf`)
  }

  return (
    <div>
      <PageHeader
        title="Gestion des camions"
        description="Liste, activation et gestion des QR codes des camions."
        actions={<Button onClick={openCreateModal}>Ajouter un camion</Button>}
      />

      <div className="mb-4 max-w-xs">
        <Select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value as typeof statusFilter)
            setPage(1)
          }}
        >
          <option value="ALL">Tous les statuts</option>
          <option value="ACTIVE">Actif</option>
          <option value="INACTIVE">Inactif</option>
        </Select>
      </div>

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      <DataTable
        data={trucks}
        columns={[
          {
            key: 'immatriculation',
            header: 'Numéro d’immatriculation',
            render: (truck) => truck.registration_number,
          },
          {
            key: 'chauffeur',
            header: 'Nom du chauffeur',
            render: (truck) => truck.driver_name ?? '-',
          },
          {
            key: 'qr',
            header: 'QR Code',
            render: (truck) => truck.qr_code ?? '-',
          },
          {
            key: 'statut',
            header: 'Statut',
            render: (truck) => (
              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${truck.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-200 text-zinc-700'}`}>
                {truck.is_active ? 'Actif' : 'Inactif'}
              </span>
            ),
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (truck) => (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => openEditModal(truck)}>
                  Modifier
                </Button>
                <Button variant="ghost" onClick={() => handleToggleActivation(truck)}>
                  {truck.is_active ? 'Désactiver' : 'Activer'}
                </Button>
                <Button variant="ghost" onClick={() => handleViewQr(truck)}>
                  Voir QR
                </Button>
                {!truck.qr_code ? (
                  <Button variant="ghost" onClick={() => handleGenerateQr(truck.id)} disabled={qrGenerating}>
                    {qrGenerating ? 'Génération...' : 'Générer QR'}
                  </Button>
                ) : null}
                <Button variant="danger" onClick={() => setTruckToDelete(truck)}>
                  Supprimer
                </Button>
              </div>
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

      <Modal open={openModal} title={editing ? 'Modifier le camion' : 'Ajouter un camion'} onClose={() => setOpenModal(false)}>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Numéro d’immatriculation</label>
            <Input
              value={registrationNumber}
              onChange={(event) => {
                setRegistrationNumber(event.target.value)
                setRegistrationError('')
              }}
              required
            />
            {registrationError ? <p className="mt-1 text-xs text-red-600">{registrationError}</p> : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Nom du chauffeur</label>
            <Input
              value={driverName}
              onChange={(event) => {
                setDriverName(event.target.value)
                setDriverNameError('')
              }}
              required
            />
            {driverNameError ? <p className="mt-1 text-xs text-red-600">{driverNameError}</p> : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Statut</label>
            <Select value={isActive ? 'ACTIVE' : 'INACTIVE'} onChange={(event) => setIsActive(event.target.value === 'ACTIVE')}>
              <option value="ACTIVE">Actif</option>
              <option value="INACTIVE">Inactif</option>
            </Select>
          </div>

          <div className="flex justify-end">
            <Button type="submit">Enregistrer</Button>
          </div>
        </form>
      </Modal>

      <Modal open={qrPreviewOpen} title="QR code du camion" onClose={() => setQrPreviewOpen(false)}>
        <div className="space-y-4">
          <p className="text-sm text-zinc-700">Immatriculation: {qrTruckRegistration}</p>

          {qrImageDataUrl ? (
            <div className="flex justify-center rounded-lg border border-zinc-200 p-3">
              <img src={qrImageDataUrl} alt="QR code camion" className="h-56 w-56" />
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button onClick={handleDownloadQrPdf}>Télécharger PDF</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(truckToDelete)}
        title="Confirmer la suppression"
        description={`Voulez-vous vraiment supprimer le camion ${truckToDelete?.registration_number ?? ''} ? Cette action est irreversible.`}
        confirmLabel="Oui, supprimer"
        loading={isDeleting}
        onCancel={() => setTruckToDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  )
}
