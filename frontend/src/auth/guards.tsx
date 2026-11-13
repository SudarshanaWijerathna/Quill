import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from './auth-context'

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Loading">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}

/** Renders child routes only for signed-in users; otherwise redirects to /login. */
export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <FullPageSpinner />
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}

/** Login/register pages: send already signed-in users to the workspace. */
export function RedirectIfAuthenticated() {
  const { status } = useAuth()
  if (status === 'loading') return <FullPageSpinner />
  if (status === 'authenticated') return <Navigate to="/" replace />
  return <Outlet />
}
