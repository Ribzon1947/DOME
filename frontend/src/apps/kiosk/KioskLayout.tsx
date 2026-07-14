import { Outlet } from 'react-router-dom'
import { useInactivityTimeout } from '../../hooks/useInactivityTimeout'

const INACTIVITY = Number(import.meta.env.VITE_KIOSK_INACTIVITY_SECONDS ?? 60)

export function KioskLayout() {
  useInactivityTimeout(INACTIVITY, '/kiosk')
  return (
    <div className="min-h-screen bg-kiosk-bg text-white">
      <Outlet />
    </div>
  )
}
