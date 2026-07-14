import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NetworkOfflineScreen } from './boundaries/NetworkOfflineScreen'
import { StaffLayout } from './components/StaffLayout'
import { LoginPage } from './apps/receptionist/LoginPage'
import { DashboardPage } from './apps/receptionist/DashboardPage'
import { AdminPage } from './apps/admin/AdminPage'
import { KioskLayout } from './apps/kiosk/KioskLayout'
import { KioskHome } from './apps/kiosk/KioskHome'
import { IdScanPage } from './apps/kiosk/IdScanPage'
import { BookingFormPage } from './apps/kiosk/BookingFormPage'
import { PaymentPage } from './apps/kiosk/PaymentPage'
import { DonePage } from './apps/kiosk/DonePage'
import { FloorMapPage } from './apps/kiosk/FloorMapPage'
import { PayBalancePage } from './apps/kiosk/PayBalancePage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

function App() {
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      {!online && <NetworkOfflineScreen />}
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/kiosk" element={<KioskLayout />}>
            <Route index element={<KioskHome />} />
            <Route path="check-in" element={<IdScanPage />} />
            <Route path="booking" element={<BookingFormPage />} />
            <Route path="payment" element={<PaymentPage />} />
            <Route path="done" element={<DonePage />} />
            <Route path="floormap" element={<FloorMapPage />} />
            <Route path="pay" element={<PayBalancePage />} />
          </Route>
          <Route element={<StaffLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>
          <Route path="/" element={<Navigate to="/kiosk" replace />} />
          <Route path="*" element={<Navigate to="/kiosk" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
