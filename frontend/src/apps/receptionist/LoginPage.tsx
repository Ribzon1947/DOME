import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api, { authApi, getErrorMessage } from '../../lib/api'
import { Button } from '../../components/Button'
import { requestNotificationPermission } from '../../lib/firebase'

async function registerFcmToken(): Promise<void> {
  const token = await requestNotificationPermission()
  if (!token) return
  try {
    await api.post('/notifications/register', {
      token,
      device_label: navigator.userAgent,
    })
    localStorage.setItem('fcm_token', token)
  } catch {
    // Non-fatal: failed FCM registration should never block the user
  }
}

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data } = await authApi.login(email, password)
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      // Fire-and-forget: register push token after auth, don't block navigation
      registerFcmToken()
      const me = await authApi.me()
      if (!mountedRef.current) return
      navigate(me.data.role === 'admin' ? '/admin' : '/dashboard')
    } catch (err) {
      if (!mountedRef.current) return
      setError(getErrorMessage(err))
      setPassword('')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg"
        noValidate
      >
        <h1 className="mb-1 text-2xl font-bold text-slate-800">Staff Login</h1>
        <p className="mb-6 text-sm text-slate-500">Sign in to access the dashboard</p>

        {error && (
          <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <label className="mb-4 block">
          <span className="text-sm font-medium text-slate-600">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError('')
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
            autoComplete="username"
            placeholder="staff@hotel.com"
            required
            disabled={loading}
          />
        </label>

        <label className="mb-6 block">
          <span className="text-sm font-medium text-slate-600">Password</span>
          <div className="relative mt-1">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError('')
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-20 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
              autoComplete="current-password"
              placeholder="••••••••"
              required
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </label>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </Button>

        <p className="mt-4 text-center text-sm text-slate-500">
          <Link to="/kiosk" className="text-sky-600 hover:underline">
            Go to Kiosk
          </Link>
        </p>
      </form>
    </div>
  )
}
