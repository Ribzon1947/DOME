import { WifiOff } from './icons'

export function NetworkOfflineScreen() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900 text-white">
      <WifiOff className="mb-6 h-16 w-16 text-sky-400" />
      <h1 className="mb-2 text-2xl font-bold">Network Disconnected</h1>
      <p className="max-w-md text-center text-slate-300">
        Please check your connection. The kiosk will resume when the network is restored.
      </p>
    </div>
  )
}
