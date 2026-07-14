export interface User {
  id: number
  email: string
  full_name: string
  role: 'admin' | 'receptionist'
  is_active: boolean
}

export interface RoomType {
  id: number
  name: string
  base_price: string
  description: string | null
}

export interface Room {
  id: number
  number: string
  room_type_id: number
  status: 'available' | 'occupied' | 'maintenance'
  floor: number | null
  room_type?: RoomType
}

export type BookingStatus = 'pending' | 'checked_in' | 'checked_out' | 'overstay' | 'expired'
export type PaymentStatus = 'pending' | 'paid' | 'failed'

export interface PaymentBrief {
  id: number
  status: PaymentStatus
  amount: string
  paid_at: string | null
}

export interface IdDocumentBrief {
  id: number
  extracted_name: string | null
  extracted_dob: string | null
  extracted_id_number: string | null
}

export interface Booking {
  id: number
  room_id: number
  customer_name: string
  customer_email: string | null
  customer_phone: string | null
  dob: string | null
  id_number: string | null
  check_in: string
  check_out: string
  status: BookingStatus
  amount: string
  notes: string | null
  room?: Room
  payment?: PaymentBrief | null
  id_document?: IdDocumentBrief | null
}

export interface CalendarCell {
  date: string
  booking_id: number | null
  status: string | null
  customer_name: string | null
}

export interface CalendarRow {
  room_id: number
  room_number: string
  cells: CalendarCell[]
}

export interface CalendarResponse {
  start_date: string
  end_date: string
  rows: CalendarRow[]
}

export interface PaymentInitiateResponse {
  payment_id: number
  amount: string
  upi_link: string
  upi_id: string
  qr_base64: string
  status: PaymentStatus
}

export interface OcrResult {
  document_id: number
  extracted_name: string | null
  extracted_dob: string | null
  extracted_id_number: string | null
}

export interface PricingRule {
  id: number
  room_type_id: number
  name: string
  weekend_multiplier: string
  season_start: string | null
  season_end: string | null
  season_multiplier: string
  is_active: boolean
}

export interface TransactionLog {
  id: number
  payment_id: number
  action: string
  amount: string
  metadata_json: string | null
  created_at: string
}

export interface FloorMapRoom {
  id: number
  number: string
  status: 'available' | 'occupied' | 'maintenance' | null
  room_type: string
  floor: number
  is_highlighted: boolean
}

export interface FloorData {
  floor: number
  rooms: FloorMapRoom[]
}

export interface FloorMapResponse {
  floors: FloorData[]
  highlighted_room_number: string | null
  highlighted_floor: number | null
}

export interface ApiError {
  status: 'error'
  message: string
  code: number
}
