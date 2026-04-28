import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 p-6 text-center">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900">Page introuvable</h1>
        <p className="mt-2 text-zinc-500">La page demandée n’existe pas.</p>
        <Link to="/dashboard" className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-zinc-900">
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  )
}
