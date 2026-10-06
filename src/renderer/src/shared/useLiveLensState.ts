import { useEffect, useState } from 'react'
import type { Marker, OverlayState } from '@shared/types'

/** main が持つオーバーレイ状態とマーカー一覧を購読する */
export function useLiveLensState(): { state: OverlayState | null; markers: Marker[] } {
  const [state, setState] = useState<OverlayState | null>(null)
  const [markers, setMarkers] = useState<Marker[]>([])

  useEffect(() => {
    const api = window.liveLens
    const offState = api.onOverlayStateChanged(setState)
    const offMarkers = api.onMarkersChanged(setMarkers)
    api.getOverlayState().then(setState)
    api.listMarkers().then(setMarkers)
    return () => {
      offState()
      offMarkers()
    }
  }, [])

  return { state, markers }
}
