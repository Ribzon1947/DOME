import axios, { AxiosError } from 'axios'
import type {
  ApiError,
  Booking,
  CalendarResponse,
  FloorMapResponse,
  OcrResult,
  PaymentInitiateResponse,
  PaymentStatus,
  PricingRule,
  Room,
  RoomType,
  TransactionLog,
  User,
} from './types'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError<ApiError>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
    }
    return Promise.reject(error)
  },
)

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiError | { detail?: unknown } | undefined
    if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') {
      return data.message
    }
    if (data && typeof data === 'object' && 'detail' in data) {
      const detail = data.detail
      if (Array.isArray(detail) && detail[0]?.msg) {
        return String(detail[0].msg)
      }
      if (typeof detail === 'string') return detail
    }
    return error.message
  }
  return 'Something went wrong'
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ access_token: string; refresh_token: string }>('/auth/login', { email, password }),
  me: () => api.get<User>('/auth/me'),
}

export const bookingsApi = {
  list: (params?: { status?: string; search?: string; sort?: string }) =>
    api.get<Booking[]>('/bookings', { params }),
  calendar: (days = 7) => api.get<CalendarResponse>('/bookings/calendar', { params: { days } }),
  rooms: (params?: { check_in?: string; check_out?: string }) =>
    api.get<Room[]>('/bookings/rooms/available', { params }),
  get: (id: number) => api.get<Booking>(`/bookings/${id}`),
  getPublic: (id: number) => api.get<Booking>(`/bookings/public/${id}`),
  create: (data: Record<string, unknown>) => api.post<Booking>('/bookings', data),
  update: (id: number, data: Record<string, unknown>) => api.patch<Booking>(`/bookings/${id}`, data),
  checkIn: (id: number) => api.post<Booking>(`/bookings/${id}/check-in`),
  checkOut: (id: number) => api.post<Booking>(`/bookings/${id}/check-out`),
}

export const paymentsApi = {
  initiate: (bookingId: number) => api.post<PaymentInitiateResponse>(`/payments/${bookingId}/initiate`),
  status: (paymentId: number) =>
    api.get<{ payment_id: number; status: PaymentStatus; paid_at: string | null }>(
      `/payments/${paymentId}/status`,
    ),
  confirm: (paymentId: number) => api.post(`/payments/${paymentId}/confirm`),
}

export const hardwareApi = {
  health: () => api.get<{ tesseract_available: boolean }>('/hardware/health'),
  idScan: (file: Blob, bookingId?: number) => {
    const form = new FormData()
    form.append('file', file, 'id.jpg')
    if (bookingId) form.append('booking_id', String(bookingId))
    return api.post<OcrResult>('/hardware/ocr/id-scan', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

export const adminApi = {
  rooms: () => api.get<Room[]>('/admin/rooms'),
  createRoom: (data: Record<string, unknown>) => api.post<Room>('/admin/rooms', data),
  updateRoom: (id: number, data: Record<string, unknown>) => api.patch<Room>(`/admin/rooms/${id}`, data),
  deleteRoom: (id: number) => api.delete(`/admin/rooms/${id}`),
  roomTypes: () => api.get<RoomType[]>('/admin/room-types'),
  updateRoomType: (id: number, data: Record<string, unknown>) => api.patch<RoomType>(`/admin/room-types/${id}`, data),
  pricing: () => api.get<PricingRule[]>('/admin/pricing'),
  createPricing: (data: Record<string, unknown>) => api.post<PricingRule>('/admin/pricing', data),
  updatePricing: (id: number, data: Record<string, unknown>) => api.patch<PricingRule>(`/admin/pricing/${id}`, data),
  deletePricing: (id: number) => api.delete(`/admin/pricing/${id}`),
  settings: () => api.get<{ key: string; value: string }[]>('/admin/settings'),
  updateSetting: (key: string, value: string) =>
    api.put('/admin/settings', { key, value }),
  staff: () => api.get<User[]>('/admin/staff'),
  createStaff: (data: Record<string, unknown>) => api.post<User>('/admin/staff', data),
  transactions: () => api.get<TransactionLog[]>('/admin/transactions'),
}

export const floormapApi = {
  admin: () => api.get<FloorMapResponse>('/floormap/admin'),
  booking: (bookingId: number) => api.get<FloorMapResponse>(`/floormap/booking/${bookingId}`),
}

export default api
