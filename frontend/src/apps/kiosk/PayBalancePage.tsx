import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { bookingsApi, getErrorMessage } from '../../lib/api'
import { Button } from '../../components/Button'

export function PayBalancePage() {
  const navigate = useNavigate()
  const [bookingId, setBookingId] = useState('')
  const [error, setError] = useState('')

  const handleLookup = async () => {
    setError('')
    try {
      const { data } = await bookingsApi.getPublic(Number(bookingId))
      if (data.payment?.status === 'paid') {
        setError('This booking is already paid')
        return
      }
      sessionStorage.setItem('kiosk_booking_id', String(data.id))
      navigate('/kiosk/payment')
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-kiosk-xl font-bold">Pay Balance</h1>
      <p className="text-slate-400">Enter your booking number from reception</p>
      <input
        type="number"
        value={bookingId}
        onChange={(e) => setBookingId(e.target.value)}
        placeholder="Booking #"
        className="w-full rounded-xl border-2 border-slate-600 bg-slate-800 px-4 py-4 text-kiosk-lg text-center"
      />
      {error && <p className="text-red-400">{error}</p>}
      <Button variant="kiosk" size="kiosk" className="w-full" onClick={handleLookup}>
        Continue
      </Button>
      <Button variant="secondary" onClick={() => navigate('/kiosk')}>
        Back
      </Button>
    </div>
  )
}
