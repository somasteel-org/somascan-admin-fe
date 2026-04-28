import { type FormEvent, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { login } from '../api/auth'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { useAuth } from '../hooks/useAuth'
import { sanitizeRedirectPath } from '../utils/routing'

export function LoginPage() {
  const { setAuth, isAuthenticated, hasHydrated, hydrate } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    if (hasHydrated && isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [hasHydrated, isAuthenticated, navigate])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await login({
        email,
        password,
        device_name: 'admin-web',
      })

      if (String(response.user.role).toUpperCase() !== 'ADMIN') {
        setError('Accès refusé')
        return
      }

      setAuth(response.token, response.user, response.expires_at)
      const from = (location.state as { from?: string } | null)?.from
      const target = sanitizeRedirectPath(from, '/dashboard')
      navigate(target, { replace: true })
    } catch (error) {
      const errorMessage =
        error instanceof Error && error.message === 'Réponse d’authentification invalide'
          ? 'Données invalides'
          : 'Accès refusé'

      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 p-4">
      <Card className="w-full max-w-md p-6">
        <div className="mb-4 flex justify-center">
          <img src="/SomaSteel_logo.png" alt="SomaSteel" className="h-14 w-auto object-contain" />
        </div>
        <h1 className="text-2xl font-semibold text-zinc-900">Connexion</h1>
        <p className="mt-1 text-sm text-zinc-500">Connectez-vous pour accéder à l’administration.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Email</label>
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Mot de passe</label>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Connexion en cours...' : 'Se connecter'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
