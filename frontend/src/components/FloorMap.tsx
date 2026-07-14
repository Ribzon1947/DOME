import { useState } from 'react'
import type { FloorData, FloorMapResponse, FloorMapRoom } from '../lib/types'

const ROOMS_PER_ROW = 5

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size))
  }
  return result
}

function getRoomColors(room: FloorMapRoom, mode: 'customer' | 'admin'): string {
  if (room.is_highlighted) {
    return 'bg-emerald-400 text-slate-900 ring-4 ring-emerald-300 shadow-[0_0_24px_6px_rgba(52,211,153,0.55)] scale-110 z-10 relative font-extrabold'
  }
  if (mode === 'admin') {
    switch (room.status) {
      case 'available':
        return 'bg-emerald-500 text-white hover:bg-emerald-400 cursor-default'
      case 'occupied':
        return 'bg-red-500 text-white hover:bg-red-400 cursor-default'
      case 'maintenance':
        return 'bg-amber-400 text-slate-900 hover:bg-amber-300 cursor-default'
      default:
        return 'bg-slate-200 text-slate-400'
    }
  }
  // Customer mode: other rooms are dark and non-informative
  return 'bg-slate-800/60 text-slate-600 border border-slate-700'
}

function RoomCell({ room, mode }: { room: FloorMapRoom; mode: 'customer' | 'admin' }) {
  const colors = getRoomColors(room, mode)
  const statusLabel =
    room.status === 'available' ? 'Free' : room.status === 'occupied' ? 'Occ' : 'Maint'

  return (
    <div
      className={`flex h-14 w-14 flex-col items-center justify-center rounded-lg text-xs font-bold transition-all duration-200 select-none ${colors}`}
      title={
        mode === 'admin'
          ? `Room ${room.number} — ${room.room_type}${room.status ? ` (${room.status})` : ''}`
          : room.is_highlighted
            ? `Your room: ${room.number}`
            : undefined
      }
    >
      <span className="text-sm leading-tight">{room.number}</span>
      {mode === 'admin' && room.status && (
        <span className="mt-0.5 text-[9px] uppercase tracking-wide opacity-80">{statusLabel}</span>
      )}
    </div>
  )
}

function getDirectionText(data: FloorMapResponse): string {
  if (!data.highlighted_room_number || data.highlighted_floor === null) return ''
  const floorData = data.floors.find((f) => f.floor === data.highlighted_floor)
  if (!floorData) return ''

  const roomIndex = floorData.rooms.findIndex((r) => r.is_highlighted)
  if (roomIndex === -1) return ''

  const halfCount = Math.ceil(floorData.rooms.length / 2)
  const wing = roomIndex < halfCount ? 'upper wing' : 'lower wing'
  const colInRow = roomIndex % ROOMS_PER_ROW
  const position =
    colInRow < 2 ? 'near the elevator' : colInRow < 4 ? 'mid-corridor' : 'at the far end'

  return `Take the elevator to Floor ${data.highlighted_floor}. Walk to the ${wing}, ${position} of the corridor.`
}

function FloorView({ floor, mode }: { floor: FloorData; mode: 'customer' | 'admin' }) {
  const halfCount = Math.ceil(floor.rooms.length / 2)
  const topRows = chunkArray(floor.rooms.slice(0, halfCount), ROOMS_PER_ROW)
  const bottomRows = chunkArray(floor.rooms.slice(halfCount), ROOMS_PER_ROW)

  const corridorTextClass = mode === 'customer' ? 'text-slate-500' : 'text-slate-400'
  const corridorLineClass = mode === 'customer' ? 'border-slate-600' : 'border-slate-300'

  return (
    <div className="flex flex-col gap-2">
      {/* Rooms above the corridor */}
      {topRows.map((row, i) => (
        <div key={`top-${i}`} className="flex flex-wrap gap-2">
          {row.map((room) => (
            <RoomCell key={room.id} room={room} mode={mode} />
          ))}
        </div>
      ))}

      {/* Corridor divider */}
      <div className={`my-3 flex items-center gap-3 ${corridorTextClass}`}>
        <div className={`h-0 flex-1 border-t-2 border-dashed ${corridorLineClass}`} />
        <span className="whitespace-nowrap px-2 text-[11px] font-semibold uppercase tracking-widest">
          Corridor
        </span>
        <span className="text-base" title="Elevator / Stairs">🛗</span>
        <div className={`h-0 flex-1 border-t-2 border-dashed ${corridorLineClass}`} />
      </div>

      {/* Rooms below the corridor */}
      {bottomRows.map((row, i) => (
        <div key={`bottom-${i}`} className="flex flex-wrap gap-2">
          {row.map((room) => (
            <RoomCell key={room.id} room={room} mode={mode} />
          ))}
        </div>
      ))}
    </div>
  )
}

interface FloorMapProps {
  data: FloorMapResponse
  mode: 'customer' | 'admin'
}

export function FloorMap({ data, mode }: FloorMapProps) {
  const [activeFloor, setActiveFloor] = useState<number>(
    data.highlighted_floor ?? data.floors[0]?.floor ?? 1,
  )

  const currentFloor = data.floors.find((f) => f.floor === activeFloor)
  const directions = mode === 'customer' ? getDirectionText(data) : null

  const tabActive = mode === 'customer' ? 'bg-sky-600 text-white' : 'bg-slate-700 text-white'
  const tabInactive =
    mode === 'customer'
      ? 'bg-slate-800 text-slate-400 hover:bg-slate-700'
      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'

  return (
    <div className="flex flex-col gap-4">
      {/* Floor selector tabs */}
      {data.floors.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {data.floors.map((f) => (
            <button
              key={f.floor}
              onClick={() => setActiveFloor(f.floor)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
                activeFloor === f.floor ? tabActive : tabInactive
              }`}
            >
              Floor {f.floor}
            </button>
          ))}
        </div>
      )}

      {/* Floor layout */}
      {currentFloor && <FloorView floor={currentFloor} mode={mode} />}

      {/* Direction hint — customer only */}
      {directions && (
        <div className="mt-2 rounded-xl border border-emerald-500/30 bg-emerald-900/20 px-4 py-3 text-emerald-300">
          <p className="text-sm font-medium leading-relaxed">{directions}</p>
        </div>
      )}

      {/* Legend */}
      <div
        className={`mt-1 flex flex-wrap gap-4 text-xs ${
          mode === 'customer' ? 'text-slate-400' : 'text-slate-500'
        }`}
      >
        {mode === 'admin' ? (
          <>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3.5 w-3.5 rounded bg-emerald-500" />
              Vacant
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3.5 w-3.5 rounded bg-red-500" />
              Occupied
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3.5 w-3.5 rounded bg-amber-400" />
              Under Repair
            </span>
          </>
        ) : (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3.5 w-3.5 animate-pulse rounded bg-emerald-400 ring-2 ring-emerald-300" />
            Your Room
          </span>
        )}
      </div>
    </div>
  )
}
