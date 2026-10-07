import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { isSameApp } from '@shared/appWindow'
import type { Marker, OverlayState, OverlayTarget, RunState, ScreenPoint } from '@shared/types'
import { MODE_LABELS } from '../shared/modeLabels'
import { useLiveLensState } from '../shared/useLiveLensState'
import { useRunState } from '../shared/useRunState'

function belongsToTarget(marker: Marker, target: OverlayTarget): boolean {
  // テキスト / ホットキー / 遅延の項目は座標を持たない
  if (!marker.target) return false
  if (target.kind === 'screen') return marker.target.type === 'coordinate'
  return marker.target.type === 'windowCoordinate' && isSameApp(marker.target.window, target.window)
}

/** オーバーレイ内での描画位置。windowCoordinate はオーバーレイが対象ウィンドウに重なっているので相対座標のまま */
function localPosition(marker: Marker, state: OverlayState): ScreenPoint {
  const { target } = marker
  if (!target) return { x: 0, y: 0 }
  if (target.type === 'windowCoordinate') return { x: target.x, y: target.y }
  return { x: target.x - state.bounds.x, y: target.y - state.bounds.y }
}

const HINTS: Partial<Record<OverlayState['mode'], string>> = {
  record: 'クリックした位置を操作対象として登録します（Esc で通常モードに戻る）',
  edit: 'マーカーをドラッグで移動、右クリックで削除します（Esc で通常モードに戻る）'
}

function runHint(run: RunState | null): string {
  if (!run) return ''
  const progress = run.currentIndex !== null ? ` ${run.currentIndex + 1} / ${run.total}` : ''
  switch (run.status) {
    case 'paused':
      return `一時停止中${progress}`
    case 'error':
      return `エラー: ${run.error ?? ''}`
    default:
      return `実行中${progress}（Esc で停止）`
  }
}

function RunIndicator({
  run,
  state
}: {
  run: RunState
  state: OverlayState
}): React.JSX.Element | null {
  if (!run.currentPoint || run.currentIndex === null) return null
  const left = run.currentPoint.x - state.bounds.x
  const top = run.currentPoint.y - state.bounds.y
  return (
    <div className={`run-indicator run-indicator--${run.status}`} style={{ left, top }}>
      <span className="run-indicator__ring" />
      <span className="run-indicator__badge">▶ {run.currentIndex + 1}</span>
    </div>
  )
}

/** ドラッグ移動として扱う最小移動量（px）。これ未満はクリックとみなして位置変更しない */
const DRAG_THRESHOLD = 3

function MarkerPin({
  marker,
  index,
  state
}: {
  marker: Marker
  index: number
  state: OverlayState
}): React.JSX.Element {
  const { x: left, y: top } = localPosition(marker, state)
  const [dragDelta, setDragDelta] = useState<ScreenPoint>({ x: 0, y: 0 })
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    baseX: number
    baseY: number
    moved: boolean
  } | null>(null)

  const editable = state.mode === 'edit'

  const handleContextMenu = (e: MouseEvent): void => {
    e.preventDefault()
    if (state.mode === 'edit') window.liveLens.removeMarker(marker.id)
  }

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>): void => {
    if (!editable || e.button !== 0) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      baseX: left,
      baseY: top,
      moved: false
    }
  }

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    if (Math.abs(dx) >= DRAG_THRESHOLD || Math.abs(dy) >= DRAG_THRESHOLD) drag.moved = true
    setDragDelta({ x: dx, y: dy })
  }

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    dragRef.current = null
    setDragDelta({ x: 0, y: 0 })
    if (!drag.moved) return
    window.liveLens.moveMarker(marker.id, {
      x: drag.baseX + (e.clientX - drag.startX),
      y: drag.baseY + (e.clientY - drag.startY)
    })
  }

  return (
    <div
      className={`marker marker--${state.mode}`}
      style={{ left: left + dragDelta.x, top: top + dragDelta.y }}
      title={
        marker.target ? `${marker.label} (${marker.target.x}, ${marker.target.y})` : marker.label
      }
      onContextMenu={handleContextMenu}
      onPointerDown={editable ? handlePointerDown : undefined}
      onPointerMove={editable ? handlePointerMove : undefined}
      onPointerUp={editable ? handlePointerUp : undefined}
      onPointerCancel={editable ? handlePointerUp : undefined}
    >
      <span className="marker__dot" />
      <span className="marker__badge">{index + 1}</span>
    </div>
  )
}

function OverlayApp(): React.JSX.Element | null {
  const { state, markers } = useLiveLensState()
  const run = useRunState()
  const mode = state?.mode

  useEffect(() => {
    if (mode !== 'record' && mode !== 'edit') return
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') window.liveLens.setMode('normal')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mode])

  if (!state) return null

  const handleClick = (e: MouseEvent): void => {
    if (state.mode !== 'record' || e.button !== 0) return
    if ((e.target as HTMLElement).closest('.marker')) return
    window.liveLens.addMarkerAt({ x: e.clientX, y: e.clientY })
  }

  const isRun = state.mode === 'run'
  const hint = isRun ? runHint(run) : HINTS[state.mode]
  const classNames = ['overlay', `overlay--${state.mode}`]
  // 実行中は画面全体を覆うので、対象ウィンドウの枠は出さない
  if (state.target.kind === 'window' && !isRun) classNames.push('overlay--window-target')
  if (isRun && run?.status === 'error') classNames.push('overlay--run-error')

  return (
    <div className={classNames.join(' ')} onClick={handleClick}>
      {hint && (
        <div className="overlay__hint">
          <strong>{MODE_LABELS[state.mode]}モード</strong>
          <span>{hint}</span>
        </div>
      )}
      {isRun
        ? run && <RunIndicator run={run} state={state} />
        : markers.map(
            (marker, index) =>
              belongsToTarget(marker, state.target) && (
                <MarkerPin key={marker.id} marker={marker} index={index} state={state} />
              )
          )}
    </div>
  )
}

export default OverlayApp
