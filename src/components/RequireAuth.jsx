import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return null
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}

export function RootRedirect() {
  const { user, loading } = useAuth()

  if (loading) return null
  return <Navigate to={user ? '/cotacao' : '/login'} replace />
}
