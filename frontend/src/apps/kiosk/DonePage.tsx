import { Link } from 'react-router-dom'
import { Button } from '../../components/Button'

export function DonePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="text-6xl text-emerald-400">✓</div>
      <h1 className="text-kiosk-xl font-bold">All Done!</h1>
      <p className="max-w-md text-slate-400">
        Your payment has been confirmed. Please collect your room key from reception.
      </p>
      <Link to="/kiosk">
        <Button variant="kiosk" size="kiosk">
          Return Home
        </Button>
      </Link>
    </div>
  )
}
