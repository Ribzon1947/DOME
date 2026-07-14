import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ErrorBoundary } from '../../boundaries/ErrorBoundary'
import { Button } from '../../components/Button'
import { useCamera } from '../../hooks/useCamera'
import { hardwareApi, getErrorMessage } from '../../lib/api'

export function IdScanPage() {
  const navigate = useNavigate()
  const { videoRef, start, stop, capture, error, ready } = useCamera()
  const [processing, setProcessing] = useState(false)
  const [scanError, setScanError] = useState('')

  useEffect(() => {
    start()
    return () => stop()
  }, [start, stop])

  const handleCapture = async () => {
    const blob = capture()
    if (!blob) return
    setProcessing(true)
    setScanError('')
    try {
      const { data } = await hardwareApi.idScan(blob)
      sessionStorage.setItem(
        'kiosk_ocr',
        JSON.stringify({
          document_id: data.document_id,
          customer_name: data.extracted_name ?? '',
          dob: data.extracted_dob ?? '',
          id_number: data.extracted_id_number ?? '',
        }),
      )
      navigate('/kiosk/booking')
    } catch (err) {
      setScanError(getErrorMessage(err))
    } finally {
      setProcessing(false)
    }
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-kiosk-lg">We are having trouble accessing the scanner.</p>
        <p className="text-slate-400">Please proceed to the reception desk.</p>
        <Button variant="kiosk" onClick={() => navigate('/kiosk/booking')}>
          Enter Details Manually
        </Button>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="flex min-h-screen flex-col items-center p-6">
        <h1 className="mb-4 text-kiosk-xl font-bold">Scan Your ID</h1>
        <p className="mb-6 text-slate-400">Place your government ID in the frame</p>
        <div className="relative mb-6 overflow-hidden rounded-2xl border-4 border-sky-500">
          <video ref={videoRef} className="h-[360px] w-[480px] max-w-full bg-black object-cover" playsInline muted />
        </div>
        {scanError && <p className="mb-4 text-red-400">{scanError}</p>}
        <div className="flex gap-4">
          <Button variant="kiosk" size="kiosk" onClick={handleCapture} disabled={!ready || processing}>
            {processing ? 'Processing…' : 'Capture'}
          </Button>
          <Button variant="secondary" size="lg" onClick={() => navigate('/kiosk/booking')}>
            Skip
          </Button>
        </div>
      </div>
    </ErrorBoundary>
  )
}
