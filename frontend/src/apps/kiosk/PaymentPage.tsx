import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { paymentsApi, getErrorMessage } from '../../lib/api'
import type { PaymentInitiateResponse } from '../../lib/types'
import { usePaymentPoll } from '../../hooks/usePaymentPoll'
import { Button } from '../../components/Button'

export function PaymentPage() {
  const navigate = useNavigate()
  const bookingId = Number(sessionStorage.getItem('kiosk_booking_id'))
  const [payment, setPayment] = useState<PaymentInitiateResponse | null>(null)
  const [error, setError] = useState('')
  const initiated = useRef(false)
  const { isPaid } = usePaymentPoll(payment?.payment_id ?? null)

  useEffect(() => {
    if (!bookingId) {
      navigate('/kiosk')
      return
    }
    if (initiated.current) return
    initiated.current = true

    paymentsApi
      .initiate(bookingId)
      .then(({ data }) => setPayment(data))
      .catch((err) => {
        initiated.current = false
        setError(getErrorMessage(err))
      })
  }, [bookingId, navigate])

  useEffect(() => {
    if (isPaid) {
      sessionStorage.removeItem('kiosk_ocr')
      navigate('/kiosk/floormap')
    }
  }, [isPaid, navigate])

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <p className="text-red-400">{error}</p>
        <Button variant="kiosk" onClick={() => navigate('/kiosk')}>
          Return Home
        </Button>
      </div>
    )
  }

  if (!payment) {
    return <div className="flex min-h-screen items-center justify-center text-kiosk-lg">Loading payment…</div>
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-kiosk-xl font-bold">Scan to Pay</h1>
      <p className="text-kiosk-lg text-sky-300">₹{payment.amount}</p>
      <p className="text-sm text-slate-400">Pay to: {payment.upi_id}</p>
      <div className="rounded-2xl bg-white p-4">
        <img src={`data:image/png;base64,${payment.qr_base64}`} alt="UPI QR Code" className="h-64 w-64" />
      </div>
      <p className="max-w-md text-center text-slate-400">
        Payment pending — complete UPI payment on your phone. Ask reception to confirm once paid.
        This screen will advance automatically when payment is confirmed.
      </p>
      <Button variant="secondary" onClick={() => navigate('/kiosk')}>
        Cancel
      </Button>
    </div>
  )
}
