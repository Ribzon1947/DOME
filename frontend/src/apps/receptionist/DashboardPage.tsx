import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { bookingsApi, paymentsApi, getErrorMessage } from '../../lib/api'
import type { Booking, BookingStatus } from '../../lib/types'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { format } from 'date-fns'
import { listenForMessages } from "../../lib/firebase";
const STATUS_TABS: (BookingStatus | 'all')[] = [
  'all',
  'pending',
  'checked_in',
  'checked_out',
  'overstay',
]

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  checked_in: 'bg-green-100 text-green-800',
  checked_out: 'bg-slate-100 text-slate-600',
  overstay: 'bg-red-100 text-red-800',
  expired: 'bg-orange-100 text-orange-800',
  available: 'bg-emerald-50',
}

export function DashboardPage() {
  useEffect(() => {
    const unsubscribe = listenForMessages((payload: any) => {
      const title = payload.notification?.title || "Notification";
      const body = payload.notification?.body || "";
      alert(`${title}\n${body}`);
    });
    return () => unsubscribe();
  }, []);

  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Booking | null>(null)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (selected) {
      setEditName(selected.customer_name)
      setEditPhone(selected.customer_phone ?? '')
      setEditNotes(selected.notes ?? '')
      setSaveError('')
    }
  }, [selected?.id])

  const { data: bookings = [], refetch } = useQuery({
    queryKey: ['bookings', statusFilter, search],
    queryFn: async () => {
      const params: { status?: string; search?: string } = {}
      if (statusFilter !== 'all') params.status = statusFilter
      if (search) params.search = search
      const { data } = await bookingsApi.list(params)
      return data
    },
  })

  const { data: calendar } = useQuery({
    queryKey: ['calendar'],
    queryFn: async () => (await bookingsApi.calendar(7)).data,
  })

  const dates = useMemo(
    () => calendar?.rows[0]?.cells.map((c) => c.date) ?? [],
    [calendar],
  )

  const handleCheckIn = async (id: number) => {
    await bookingsApi.checkIn(id)
    refetch()
    setSelected(null)
  }

  const handleCheckOut = async (id: number) => {
    await bookingsApi.checkOut(id)
    refetch()
    setSelected(null)
  }

  const handleConfirmPayment = async (booking: Booking) => {
    if (!booking.payment) {
      const { data } = await paymentsApi.initiate(booking.id)
      await paymentsApi.confirm(data.payment_id)
    } else {
      await paymentsApi.confirm(booking.payment.id)
    }
    refetch()
    const updated = await bookingsApi.get(booking.id)
    setSelected(updated.data)
  }

  const handleSave = async () => {
    if (!selected) return
    setSaving(true)
    setSaveError('')
    try {
      const { data } = await bookingsApi.update(selected.id, {
        customer_name: editName,
        customer_phone: editPhone || null,
        notes: editNotes || null,
      })
      setSelected(data)
      refetch()
    } catch (err) {
      setSaveError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Reception Dashboard</h1>
        <input
          type="search"
          placeholder="Search name or room…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border px-4 py-2"
        />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-4 py-1 text-sm font-medium capitalize ${
              statusFilter === s ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {calendar && (
        <div className="mb-8 overflow-x-auto rounded-xl border bg-white shadow-sm">
          <h2 className="border-b px-4 py-3 font-semibold">Room Calendar</h2>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-3 py-2 text-left">Room</th>
                {dates.map((d) => (
                  <th key={d} className="px-2 py-2 text-center">
                    {format(new Date(d), 'MMM d')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calendar.rows.map((row) => (
                <tr key={row.room_id} className="border-t">
                  <td className="px-3 py-2 font-medium">{row.room_number}</td>
                  {row.cells.map((cell) => (
                    <td
                      key={cell.date}
                      className={`px-1 py-1 text-center text-xs ${
                        cell.booking_id
                          ? statusColors[cell.status ?? 'pending']
                          : statusColors.available
                      }`}
                      title={cell.customer_name ?? 'Available'}
                    >
                      {cell.customer_name ? cell.customer_name.split(' ')[0] : '·'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {bookings.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setSelected(b)}
            className="rounded-xl border bg-white p-4 text-left shadow-sm transition hover:shadow-md"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-semibold">{b.customer_name}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${statusColors[b.status]}`}>
                {b.status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-sm text-slate-600">Room {b.room?.number ?? b.room_id}</p>
            <p className="text-sm text-slate-500">
              {format(new Date(b.check_in), 'MMM d')} – {format(new Date(b.check_out), 'MMM d')}
            </p>
            <p className="mt-2 font-medium">₹{b.amount}</p>
            {b.payment && (
              <span
                className={`mt-1 inline-block text-xs ${
                  b.payment.status === 'paid' ? 'text-green-600' : 'text-amber-600'
                }`}
              >
                Payment: {b.payment.status}
              </span>
            )}
          </button>
        ))}
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Booking Details">
        {selected && (
          <div className="space-y-4">
            <div className="grid gap-3">
              <label className="block">
                <span className="text-sm font-medium text-slate-600">Guest Name</span>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-600">Phone</span>
                <input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-600">Notes</span>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="text-sm text-slate-500 space-y-1">
              <p><strong>Room:</strong> {selected.room?.number}</p>
              <p><strong>ID:</strong> {selected.id_number ?? '—'}</p>
              <p><strong>Amount:</strong> ₹{selected.amount}</p>
              <p><strong>Payment:</strong> {selected.payment?.status ?? 'none'}</p>
            </div>
            {saveError && <p className="text-sm text-red-600">{saveError}</p>}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
              {selected.status === 'pending' && (
                <Button onClick={() => handleCheckIn(selected.id)}>Check In</Button>
              )}
              {(selected.status === 'checked_in' || selected.status === 'overstay') && (
                <Button onClick={() => handleCheckOut(selected.id)}>Check Out</Button>
              )}
              {selected.payment?.status !== 'paid' && (
                <Button variant="secondary" onClick={() => handleConfirmPayment(selected)}>
                  Confirm Payment
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
