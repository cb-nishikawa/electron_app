import { useEffect, useState } from 'react'
import type { ScreenPoint } from '@shared/types'

const POLL_INTERVAL_MS = 100

export function useCursorPosition(): ScreenPoint | null {
  const [point, setPoint] = useState<ScreenPoint | null>(null)

  useEffect(() => {
    let active = true
    const tick = (): void => {
      window.liveLens.getCursorPosition().then((p) => {
        if (active) setPoint(p)
      })
    }
    tick()
    const timer = window.setInterval(tick, POLL_INTERVAL_MS)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  return point
}
