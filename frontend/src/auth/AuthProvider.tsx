import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authApi, setUnauthorizedHandler } from '@/lib/api'
import type { User } from '@/lib/types'
import { AuthContext, type AuthContextValue, type AuthStatus } from './auth-context'

/**
 * Session state. The JWT lives in an httpOnly cookie managed by the backend; the client only
 * keeps the current user in memory and restores it on load via GET /auth/session.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  const setSession = useCallback((next: User | null) => {
    setUser(next)
    setStatus(next ? 'authenticated' : 'anonymous')
  }, [])

  useEffect(() => {
    let cancelled = false
    authApi
      .session()
      .then(({ user: u }) => !cancelled && setSession(u))
      .catch(() => !cancelled && setSession(null))
    setUnauthorizedHandler(() => setSession(null))
    return () => {
      cancelled = true
      setUnauthorizedHandler(null)
    }
  }, [setSession])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      login: async (email, password) => setSession((await authApi.login(email, password)).user),
      register: async (name, email, password) =>
        setSession((await authApi.register(name, email, password)).user),
      logout: async () => {
        try {
          await authApi.logout()
        } finally {
          setSession(null)
        }
      },
    }),
    [user, status, setSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
