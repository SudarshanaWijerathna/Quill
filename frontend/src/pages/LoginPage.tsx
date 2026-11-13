import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/auth/auth-context'
import { AuthLayout } from '@/components/AuthLayout'
import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Matches backend/app/seed.py. Only shown in development or when explicitly enabled.
const DEMO_PASSWORD = 'quill-demo-123'
const DEMO_ACCOUNTS = ['alice@example.com', 'bob@example.com']
const showDemo = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_ACCOUNTS === 'true'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      setError((err as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue to your documents."
      footer={
        <>
          New to Quill?{' '}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <FormError message={error} />
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="h-10"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-10"
          />
        </div>
        <Button type="submit" className="h-10 w-full" disabled={submitting}>
          {submitting && <Loader2 className="animate-spin" />}
          Sign in
        </Button>
      </form>

      {showDemo && (
        <div className="mt-6 rounded-lg bg-muted px-4 py-3 text-sm">
          <p className="font-medium">Demo accounts</p>
          <p className="mt-0.5 text-muted-foreground">
            Password <code className="font-mono text-foreground">{DEMO_PASSWORD}</code>
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <Button
                key={account}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEmail(account)
                  setPassword(DEMO_PASSWORD)
                }}
              >
                {account}
              </Button>
            ))}
          </div>
        </div>
      )}
    </AuthLayout>
  )
}
