import { type FormEvent, useEffect, useState } from 'react'
import {
  createUser,
  deleteUser,
  getApiErrorMessage,
  getUsers,
  updateUser,
  searchUsers,
  getUserStats,
  getUserActivity,
  resetUserPassword,
} from '../api/users'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { DataTable } from '../components/common/DataTable'
import { Modal } from '../components/common/Modal'
import { PageHeader } from '../components/common/PageHeader'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import type { LocationType, Role, User, UserStats } from '../types'
import { KpiCard } from '../components/common/KpiCard'
import { toFriendlyLocation, toFriendlyRole } from '../utils/labels'

const PAGE_SIZE = 20

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [roleFilter, setRoleFilter] = useState<'ALL' | Role>('ALL')
  const [locationFilter, setLocationFilter] = useState<'ALL' | LocationType>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [stats, setStats] = useState<UserStats | null>(null)
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)

  const [activityModalOpen, setActivityModalOpen] = useState(false)
  const [selectedUserActivity, setSelectedUserActivity] = useState<{ scans: number; latest_scan: string | null } | null>(null)
  const [activityLoading, setActivityLoading] = useState(false)

  const [openModal, setOpenModal] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('COMPANY_OPERATOR')
  const [location, setLocation] = useState<LocationType | null>('COMPANY')
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')

  async function loadStats() {
    try {
      const s = await getUserStats()
      setStats(s)
    } catch {
      // ignore
    }
  }

  async function loadUsers(targetPage = page) {
    const roleParam = roleFilter === 'ALL' ? undefined : roleFilter
    const locParam = locationFilter === 'ALL' ? undefined : locationFilter

    if (searchQuery.trim()) {
      const items = await searchUsers(searchQuery.trim(), roleParam)
      setUsers(locParam ? items.filter(u => u.location === locParam) : items)
      setPage(1)
      setLastPage(1)
    } else {
      const response = await getUsers({
        limit: PAGE_SIZE,
        page: targetPage,
        role: roleParam,
        location: locParam,
      })

      setUsers(response.items)
      setPage(response.page)
      setLastPage(response.lastPage)
    }
  }

  useEffect(() => {
    let active = true

    async function initialize() {
      setError('')
      try {
        await loadStats()
        const roleParam = roleFilter === 'ALL' ? undefined : roleFilter
        const locParam = locationFilter === 'ALL' ? undefined : locationFilter

        if (searchQuery.trim()) {
          const items = await searchUsers(searchQuery.trim(), roleParam)
          if (active) {
            setUsers(locParam ? items.filter(u => u.location === locParam) : items)
            setLastPage(1)
          }
        } else {
          const response = await getUsers({
            limit: PAGE_SIZE,
            page,
            role: roleParam,
            location: locParam,
          })

          if (active) {
            setUsers(response.items)
            setLastPage(response.lastPage)
          }
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
  }, [page, roleFilter, locationFilter, searchQuery])

  function openCreateModal() {
    setEditing(null)
    setName('')
    setEmail('')
    setPassword('')
    setRole('COMPANY_OPERATOR')
    setLocation('COMPANY')
    setOpenModal(true)
  }

  function openEditModal(user: User) {
    setEditing(user)
    setName(user.name)
    setEmail(user.email)
    setPassword('')
    setRole(user.role)
    setLocation(user.location)
    setOpenModal(true)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const payloadLocation = location ?? null

    try {
      if (editing) {
        await updateUser(editing.id, {
          name,
          email,
          role,
          location: payloadLocation,
          password: password.trim() ? password : undefined,
        })
      } else {
        if (password.trim().length < 8) {
          setError('Le mot de passe doit contenir au moins 8 caractères')
          return
        }

        await createUser({
          name,
          email,
          role,
          location: payloadLocation,
          password,
        })
      }

      setOpenModal(false)
      setError('')
      await loadUsers(1)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Données invalides'))
    }
  }

  async function handleDelete() {
    if (!userToDelete) return

    setIsDeleting(true)
    try {
      await deleteUser(userToDelete.id)
      setError('')
      setUserToDelete(null)
      await loadUsers()
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleViewActivity(user: User) {
    setActivityModalOpen(true)
    setActivityLoading(true)
    setSelectedUserActivity(null)
    try {
      const activity = await getUserActivity(user.id)
      setSelectedUserActivity(activity)
    } catch (e) {
      setError(getApiErrorMessage(e))
    } finally {
      setActivityLoading(false)
    }
  }

  async function handleResetPassword(user: User) {
    const newPassword = prompt(`Entrez le nouveau mot de passe pour ${user.name} (min 8 caractères):`)
    if (!newPassword) return
    if (newPassword.length < 8) {
      alert("Le mot de passe doit contenir au moins 8 caractères.")
      return
    }
    try {
      await resetUserPassword(user.id, newPassword)
      alert("Mot de passe réinitialisé avec succès.")
    } catch (e) {
      setError(getApiErrorMessage(e))
    }
  }

  return (
    <div>
      <PageHeader
        title="Gestion des opérateurs"
        description="Création, mise à jour de rôle et filtrage des opérateurs."
        actions={<Button onClick={openCreateModal}>Créer opérateur</Button>}
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <KpiCard label="Utilisateurs enregistrés" value={stats?.total ?? '-'} />
        <KpiCard label="Entreprise / Port" value={stats ? `${stats.by_location?.COMPANY ?? 0} / ${stats.by_location?.PORT ?? 0}` : '-'} />
        <KpiCard label="Administrateurs" value={stats?.by_role?.ADMIN ?? '-'} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-full max-w-xs">
          <Input
            placeholder="Rechercher par nom ou email..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <div className="w-full max-w-xs">
          <Select
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(event.target.value as typeof roleFilter)
              setPage(1)
            }}
          >
            <option value="ALL">Tous les rôles</option>
            <option value="ADMIN">Administrateur</option>
            <option value="COMPANY_OPERATOR">Operateur entreprise</option>
            <option value="PORT_OPERATOR">Operateur port</option>
          </Select>
        </div>

        <div className="w-full max-w-xs">
          <Select
            value={locationFilter}
            onChange={(event) => {
              setLocationFilter(event.target.value as typeof locationFilter)
              setPage(1)
            }}
          >
            <option value="ALL">Toutes les localisations</option>
            <option value="COMPANY">Entreprise</option>
            <option value="PORT">Port</option>
          </Select>
        </div>
      </div>

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      <DataTable
        data={users}
        columns={[
          { key: 'nom', header: 'Nom', render: (user) => user.name },
          { key: 'email', header: 'Email', render: (user) => user.email },
          { key: 'role', header: 'Rôle', render: (user) => toFriendlyRole(user.role) },
          { key: 'localisation', header: 'Localisation', render: (user) => toFriendlyLocation(user.location) },
          {
            key: 'actions',
            header: 'Actions',
            render: (user) => (
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => handleViewActivity(user)}>
                  Activité
                </Button>
                <Button variant="secondary" onClick={() => openEditModal(user)}>
                  Modifier
                </Button>
                <Button variant="secondary" onClick={() => handleResetPassword(user)}>
                  Pass
                </Button>
                <Button variant="danger" onClick={() => setUserToDelete(user)}>
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

      <Modal open={openModal} title={editing ? 'Modifier opérateur' : 'Créer opérateur'} onClose={() => setOpenModal(false)}>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Nom</label>
            <Input value={name} onChange={(event) => setName(event.target.value)} required />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Email</label>
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Mot de passe {editing ? '(optionnel)' : '(requis)'}
            </label>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required={!editing}
              minLength={editing ? undefined : 8}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Rôle</label>
            <Select value={role} onChange={(event) => setRole(event.target.value as Role)}>
              <option value="ADMIN">Administrateur</option>
              <option value="COMPANY_OPERATOR">Operateur entreprise</option>
              <option value="PORT_OPERATOR">Operateur port</option>
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Localisation</label>
            <Select
              value={location ?? 'NONE'}
              onChange={(event) => {
                const value = event.target.value
                setLocation(value === 'NONE' ? null : (value as LocationType))
              }}
            >
              <option value="NONE">Non défini</option>
              <option value="COMPANY">Entreprise</option>
              <option value="PORT">Port</option>
            </Select>
          </div>

          <div className="flex justify-end">
            <Button type="submit">Enregistrer</Button>
          </div>
        </form>
      </Modal>

      <Modal open={activityModalOpen} title="Activité de l'utilisateur" onClose={() => setActivityModalOpen(false)}>
        <div className="space-y-4">
          {activityLoading ? (
            <p className="text-sm text-zinc-500">Chargement de l'activité...</p>
          ) : selectedUserActivity ? (
            <div className="space-y-2">
              <p className="text-sm text-zinc-700"><strong>Nombre total de scans:</strong> {selectedUserActivity.scans}</p>
              <p className="text-sm text-zinc-700"><strong>Dernier scan:</strong> {selectedUserActivity.latest_scan || 'Aucun scan'}</p>
            </div>
          ) : (
            <p className="text-sm text-red-600">Impossible de charger l'activité.</p>
          )}
          <div className="flex justify-end">
            <Button onClick={() => setActivityModalOpen(false)}>Fermer</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(userToDelete)}
        title="Confirmer la suppression"
        description={`Voulez-vous vraiment supprimer ${userToDelete?.name ?? 'cet operateur'} ? Cette action est irreversible.`}
        confirmLabel="Oui, supprimer"
        loading={isDeleting}
        onCancel={() => setUserToDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  )
}
