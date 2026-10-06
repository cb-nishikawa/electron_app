import { useEffect, useState } from 'react'
import type { RunState } from '@shared/types'

export function useRunState(): RunState | null {
  const [run, setRun] = useState<RunState | null>(null)

  useEffect(() => {
    const api = window.liveLens
    const off = api.onRunStateChanged(setRun)
    api.getRunState().then(setRun)
    return off
  }, [])

  return run
}
