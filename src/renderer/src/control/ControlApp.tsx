import { useEffect, useState } from 'react'
import { OVERLAY_MODES, type Marker, type RunState } from '@shared/types'
import { MODE_LABELS } from '../shared/modeLabels'
import { useLiveLensState } from '../shared/useLiveLensState'
import { useRunState } from '../shared/useRunState'
import MarkerRow, { type MarkerRunMark } from './MarkerRow'
import ModeSelect, { type PanelView } from './ModeSelect'
import RunSection from './RunSection'
import TargetSection from './TargetSection'
import { useCursorPosition } from './useCursorPosition'

const isMac = navigator.userAgent.includes('Mac')

/** 実行モードは「実行」セクションから開始する */
const SELECTABLE_MODES = OVERLAY_MODES.filter((mode) => mode !== 'run')

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
  const cursor = useCursorPosition()
  const api = window.liveLens
  const running = !!run && run.status !== 'idle'
  const [view, setView] = useState<PanelView>('record')
  const [transparency, setTransparency] = useState(initialTransparency)

  useEffect(() => {
    applyTransparency(transparency)
    try {
      localStorage.setItem(TRANSPARENCY_KEY, String(transparency))
    } catch {
      // 保存できなくても動作は続ける
    }
  }, [transparency])

  return (
    <div className="control">
      <header className="control__header">
        <ModeSelect value={view} onChange={setView} />
      </header>

      {view === 'record' && (
        <div className="control__record">
          <TargetSection state={state} disabled={running} />

          <section className="section">
            <h2>オーバーレイ</h2>
            <div className="mode-buttons">
              {SELECTABLE_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={state?.mode === mode ? 'is-active' : undefined}
                  disabled={running}
                  onClick={() => api.setMode(mode)}
                >
                  {MODE_LABELS[mode]}
                </button>
              ))}
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={state?.visible ?? false}
                onChange={(e) => api.setOverlayVisible(e.target.checked)}
              />
              オーバーレイを表示
            </label>
            <p className="cursor">
              カーソル座標: <code>{cursor ? `${cursor.x}, ${cursor.y}` : '—'}</code>
            </p>
          </section>

          <RunSection run={run} markerCount={markers.length} />

          <section className="section section--grow">
            <div className="section__title">
              <h2>操作対象（{markers.length}）</h2>
              <button
                type="button"
                className="link-button"
                disabled={markers.length === 0 || running}
                onClick={() => api.clearMarkers()}
              >
                すべて削除
              </button>
            </div>
            {markers.length === 0 ? (
              <p className="empty">記録モードでオーバーレイをクリックすると登録されます</p>
            ) : (
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
            )}
          </section>
        </div>
      )}

      <footer className="control__footer">
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
      </footer>
    </div>
  )
}

export default ControlApp
