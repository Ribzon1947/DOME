import type { FloorData, FloorMapResponse, FloorMapRoom } from '../lib/types'

const ROOM_W = 112
const ROOM_H = 72
const CORRIDOR_H = 34
const PAD = 20
const EXIT_W = 56
const STAIR_W = 56
const GAP = 1.5

interface Props {
  data: FloorMapResponse
}

export function EBCPMap({ data }: Props) {
  if (!data?.floors?.length) {
    return (
      <div className="flex items-center justify-center rounded-xl bg-slate-50 py-12 text-sm text-slate-400">
        No rooms configured. Add rooms via Rooms Management above.
      </div>
    )
  }

  const sorted = [...data.floors].sort((a, b) => b.floor - a.floor)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <LegendItem color="#bbf7d0" border="#16a34a" label="Room" />
        <LegendItem color="#fecaca" border="#dc2626" label="Emergency Exit" />
        <LegendItem color="#fde68a" border="#d97706" label="Staircase / Lift" />
        <LegendItem color="#bae6fd" border="#0284c7" label="Corridor" />
        <LegendItem color="#f97316" border="#c2410c" label="Fire Extinguisher" />
      </div>
      {sorted.map((floor) => (
        <div key={floor.floor}>
          <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
            Floor {floor.floor}
            <span className="font-normal text-slate-400">
              — {floor.rooms.length} room{floor.rooms.length !== 1 ? 's' : ''}
            </span>
          </p>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <FloorPlanSVG floorData={floor} />
          </div>
        </div>
      ))}
    </div>
  )
}

function LegendItem({ color, border, label }: { color: string; border: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-3 w-3 rounded-sm" style={{ background: color, border: `1.5px solid ${border}` }} />
      {label}
    </span>
  )
}

function FloorPlanSVG({ floorData }: { floorData: FloorData }) {
  const rooms = floorData.rooms
  const half = Math.ceil(rooms.length / 2)
  const topRooms = rooms.slice(0, half)
  const botRooms = rooms.slice(half)
  const cols = Math.max(topRooms.length, botRooms.length, 1)

  const innerW = EXIT_W + cols * ROOM_W + STAIR_W
  const svgW = PAD * 2 + innerW
  const svgH = PAD * 2 + ROOM_H + CORRIDOR_H + ROOM_H

  const roomsX = PAD + EXIT_W
  const corridorY = PAD + ROOM_H
  const botY = PAD + ROOM_H + CORRIDOR_H
  const stairX = PAD + EXIT_W + cols * ROOM_W

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${svgW} ${svgH}`}
      width={svgW}
      height={svgH}
      style={{ display: 'block', minWidth: svgW }}
    >
      {/* Building outline */}
      <rect x={PAD} y={PAD} width={innerW} height={svgH - PAD * 2}
        fill="none" stroke="#64748b" strokeWidth={2} rx={4} />

      {/* Corridor */}
      <rect x={PAD} y={corridorY} width={innerW} height={CORRIDOR_H}
        fill="#bae6fd" stroke="#7dd3fc" strokeWidth={1} />
      <text
        x={PAD + EXIT_W + (cols * ROOM_W) / 2} y={corridorY + CORRIDOR_H / 2 + 4}
        textAnchor="middle" fontSize={9} fill="#0369a1" fontWeight="600"
      >
        CORRIDOR
      </text>

      {/* Emergency exits — left side */}
      <ExitBox x={PAD} y={PAD} width={EXIT_W} height={ROOM_H} />
      <ExitBox x={PAD} y={botY} width={EXIT_W} height={ROOM_H} />

      {/* Staircase / lift — right side, full height */}
      <rect x={stairX} y={PAD} width={STAIR_W} height={svgH - PAD * 2}
        fill="#fde68a" stroke="#d97706" strokeWidth={1.5} />
      <text x={stairX + STAIR_W / 2} y={PAD + (svgH - PAD * 2) / 2 - 12}
        textAnchor="middle" fontSize={8} fontWeight="700" fill="#78350f">LIFT</text>
      <text x={stairX + STAIR_W / 2} y={PAD + (svgH - PAD * 2) / 2 + 2}
        textAnchor="middle" fontSize={8} fontWeight="700" fill="#78350f">/</text>
      <text x={stairX + STAIR_W / 2} y={PAD + (svgH - PAD * 2) / 2 + 14}
        textAnchor="middle" fontSize={8} fontWeight="700" fill="#78350f">STAIR</text>
      <text x={stairX + STAIR_W / 2} y={PAD + (svgH - PAD * 2) / 2 + 28}
        textAnchor="middle" fontSize={11} fill="#78350f">↑↓</text>

      {/* Fire extinguisher dots in corridor */}
      <FireDot cx={PAD + EXIT_W + 14} cy={corridorY + CORRIDOR_H / 2} />
      {cols > 1 && (
        <FireDot cx={PAD + EXIT_W + cols * ROOM_W - 14} cy={corridorY + CORRIDOR_H / 2} />
      )}

      {/* Top rooms */}
      {topRooms.map((room, i) => (
        <RoomBox key={room.id} x={roomsX + i * ROOM_W} y={PAD} room={room} />
      ))}

      {/* Bottom rooms */}
      {botRooms.map((room, i) => (
        <RoomBox key={room.id} x={roomsX + i * ROOM_W} y={botY} room={room} />
      ))}

      {/* Floor label */}
      <text x={svgW - PAD - 4} y={PAD - 6}
        textAnchor="end" fontSize={9} fontWeight="700" fill="#475569"
      >
        FLOOR {floorData.floor} — EMERGENCY EVACUATION PLAN
      </text>
    </svg>
  )
}

function RoomBox({ x, y, room }: { x: number; y: number; room: FloorMapRoom }) {
  return (
    <g>
      <rect
        x={x + GAP} y={y + GAP}
        width={ROOM_W - GAP * 2} height={ROOM_H - GAP * 2}
        fill="#dcfce7" stroke="#86efac" strokeWidth={1.5}
      />
      <text x={x + ROOM_W / 2} y={y + ROOM_H / 2 - 5}
        textAnchor="middle" fontSize={10} fontWeight="700" fill="#14532d"
      >
        {room.number}
      </text>
      <text x={x + ROOM_W / 2} y={y + ROOM_H / 2 + 10}
        textAnchor="middle" fontSize={7.5} fill="#6b7280"
      >
        {room.room_type}
      </text>
    </g>
  )
}

function ExitBox({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
  return (
    <g>
      <rect x={x} y={y} width={width} height={height}
        fill="#fecaca" stroke="#dc2626" strokeWidth={2} />
      <text x={x + width / 2} y={y + height / 2 - 7}
        textAnchor="middle" fontSize={9} fontWeight="700" fill="#991b1b"
      >
        EXIT
      </text>
      <text x={x + width / 2} y={y + height / 2 + 8}
        textAnchor="middle" fontSize={10} fill="#991b1b"
      >
        ← →
      </text>
    </g>
  )
}

function FireDot({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={7} fill="#f97316" stroke="#c2410c" strokeWidth={1.5} />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize={8} fontWeight="700" fill="white">F</text>
    </g>
  )
}
