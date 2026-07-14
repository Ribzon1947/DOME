import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addDays, formatISO, parseISO } from 'date-fns'
import { bookingsApi, getErrorMessage } from '../../lib/api'
import { Button } from '../../components/Button'
import { VirtualKeyboard } from '../../components/VirtualKeyboard'

const toDatetimeLocal = (iso: string) => iso.slice(0, 16)
const toISO = (local: string) => parseISO(local).toISOString()

export function BookingFormPage() {
  const navigate = useNavigate()
  const ocr = JSON.parse(sessionStorage.getItem('kiosk_ocr') ?? '{}')

  const now = new Date()
  const [customerName, setCustomerName] = useState(ocr.customer_name ?? '')
  const [idNumber, setIdNumber] = useState(ocr.id_number ?? '')
  const [phone, setPhone] = useState('')
  const [roomId, setRoomId] = useState<number | ''>('')
  const [checkIn, setCheckIn] = useState(toDatetimeLocal(formatISO(now)))
  const [checkOut, setCheckOut] = useState(toDatetimeLocal(formatISO(addDays(now, 1))))
  const [activeField, setActiveField] = useState<'name' | 'phone' | 'id'>('name')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms-public', checkIn, checkOut],
    queryFn: async () =>
      (await bookingsApi.rooms({ check_in: toISO(checkIn), check_out: toISO(checkOut) })).data,
  })

  const availableRooms = rooms.filter((r) => r.status === 'available')

  const handleKeyboard = (value: string) => {
    if (activeField === 'name') setCustomerName(value)
    else if (activeField === 'phone') setPhone(value)
    else setIdNumber(value)
  }

  const handleSubmit = async () => {
    if (!customerName || !roomId) {
      setError('Please fill name and select a room')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { data } = await bookingsApi.create({
        room_id: roomId,
        customer_name: customerName,
        customer_phone: phone || null,
        id_number: idNumber || null,
        check_in: toISO(checkIn),
        check_out: toISO(checkOut),
        document_id: ocr.document_id ?? null,
      })
      sessionStorage.setItem('kiosk_booking_id', String(data.id))
      navigate('/kiosk/payment')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-kiosk-xl font-bold">Your Details</h1>
      {error && <p className="mb-4 rounded-lg bg-red-900/50 p-3">{error}</p>}

      <label className="mb-4 block">
        <span className="text-slate-400">Full Name</span>
        <input
          value={customerName}
          onFocus={() => setActiveField('name')}
          onChange={(e) => setCustomerName(e.target.value)}
          className="mt-1 w-full rounded-xl border-2 border-slate-600 bg-slate-800 px-4 py-4 text-kiosk-lg"
        />
      </label>

      <label className="mb-4 block">
        <span className="text-slate-400">Phone</span>
        <input
          value={phone}
          onFocus={() => setActiveField('phone')}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1 w-full rounded-xl border-2 border-slate-600 bg-slate-800 px-4 py-4 text-kiosk-lg"
        />
      </label>

      <label className="mb-4 block">
        <span className="text-slate-400">Aadhaar Number</span>
        <input
          value={idNumber.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3')}
          onFocus={() => setActiveField('id')}
          onChange={(e) => setIdNumber(e.target.value.replace(/\s/g, ''))}
          placeholder="XXXX XXXX XXXX"
          className="mt-1 w-full rounded-xl border-2 border-slate-600 bg-slate-800 px-4 py-4 text-kiosk-lg tracking-widest"
        />
      </label>

      <div className="mb-4 flex gap-4">
        <label className="flex-1 block">
          <span className="text-slate-400">Check-in</span>
          <input
            type="datetime-local"
            value={checkIn}
            onChange={(e) => { setCheckIn(e.target.value); setRoomId('') }}
            className="mt-1 w-full rounded-xl border-2 border-slate-600 bg-slate-800 px-4 py-4 text-kiosk-lg"
          />
        </label>
        <label className="flex-1 block">
          <span className="text-slate-400">Check-out</span>
          <input
            type="datetime-local"
            value={checkOut}
            onChange={(e) => { setCheckOut(e.target.value); setRoomId('') }}
            className="mt-1 w-full rounded-xl border-2 border-slate-600 bg-slate-800 px-4 py-4 text-kiosk-lg"
          />
        </label>
      </div>

      <label className="mb-6 block">
        <span className="text-slate-400">Room</span>
        <select
          value={roomId}
          onChange={(e) => setRoomId(Number(e.target.value))}
          className="mt-1 w-full rounded-xl border-2 border-slate-600 bg-slate-800 px-4 py-4 text-kiosk-lg"
        >
          <option value="">Select room…</option>
          {availableRooms.map((r) => (
            <option key={r.id} value={r.id}>
              Room {r.number} — {r.room_type?.name ?? 'Standard'}
            </option>
          ))}
        </select>
      </label>

      <VirtualKeyboard
        onChange={handleKeyboard}
        inputName={activeField}
        initialValue={activeField === 'name' ? customerName : activeField === 'phone' ? phone : idNumber}
      />

      <div className="mt-6 flex gap-4">
        <Button variant="kiosk" size="kiosk" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Saving…' : 'Continue to Payment'}
        </Button>
        <Button variant="secondary" size="lg" onClick={() => navigate('/kiosk')}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
