import { useEffect, useState } from 'react'
import { paymentsApi } from '../lib/api'
import type { PaymentStatus } from '../lib/types'

export function usePaymentPoll(paymentId: number | null, intervalMs = 3000) {
  const [status, setStatus] = useState<PaymentStatus>('pending')
  const [paidAt, setPaidAt] = useState<string | null>(null)

  useEffect(() => {
    if (!paymentId) return
    let active = true
    const poll = async () => {
      try {
        const { data } = await paymentsApi.status(paymentId)
        if (!active) return
        setStatus(data.status)
        setPaidAt(data.paid_at)
      } catch {
        /* keep polling */
      }
    }
    poll()
    const id = setInterval(poll, intervalMs)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [paymentId, intervalMs])

  return { status, paidAt, isPaid: status === 'paid' }
}
