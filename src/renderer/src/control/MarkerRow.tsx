import {
  CLICK_ACTION_TYPES,
  MAX_WAIT_AFTER_MS,
  type ClickActionType,
  type ClickTarget,
  type Marker
} from '@shared/types'

const ACTION_LABELS: Record<ClickActionType, string> = {
  click: 'クリック',
  doubleClick: 'ダブルクリック',
  rightClick: '右クリック'
}

export type MarkerRunMark = 'done' | 'current' | null

function targetScope(target: ClickTarget): string {
  return target.type === 'windowCoordinate' ? target.window.ownerName : '画面'
}

function MarkerRow({
  marker,
  index,
  runMark,
  locked
}: {
  marker: Marker
  index: number
  runMark: MarkerRunMark
  locked: boolean
}): React.JSX.Element {
  const api = window.liveLens

  const commitWait = (value: string): void => {
    const seconds = Number(value)
    if (!Number.isFinite(seconds)) return
    const waitAfterMs = Math.round(Math.min(Math.max(seconds, 0) * 1000, MAX_WAIT_AFTER_MS))
    if (waitAfterMs !== marker.waitAfterMs) api.updateMarker(marker.id, { waitAfterMs })
  }

  return (
    <li className={runMark ? `marker-row marker-row--${runMark}` : 'marker-row'}>
      <div className="marker-row__main">
        <span className="marker-list__no">
          {runMark === 'done' ? '✓' : runMark === 'current' ? '▶' : index + 1}
        </span>
        <span className="marker-list__label">{marker.label}</span>
        <span className="marker-list__scope">{targetScope(marker.target)}</span>
        <code className="marker-list__pos">
          {marker.target.x}, {marker.target.y}
        </code>
        <button
          type="button"
          className="icon-button"
          aria-label={`${marker.label} を削除`}
          disabled={locked}
          onClick={() => api.removeMarker(marker.id)}
        >
          ×
        </button>
      </div>
      <div className="marker-row__settings">
        <select
          value={marker.action}
          disabled={locked}
          onChange={(e) =>
            api.updateMarker(marker.id, { action: e.target.value as ClickActionType })
          }
        >
          {CLICK_ACTION_TYPES.map((action) => (
            <option key={action} value={action}>
              {ACTION_LABELS[action]}
            </option>
          ))}
        </select>
        <label className="marker-row__wait">
          後に
          <input
            key={marker.waitAfterMs}
            type="number"
            min={0}
            max={MAX_WAIT_AFTER_MS / 1000}
            step={0.1}
            defaultValue={marker.waitAfterMs / 1000}
            disabled={locked}
            onBlur={(e) => commitWait(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && commitWait(e.currentTarget.value)}
          />
          秒待機
        </label>
      </div>
    </li>
  )
}

export default MarkerRow
