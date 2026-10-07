import { useEffect, useRef, useState } from 'react'
import type { Marker, RunState } from '@shared/types'
import { useLiveLensState } from '../shared/useLiveLensState'
import { useRunState } from '../shared/useRunState'
import MarkerRow, { type MarkerRunMark } from './MarkerRow'
import ModeSelect, { type PanelView } from './ModeSelect'
import TargetSection from './TargetSection'
import { toMessage } from '../shared/ipcError'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'

const isMac = navigator.userAgent.includes('Mac')

const TRANSPARENCY_KEY = 'live-lens.transparency'
const MIN_TRANSPARENCY = 10
const MAX_TRANSPARENCY = 100
const DEFAULT_TRANSPARENCY = 10

function loadTransparency(): number {
  try {
    const raw = localStorage.getItem(TRANSPARENCY_KEY)
    if (raw === null) return DEFAULT_TRANSPARENCY
    const value = Number.parseInt(raw, 10)
    if (!Number.isFinite(value)) return DEFAULT_TRANSPARENCY
    return Math.min(MAX_TRANSPARENCY, Math.max(MIN_TRANSPARENCY, value))
  } catch {
    return DEFAULT_TRANSPARENCY
  }
}

function applyTransparency(transparency: number): void {
  // 背景の濃さ 10% → alpha 0.1（ほぼ透明）。100% で alpha 1.0（背景が不透明）
  const alpha = transparency / 100
  document.documentElement.style.setProperty('--surface-alpha', String(alpha))
}

// 描画前に適用し、初期表示のフラッシュを防ぐ
const initialTransparency = loadTransparency()
applyTransparency(initialTransparency)
// macOS は信号機ボタンの領域を確保するため、ヘッダーにパディングを足す
document.documentElement.dataset.platform = isMac ? 'mac' : 'other'

function runMarkOf(marker: Marker, run: RunState | null): MarkerRunMark {
  if (!run) return null
  if (run.currentMarkerId === marker.id) return 'current'
  if (run.completedIds.includes(marker.id)) return 'done'
  return null
}

function ControlApp(): React.JSX.Element {
  const { state, markers } = useLiveLensState()
  const run = useRunState()
  const api = window.liveLens
  const running = !!run && run.status !== 'idle'
  const [view, setView] = useState<PanelView>('record')
  const [transparency, setTransparency] = useState(initialTransparency)
  const [menuOpen, setMenuOpen] = useState(false)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const addMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    applyTransparency(transparency)
    try {
      localStorage.setItem(TRANSPARENCY_KEY, String(transparency))
    } catch {
      // 保存できなくても動作は続ける
    }
  }, [transparency])

  useEffect(() => {
    if (!menuOpen) return
    const handlePointerDown = (e: PointerEvent): void => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  useEffect(() => {
    if (!addMenuOpen) return
    const handlePointerDown = (e: PointerEvent): void => {
      if (!addMenuRef.current?.contains(e.target as Node)) setAddMenuOpen(false)
    }
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setAddMenuOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [addMenuOpen])

  const sensors = useSensors(useSensor(PointerSensor))

  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const fromIndex = markers.findIndex((m) => m.id === active.id)
    const toIndex = markers.findIndex((m) => m.id === over.id)
    if (fromIndex !== -1 && toIndex !== -1) {
      api.reorderMarkers(fromIndex, toIndex)
    }
  }

  return (
    <div className="control">
      <header className="control__header">
        <ModeSelect value={view} onChange={setView} />
      </header>

      {view === 'record' && (
        <div className="control__record">
          <TargetSection state={state} disabled={running} />

          <section className="section section--grow">
            <div className="section__title">
              <h2>操作対象（{markers.length}）</h2>
              <div className="marker-actions">
                <button
                  type="button"
                  className={`icon-btn ${state?.mode === 'record' ? 'is-active' : ''}`}
                  disabled={running}
                  onClick={() => api.setMode(state?.mode === 'record' ? 'normal' : 'record')}
                  title={state?.mode === 'record' ? '録画停止' : '録画開始'}
                >
                  {state?.mode === 'record' ? '⏹' : '⏺'}
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  disabled={
                    markers.length === 0 ||
                    running ||
                    run?.status === 'running' ||
                    run?.status === 'paused'
                  }
                  onClick={() => {
                    setError(null)
                    api.startRun().catch((e) => setError(toMessage(e)))
                  }}
                  title="実行"
                >
                  ▶
                </button>
                <div className="menu-container" ref={addMenuRef}>
                  <button
                    type="button"
                    className="icon-btn"
                    disabled={running}
                    onClick={() => setAddMenuOpen((prev) => !prev)}
                    title="追加"
                  >
                    +
                  </button>
                  {addMenuOpen && (
                    <div className="menu-dropdown">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          api.addMarker('text')
                          setAddMenuOpen(false)
                        }}
                      >
                        テキスト
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          api.addMarker('hotkey')
                          setAddMenuOpen(false)
                        }}
                      >
                        ホットキー
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          api.addMarker('delay')
                          setAddMenuOpen(false)
                        }}
                      >
                        遅延
                      </button>
                    </div>
                  )}
                </div>
                <div className="menu-container" ref={menuRef}>
                  <button
                    type="button"
                    className="icon-btn"
                    disabled={running}
                    onClick={() => setMenuOpen((prev) => !prev)}
                    title="メニュー"
                  >
                    ☰
                  </button>
                  {menuOpen && (
                    <div className="menu-dropdown">
                      <button
                        type="button"
                        onClick={() => {
                          api.setMode(state?.mode === 'edit' ? 'normal' : 'edit')
                          setMenuOpen(false)
                        }}
                      >
                        編集
                      </button>
                      <button
                        type="button"
                        disabled={markers.length === 0}
                        onClick={() => {
                          api.clearMarkers()
                          setMenuOpen(false)
                        }}
                      >
                        すべて削除
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {error && <p className="run-message run-message--error">{error}</p>}
            {markers.length === 0 ? (
              <p className="empty">記録モードでオーバーレイをクリックすると登録されます</p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={markers.map((m) => m.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ol className="marker-list">
                    {markers.map((marker, index) => (
                      <MarkerRow
                        key={marker.id}
                        marker={marker}
                        index={index}
                        runMark={runMarkOf(marker, run)}
                        locked={running}
                      />
                    ))}
                  </ol>
                </SortableContext>
              </DndContext>
            )}
          </section>
        </div>
      )}

      <footer className="control__footer">
        <div className="footer-controls">
          <button
            type="button"
            className={`icon-btn ${state?.visible ? 'is-active' : ''}`}
            onClick={() => api.setOverlayVisible(!state?.visible)}
            title="オーバーレイ表示切替"
          >
            {state?.visible ? '👁' : '👁‍🗨'}
          </button>
          <label className="control__opacity">
            <span aria-hidden="true" className="control__opacity__icon">
              ◐
            </span>
            <input
              type="range"
              aria-label="背景の濃さ"
              min={MIN_TRANSPARENCY}
              max={MAX_TRANSPARENCY}
              step={1}
              value={transparency}
              onChange={(e) => setTransparency(Number(e.target.value))}
            />
          </label>
        </div>
      </footer>
    </div>
  )
}

export default ControlApp
