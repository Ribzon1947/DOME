import { Link } from 'react-router-dom'
import { Button } from '../../components/Button'

export function KioskHome() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-kiosk-xl font-bold text-sky-300">Welcome</h1>
      <p className="max-w-lg text-center text-kiosk text-slate-300">
        Self-service check-in. Touch an option below to get started.
      </p>
      <div className="flex w-full max-w-md flex-col gap-4">
        <Link to="/kiosk/check-in">
          <Button variant="kiosk" size="kiosk" className="w-full">
            Start Check-In
          </Button>
        </Link>
        <Link to="/kiosk/pay">
          <Button variant="kiosk" size="kiosk" className="w-full bg-emerald-600 hover:bg-emerald-500">
            Pay Balance
          </Button>
        </Link>
      </div>
      <Link to="/login" className="mt-8 text-sm text-slate-500 hover:text-slate-300">
        Staff login
      </Link>
    </div>
  )
}
