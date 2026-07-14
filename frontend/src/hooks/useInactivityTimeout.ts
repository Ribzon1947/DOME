import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

export function useInactivityTimeout(seconds: number, redirectTo = '/kiosk') {
  const navigate = useNavigate()
  const timer = useRef<ReturnType<typeof setTimeout>>()

  const reset = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => navigate(redirectTo), seconds * 1000)
  }

  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll']
    events.forEach((e) => window.addEventListener(e, reset))
    reset()
    return () => {
      if (timer.current) clearTimeout(timer.current)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [seconds, redirectTo, navigate])
}
