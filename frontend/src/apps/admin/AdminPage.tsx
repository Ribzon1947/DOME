import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { adminApi, floormapApi, getErrorMessage } from '../../lib/api'
import { Button } from '../../components/Button'
import { FloorMap } from '../../components/FloorMap'
import { EBCPMap } from '../../components/EBCPMap'
import type { PricingRule, Room } from '../../lib/types'

const STATUSES = ['available', 'occupied', 'maintenance'] as const

type RuleEdit = Omit<PricingRule, 'season_start' | 'season_end'> & {
  season_start: string
  season_end: string
}

export function AdminPage() {
  const qc = useQueryClient()
  const [upiId, setUpiId] = useState('')
  const [newStaff, setNewStaff] = useState({ email: '', full_name: '', password: '' })
  const [newRoom, setNewRoom] = useState({ number: '', room_type_id: '', floor: '', status: 'available' })
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [roomError, setRoomError] = useState('')

  // Pricing state
  const [editingRule, setEditingRule] = useState<RuleEdit | null>(null)
  const [showAddRule, setShowAddRule] = useState(false)
  const [newRule, setNewRule] = useState({
    name: '',
    room_type_id: '',
    weekend_multiplier: '1.25',
    season_multiplier: '1.0',
    season_start: '',
    season_end: '',
  })

  // Room type base price state
  const [editingRoomType, setEditingRoomType] = useState<{ id: number; base_price: string } | null>(null)

  const { data: settings = [] } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await adminApi.settings()).data,
  })

  const { data: pricing = [] } = useQuery({
    queryKey: ['pricing'],
    queryFn: async () => (await adminApi.pricing()).data,
  })

  const { data: staff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => (await adminApi.staff()).data,
  })

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => (await adminApi.transactions()).data,
  })

  const { data: rooms = [] } = useQuery({
    queryKey: ['admin-rooms'],
    queryFn: async () => (await adminApi.rooms()).data,
  })

  const { data: roomTypes = [] } = useQuery({
    queryKey: ['room-types'],
    queryFn: async () => (await adminApi.roomTypes()).data,
  })

  const { data: floormap } = useQuery({
    queryKey: ['floormap', 'admin'],
    queryFn: async () => (await floormapApi.admin()).data,
    refetchInterval: 15_000,
  })

  const saveUpi = async () => {
    if (!upiId.trim()) return
    await adminApi.updateSetting('upi_id', upiId.trim())
    setUpiId('')
    qc.invalidateQueries({ queryKey: ['settings'] })
  }

  const addStaff = async () => {
    await adminApi.createStaff({ ...newStaff, role: 'receptionist' })
    qc.invalidateQueries({ queryKey: ['staff'] })
    setNewStaff({ email: '', full_name: '', password: '' })
  }

  const addRoom = async () => {
    setRoomError('')
    if (!newRoom.number.trim() || !newRoom.room_type_id) return
    try {
      await adminApi.createRoom({
        number: newRoom.number.trim(),
        room_type_id: Number(newRoom.room_type_id),
        floor: newRoom.floor ? Number(newRoom.floor) : null,
        status: newRoom.status,
      })
      qc.invalidateQueries({ queryKey: ['admin-rooms'] })
      qc.invalidateQueries({ queryKey: ['floormap', 'admin'] })
      setNewRoom({ number: '', room_type_id: '', floor: '', status: 'available' })
    } catch (e) {
      setRoomError(getErrorMessage(e))
    }
  }

  const saveEditRoom = async () => {
    if (!editingRoom) return
    setRoomError('')
    try {
      await adminApi.updateRoom(editingRoom.id, {
        number: editingRoom.number,
        room_type_id: editingRoom.room_type_id,
        floor: editingRoom.floor ?? null,
        status: editingRoom.status,
      })
      qc.invalidateQueries({ queryKey: ['admin-rooms'] })
      qc.invalidateQueries({ queryKey: ['floormap', 'admin'] })
      setEditingRoom(null)
    } catch (e) {
      setRoomError(getErrorMessage(e))
    }
  }

  const deleteRoom = async (id: number) => {
    setRoomError('')
    try {
      await adminApi.deleteRoom(id)
      qc.invalidateQueries({ queryKey: ['admin-rooms'] })
      qc.invalidateQueries({ queryKey: ['floormap', 'admin'] })
    } catch (e) {
      setRoomError(getErrorMessage(e))
    }
  }

  // Pricing rule handlers
  const saveRule = async () => {
    if (!editingRule) return
    await adminApi.updatePricing(editingRule.id, {
      room_type_id: editingRule.room_type_id,
      name: editingRule.name,
      weekend_multiplier: editingRule.weekend_multiplier,
      season_multiplier: editingRule.season_multiplier,
      season_start: editingRule.season_start || null,
      season_end: editingRule.season_end || null,
      is_active: editingRule.is_active,
    })
    qc.invalidateQueries({ queryKey: ['pricing'] })
    setEditingRule(null)
  }

  const deleteRule = async (id: number) => {
    await adminApi.deletePricing(id)
    qc.invalidateQueries({ queryKey: ['pricing'] })
  }

  const submitNewRule = async () => {
    if (!newRule.name.trim() || !newRule.room_type_id) return
    await adminApi.createPricing({
      room_type_id: Number(newRule.room_type_id),
      name: newRule.name,
      weekend_multiplier: newRule.weekend_multiplier,
      season_multiplier: newRule.season_multiplier,
      season_start: newRule.season_start || null,
      season_end: newRule.season_end || null,
      is_active: true,
    })
    qc.invalidateQueries({ queryKey: ['pricing'] })
    setShowAddRule(false)
    setNewRule({ name: '', room_type_id: '', weekend_multiplier: '1.25', season_multiplier: '1.0', season_start: '', season_end: '' })
  }

  // Room type base price handlers
  const saveRoomType = async () => {
    if (!editingRoomType) return
    await adminApi.updateRoomType(editingRoomType.id, { base_price: editingRoomType.base_price })
    qc.invalidateQueries({ queryKey: ['room-types'] })
    setEditingRoomType(null)
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Admin Panel</h1>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Live Floor Map</h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500">
            Auto-refreshes every 15s
          </span>
        </div>
        {floormap ? (
          <FloorMap data={floormap} mode="admin" />
        ) : (
          <p className="text-sm text-slate-400">Loading floor map…</p>
        )}
      </section>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">EBCP Map</h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500">
            Emergency Building Configuration Plan
          </span>
        </div>
        {floormap ? (
          <EBCPMap data={floormap} />
        ) : (
          <p className="text-sm text-slate-400">Loading…</p>
        )}
      </section>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold">Rooms Management</h2>

        {roomError && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{roomError}</p>
        )}

        {/* Room list */}
        <div className="mb-6 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2 pr-4">Room</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Floor</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) =>
                editingRoom?.id === room.id ? (
                  <tr key={room.id} className="border-b bg-slate-50">
                    <td className="py-2 pr-4">
                      <input
                        value={editingRoom.number}
                        onChange={(e) => setEditingRoom({ ...editingRoom, number: e.target.value })}
                        className="w-24 rounded border px-2 py-1"
                      />
                    </td>
                    <td className="py-2 pr-4">
                      <select
                        value={editingRoom.room_type_id}
                        onChange={(e) => setEditingRoom({ ...editingRoom, room_type_id: Number(e.target.value) })}
                        className="rounded border px-2 py-1"
                      >
                        {roomTypes.map((rt) => (
                          <option key={rt.id} value={rt.id}>{rt.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-4">
                      <input
                        type="number"
                        value={editingRoom.floor ?? ''}
                        onChange={(e) => setEditingRoom({ ...editingRoom, floor: e.target.value ? Number(e.target.value) : null })}
                        className="w-16 rounded border px-2 py-1"
                        placeholder="—"
                      />
                    </td>
                    <td className="py-2 pr-4">
                      <select
                        value={editingRoom.status}
                        onChange={(e) => setEditingRoom({ ...editingRoom, status: e.target.value as Room['status'] })}
                        className="rounded border px-2 py-1"
                      >
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="flex gap-2 py-2">
                      <Button onClick={saveEditRoom}>Save</Button>
                      <Button variant="secondary" onClick={() => { setEditingRoom(null); setRoomError('') }}>Cancel</Button>
                    </td>
                  </tr>
                ) : (
                  <tr key={room.id} className="border-b">
                    <td className="py-2 pr-4 font-medium">{room.number}</td>
                    <td className="py-2 pr-4">{room.room_type?.name ?? '—'}</td>
                    <td className="py-2 pr-4">{room.floor ?? '—'}</td>
                    <td className="py-2 pr-4">
                      <span className={
                        room.status === 'available' ? 'text-green-600' :
                        room.status === 'occupied' ? 'text-red-600' : 'text-amber-600'
                      }>
                        {room.status}
                      </span>
                    </td>
                    <td className="flex gap-2 py-2">
                      <Button variant="secondary" onClick={() => { setEditingRoom(room); setRoomError('') }}>Edit</Button>
                      <button
                        onClick={() => deleteRoom(room.id)}
                        className="rounded-lg px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              )}
              {rooms.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-slate-400">No rooms yet. Add one below.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Add room form */}
        <h3 className="mb-2 text-sm font-semibold text-slate-600">Add New Room</h3>
        <div className="grid gap-2 sm:grid-cols-4">
          <input
            placeholder="Room name / number"
            value={newRoom.number}
            onChange={(e) => setNewRoom({ ...newRoom, number: e.target.value })}
            className="rounded-lg border px-3 py-2"
          />
          <select
            value={newRoom.room_type_id}
            onChange={(e) => setNewRoom({ ...newRoom, room_type_id: e.target.value })}
            className="rounded-lg border px-3 py-2"
          >
            <option value="">Select type</option>
            {roomTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>{rt.name}</option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Floor (optional)"
            value={newRoom.floor}
            onChange={(e) => setNewRoom({ ...newRoom, floor: e.target.value })}
            className="rounded-lg border px-3 py-2"
          />
          <select
            value={newRoom.status}
            onChange={(e) => setNewRoom({ ...newRoom, status: e.target.value })}
            className="rounded-lg border px-3 py-2"
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <Button className="mt-2" onClick={addRoom}>Add Room</Button>
      </section>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold">Payment Settings</h2>
        <p className="mb-2 text-sm text-slate-500">
          Current UPI: {settings.find((s) => s.key === 'upi_id')?.value ?? 'hotel@upi'}
        </p>
        <div className="flex gap-2">
          <input
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            placeholder="New UPI ID"
            className="flex-1 rounded-lg border px-3 py-2"
          />
          <Button onClick={saveUpi}>Save</Button>
        </div>
      </section>

      {/* Pricing Rules */}
      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-6 font-semibold">Pricing Rules</h2>

        {/* Room Type Base Prices */}
        <h3 className="mb-2 text-sm font-semibold text-slate-600">Room Type Base Prices (₹ / night)</h3>
        <div className="mb-8 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2 pr-6">Room Type</th>
                <th className="py-2 pr-6">Base Price</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {roomTypes.map((rt) =>
                editingRoomType?.id === rt.id ? (
                  <tr key={rt.id} className="border-b bg-slate-50">
                    <td className="py-2 pr-6 font-medium">{rt.name}</td>
                    <td className="py-2 pr-6">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400">₹</span>
                        <input
                          type="number"
                          value={editingRoomType.base_price}
                          onChange={(e) => setEditingRoomType({ ...editingRoomType, base_price: e.target.value })}
                          className="w-32 rounded border px-2 py-1"
                          step="0.01"
                          min="0"
                        />
                      </div>
                    </td>
                    <td className="flex gap-2 py-2">
                      <Button onClick={saveRoomType}>Save</Button>
                      <Button variant="secondary" onClick={() => setEditingRoomType(null)}>Cancel</Button>
                    </td>
                  </tr>
                ) : (
                  <tr key={rt.id} className="border-b">
                    <td className="py-2 pr-6 font-medium">{rt.name}</td>
                    <td className="py-2 pr-6">₹{rt.base_price}</td>
                    <td className="py-2">
                      <Button variant="secondary" onClick={() => setEditingRoomType({ id: rt.id, base_price: rt.base_price })}>
                        Edit Price
                      </Button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>

        {/* Multiplier Rules */}
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-600">Multiplier Rules</h3>
          <Button variant="secondary" onClick={() => setShowAddRule(true)}>Add Rule</Button>
        </div>

        <div className="mb-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Room Type</th>
                <th className="py-2 pr-4">Weekend ×</th>
                <th className="py-2 pr-4">Season ×</th>
                <th className="py-2 pr-4">Season Dates</th>
                <th className="py-2 pr-4">Active</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pricing.map((p) =>
                editingRule?.id === p.id ? (
                  <tr key={p.id} className="border-b bg-slate-50">
                    <td className="py-2 pr-4">
                      <input
                        value={editingRule.name}
                        onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                        className="w-32 rounded border px-2 py-1"
                      />
                    </td>
                    <td className="py-2 pr-4">
                      <select
                        value={editingRule.room_type_id}
                        onChange={(e) => setEditingRule({ ...editingRule, room_type_id: Number(e.target.value) })}
                        className="rounded border px-2 py-1"
                      >
                        {roomTypes.map((rt) => (
                          <option key={rt.id} value={rt.id}>{rt.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-4">
                      <input
                        type="number"
                        value={editingRule.weekend_multiplier}
                        onChange={(e) => setEditingRule({ ...editingRule, weekend_multiplier: e.target.value })}
                        className="w-20 rounded border px-2 py-1"
                        step="0.01"
                        min="1"
                      />
                    </td>
                    <td className="py-2 pr-4">
                      <input
                        type="number"
                        value={editingRule.season_multiplier}
                        onChange={(e) => setEditingRule({ ...editingRule, season_multiplier: e.target.value })}
                        className="w-20 rounded border px-2 py-1"
                        step="0.01"
                        min="1"
                      />
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-col gap-1">
                        <input
                          type="date"
                          value={editingRule.season_start}
                          onChange={(e) => setEditingRule({ ...editingRule, season_start: e.target.value })}
                          className="rounded border px-2 py-1 text-xs"
                        />
                        <input
                          type="date"
                          value={editingRule.season_end}
                          onChange={(e) => setEditingRule({ ...editingRule, season_end: e.target.value })}
                          className="rounded border px-2 py-1 text-xs"
                        />
                      </div>
                    </td>
                    <td className="py-2 pr-4">
                      <input
                        type="checkbox"
                        checked={editingRule.is_active}
                        onChange={(e) => setEditingRule({ ...editingRule, is_active: e.target.checked })}
                        className="h-4 w-4"
                      />
                    </td>
                    <td className="flex gap-2 py-2">
                      <Button onClick={saveRule}>Save</Button>
                      <Button variant="secondary" onClick={() => setEditingRule(null)}>Cancel</Button>
                    </td>
                  </tr>
                ) : (
                  <tr key={p.id} className="border-b">
                    <td className="py-2 pr-4 font-medium">{p.name}</td>
                    <td className="py-2 pr-4">{roomTypes.find((rt) => rt.id === p.room_type_id)?.name ?? '—'}</td>
                    <td className="py-2 pr-4">×{p.weekend_multiplier}</td>
                    <td className="py-2 pr-4">×{p.season_multiplier}</td>
                    <td className="py-2 pr-4 text-xs text-slate-500">
                      {p.season_start
                        ? `${p.season_start.slice(0, 10)} – ${p.season_end?.slice(0, 10) ?? '?'}`
                        : '—'}
                    </td>
                    <td className="py-2 pr-4">
                      <span className={p.is_active ? 'text-green-600' : 'text-slate-400'}>
                        {p.is_active ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="flex gap-2 py-2">
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setEditingRule({
                            ...p,
                            season_start: p.season_start?.slice(0, 10) ?? '',
                            season_end: p.season_end?.slice(0, 10) ?? '',
                          })
                        }
                      >
                        Edit
                      </Button>
                      <button
                        onClick={() => deleteRule(p.id)}
                        className="rounded-lg px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              )}
              {pricing.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-slate-400">No pricing rules yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Add Rule Form */}
        {showAddRule && (
          <div className="rounded-lg border bg-slate-50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">New Rule</h3>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              <input
                placeholder="Rule name (e.g. Weekend Rate)"
                value={newRule.name}
                onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                className="rounded-lg border px-3 py-2"
              />
              <select
                value={newRule.room_type_id}
                onChange={(e) => setNewRule({ ...newRule, room_type_id: e.target.value })}
                className="rounded-lg border px-3 py-2"
              >
                <option value="">Select room type</option>
                {roomTypes.map((rt) => (
                  <option key={rt.id} value={rt.id}>{rt.name}</option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Weekend multiplier (e.g. 1.25)"
                value={newRule.weekend_multiplier}
                onChange={(e) => setNewRule({ ...newRule, weekend_multiplier: e.target.value })}
                className="rounded-lg border px-3 py-2"
                step="0.01"
                min="1"
              />
              <input
                type="number"
                placeholder="Season multiplier (e.g. 1.50)"
                value={newRule.season_multiplier}
                onChange={(e) => setNewRule({ ...newRule, season_multiplier: e.target.value })}
                className="rounded-lg border px-3 py-2"
                step="0.01"
                min="1"
              />
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500">Season Start (optional)</label>
                <input
                  type="date"
                  value={newRule.season_start}
                  onChange={(e) => setNewRule({ ...newRule, season_start: e.target.value })}
                  className="rounded-lg border px-3 py-2"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500">Season End (optional)</label>
                <input
                  type="date"
                  value={newRule.season_end}
                  onChange={(e) => setNewRule({ ...newRule, season_end: e.target.value })}
                  className="rounded-lg border px-3 py-2"
                />
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button onClick={submitNewRule}>Add Rule</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowAddRule(false)
                  setNewRule({ name: '', room_type_id: '', weekend_multiplier: '1.25', season_multiplier: '1.0', season_start: '', season_end: '' })
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold">Staff</h2>
        <ul className="mb-4 space-y-1 text-sm">
          {staff.map((u) => (
            <li key={u.id}>
              {u.full_name} ({u.email}) — {u.role}
            </li>
          ))}
        </ul>
        <div className="grid gap-2 md:grid-cols-3">
          <input
            placeholder="Email"
            value={newStaff.email}
            onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
            className="rounded-lg border px-3 py-2"
          />
          <input
            placeholder="Full name"
            value={newStaff.full_name}
            onChange={(e) => setNewStaff({ ...newStaff, full_name: e.target.value })}
            className="rounded-lg border px-3 py-2"
          />
          <input
            placeholder="Password"
            type="password"
            value={newStaff.password}
            onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
            className="rounded-lg border px-3 py-2"
          />
        </div>
        <Button className="mt-2" onClick={addStaff}>
          Add Receptionist
        </Button>
      </section>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold">Transaction Ledger</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4">ID</th>
                <th className="py-2 pr-4">Action</th>
                <th className="py-2 pr-4">Amount</th>
                <th className="py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-b">
                  <td className="py-2 pr-4">{t.id}</td>
                  <td className="py-2 pr-4">{t.action}</td>
                  <td className="py-2 pr-4">₹{t.amount}</td>
                  <td className="py-2">{new Date(t.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-slate-500">
                    No transactions yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
