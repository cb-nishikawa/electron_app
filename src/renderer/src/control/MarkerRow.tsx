import {
  CLICK_ACTION_TYPES,
  MAX_WAIT_AFTER_MS,
  type ClickActionType,
  type ClickTarget,
  type Marker
} from '@shared/types'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const ACTION_LABELS: Record<ClickActionType, string> = {
  click: 'クリック',
  doubleClick: 'ダブルクリック',
  rightClick: '右クリック'
}

export type MarkerRunMark = 'done' | 'current' | null

function targetScope(target?: ClickTarget): string {
  if (!target) return '—'
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: marker.id
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  const commitWait = (value: string): void => {
    const seconds = Number(value)
    if (!Number.isFinite(seconds)) return
    const waitAfterMs = Math.round(Math.min(Math.max(seconds, 0) * 1000, MAX_WAIT_AFTER_MS))
    if (waitAfterMs !== marker.waitAfterMs) api.updateMarker(marker.id, { waitAfterMs })
  }

  const commitDelay = (value: string): void => {
    const seconds = Number(value)
    if (!Number.isFinite(seconds)) return
    const delayMs = Math.round(Math.min(Math.max(seconds, 0) * 1000, MAX_WAIT_AFTER_MS))
    if (delayMs !== marker.delayMs) api.updateMarker(marker.id, { delayMs })
  }

  const commitText = (value: string): void => {
    if (value !== marker.text) api.updateMarker(marker.id, { text: value })
  }

  const commitKeys = (value: string): void => {
    const keys = value
      .split(/[\s+,]+/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0)
    if (JSON.stringify(keys) !== JSON.stringify(marker.keys ?? [])) {
      api.updateMarker(marker.id, { keys })
    }
  }

  const itemType = marker.itemType ?? 'click'

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={runMark ? `marker-row marker-row--${runMark}` : 'marker-row'}
      {...attributes}
      {...listeners}
    >
      <div className="marker-row__main">
        <span className="marker-list__drag" aria-hidden="true">
          ⋮⋮
        </span>
        <span className="marker-list__no">
          {runMark === 'done' ? '✓' : runMark === 'current' ? '▶' : index + 1}
        </span>
        <span className="marker-list__label">{marker.label}</span>
        <span className="marker-list__scope">{targetScope(marker.target)}</span>
        {marker.target && (
          <code className="marker-list__pos">
            {marker.target.x}, {marker.target.y}
          </code>
        )}
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
        {itemType === 'click' && (
          <>
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
          </>
        )}
        {itemType === 'text' && (
          <input
            type="text"
            className="marker-row__text"
            defaultValue={marker.text ?? ''}
            disabled={locked}
            placeholder="入力するテキスト"
            onBlur={(e) => commitText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && commitText(e.currentTarget.value)}
          />
        )}
        {itemType === 'hotkey' && (
          <input
            type="text"
            className="marker-row__text"
            defaultValue={(marker.keys ?? []).join('+')}
            disabled={locked}
            placeholder="例: Ctrl+C"
            onBlur={(e) => commitKeys(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && commitKeys(e.currentTarget.value)}
          />
        )}
        {itemType === 'delay' && (
          <label className="marker-row__wait">
            遅延
            <input
              key={marker.delayMs}
              type="number"
              min={0}
              max={MAX_WAIT_AFTER_MS / 1000}
              step={0.1}
              defaultValue={(marker.delayMs ?? 1000) / 1000}
              disabled={locked}
              onBlur={(e) => commitDelay(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && commitDelay(e.currentTarget.value)}
            />
            秒
          </label>
        )}
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
