import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { floormapApi, getErrorMessage } from '../../lib/api'
import { FloorMap } from '../../components/FloorMap'
import { Button } from '../../components/Button'

export function FloorMapPage() {
  const navigate = useNavigate()
  const bookingId = Number(sessionStorage.getItem('kiosk_booking_id'))

  useEffect(() => {
    if (!bookingId) navigate('/kiosk')
  }, [bookingId, navigate])

  const { data, isLoading, error } = useQuery({
    queryKey: ['floormap', 'booking', bookingId],
    queryFn: async () => (await floormapApi.booking(bookingId)).data,
    enabled: !!bookingId,
    retry: 2,
  })

  const handleDone = () => {
    sessionStorage.removeItem('kiosk_booking_id')
    navigate('/kiosk')
  }

  if (!bookingId) return null

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-kiosk-lg">
        Finding your room…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
        <div className="text-6xl text-emerald-400">✓</div>
        <h1 className="text-kiosk-xl font-bold">Payment Confirmed!</h1>
        <p className="text-slate-400">{getErrorMessage(error)}</p>
        <Button variant="kiosk" size="kiosk" onClick={handleDone}>
          Return Home
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center gap-6 p-8 pt-12">
      {/* Header */}
      <div className="text-center">
        <div className="mb-3 text-6xl text-emerald-400">✓</div>
        <h1 className="text-kiosk-xl font-bold">Payment Confirmed!</h1>
        {data?.highlighted_room_number && (
          <p className="mt-2 text-kiosk-lg font-semibold text-emerald-300">
            Your Room:{' '}
            <span className="rounded-lg bg-emerald-400/20 px-3 py-1 text-emerald-300">
              {data.highlighted_room_number}
            </span>
            {data.highlighted_floor !== null && (
              <span className="ml-2 text-slate-400">— Floor {data.highlighted_floor}</span>
            )}
          </p>
        )}
      </div>

      {/* Floor map */}
      {data && (
        <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900/80 p-6 backdrop-blur">
          <p className="mb-4 text-center text-sm font-semibold uppercase tracking-widest text-slate-400">
            Hotel Floor Plan
          </p>
          <FloorMap data={data} mode="customer" />
        </div>
      )}

      <Button variant="kiosk" size="kiosk" onClick={handleDone}>
        Return Home
      </Button>
    </div>
  )
}
