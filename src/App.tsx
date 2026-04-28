import { useEffect } from 'react'
import { AppRouter } from './routes/AppRouter'
import { useAuth } from './hooks/useAuth'

function App() {
  const { hydrate } = useAuth()

  useEffect(() => {
    hydrate()
  }, [hydrate])

  return <AppRouter />
}

export default App
