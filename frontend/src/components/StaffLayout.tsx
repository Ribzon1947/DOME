import { Navigate, Outlet } from 'react-router-dom'
import api from '../lib/api'

async function logout() {
  const fcmToken = localStorage.getItem('fcm_token')
  if (fcmToken) {
    try {
      await api.delete(`/notifications/register?token=${encodeURIComponent(fcmToken)}`)
    } catch {
      // Non-fatal
    }
  }
  localStorage.clear()
  window.location.href = '/login'
}

export function StaffLayout() {
  const token = localStorage.getItem('access_token')
  if (!token) return <Navigate to="/login" replace />
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 bg-slate-800 p-4 text-white">
        <h1 className="mb-6 text-lg font-bold">Room Manager</h1>
        <nav className="flex flex-col gap-2">
          <a href="/dashboard" className="rounded-lg px-3 py-2 hover:bg-slate-700">
            Dashboard
          </a>
          <a href="/admin" className="rounded-lg px-3 py-2 hover:bg-slate-700">
            Admin
          </a>
          <a href="/kiosk" className="rounded-lg px-3 py-2 hover:bg-slate-700">
            Kiosk Mode
          </a>
          <button
            type="button"
            className="mt-4 rounded-lg px-3 py-2 text-left text-red-300 hover:bg-slate-700"
            onClick={logout}
          >
            Logout
          </button>
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
