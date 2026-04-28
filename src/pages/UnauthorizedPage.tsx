import { Link } from 'react-router-dom'

export function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 p-6 text-center">
      <div className="max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Acces non autorise</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Votre compte est connecte mais ne possede pas les droits administrateur requis.
        </p>
        <Link
          to="/login"
          className="mt-4 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
        >
          Retour a la connexion
        </Link>
      </div>
    </div>
  )
}
