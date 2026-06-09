import { LayoutDashboard, LogOut, Truck, Users, Route, ChartColumn, ScrollText, ListOrdered, Wrench } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { logout as logoutRequest } from '../api/auth'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'

const menuItems = [
  { to: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { to: '/trucks', label: 'Camions', icon: Truck },
  { to: '/users', label: 'Opérateurs', icon: Users },
  { to: '/trips', label: 'Trajets', icon: Route },
  { to: '/maintenance', label: 'Maintenance', icon: Wrench },
  { to: '/reports', label: 'Rapports', icon: ChartColumn },
  { to: '/scan-logs', label: 'Logs', icon: ScrollText },
  { to: '/scan-flow', label: 'Flux de scan', icon: ListOrdered },
]

export function AdminLayout() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  async function handleLogout() {
    await logoutRequest().catch(() => null)

    logout()
    navigate('/login')
  }

  if (isMobile) {
    return (
      <div className="min-h-screen bg-zinc-100 text-zinc-900">
        <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white px-4 py-3">
          <div className="mx-auto flex max-w-4xl items-center justify-between">
            <img src="/SomaSteel_logo.png" alt="SomaSteel" className="h-9 w-auto object-contain" />
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700"
            >
              <LogOut size={14} />
              Deconnexion
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-4 py-4 pb-24">
          <Outlet />
        </main>

        <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-zinc-200 bg-white/95 backdrop-blur">
          <div
            className="mx-auto grid max-w-4xl"
            style={{ gridTemplateColumns: `repeat(${menuItems.length}, minmax(0, 1fr))` }}
          >
            {menuItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1 px-1 py-2 text-[11px] font-medium ${
                      isActive ? 'text-zinc-900' : 'text-zinc-500'
                    }`
                  }
                >
                  <Icon size={16} />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              )
            })}
          </div>
        </nav>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      <div className="grid min-h-screen w-full grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="sticky top-0 flex h-screen flex-col overflow-y-auto border-r border-zinc-200 bg-white p-4">
          <div className="mb-4 flex justify-center rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <img src="/SomaSteel_logo.png" alt="SomaSteel" className="h-12 w-auto object-contain" />
          </div>

          {/* <div className="mb-6 rounded-xl bg-[#F2B84133] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-700">Admin Camions</p>
            <p className="mt-1 text-sm text-zinc-600">{user?.name ?? 'Administrateur'}</p>
          </div> */}

          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      isActive ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-100'
                    }`
                  }
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </nav>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            <LogOut size={16} />
            Déconnexion
          </button>
        </aside>

        <main className="min-w-0 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
