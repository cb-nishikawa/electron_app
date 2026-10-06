import { useState } from 'react'
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
const mod = isMac ? '⌘' : 'Ctrl'

/** 実行モードは「実行」セクションから開始する */
const SELECTABLE_MODES = OVERLAY_MODES.filter((mode) => mode !== 'run')

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
        <p>
          <kbd>{mod}</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd> オーバーレイ表示切替
        </p>
        <p>
          <kbd>{mod}</kbd>+<kbd>Shift</kbd>+<kbd>N</kbd> 通常モードに戻る / 実行を停止
        </p>
        <p>
          <kbd>Esc</kbd> 実行を停止（実行中のみ）
        </p>
      </footer>
    </div>
  )
}

export default ControlApp
