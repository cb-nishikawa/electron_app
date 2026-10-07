import { useCallback, useState } from 'react'
import { describeWindow } from '@shared/appWindow'
import type { AppWindowInfo, OverlayState } from '@shared/types'
import { toMessage } from '../shared/ipcError'

const isMac = navigator.userAgent.includes('Mac')

function TargetSection({
  state,
  disabled
}: {
  state: OverlayState | null
  disabled: boolean
}): React.JSX.Element {
  const api = window.liveLens
  const target = state?.target
  const [windows, setWindows] = useState<AppWindowInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setWindows(await api.listWindows())
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setLoading(false)
    }
  }, [api])

  const current = target?.kind === 'window' ? target.window : null
  const options =
    current && !windows.some((w) => w.windowId === current.windowId)
      ? [current, ...windows]
      : windows
  const titlesHidden = isMac && windows.length > 0 && windows.every((w) => !w.title)

  return (
    <fieldset className="section" disabled={disabled}>
      <div className="target-picker">
        <select
          value={target?.kind === 'window' ? String(target.window.windowId) : 'screen'}
          onChange={(e) => {
            const value = e.target.value
            if (value === 'screen') {
              setError(null)
              api.setTarget({ kind: 'screen' }).catch((err) => setError(toMessage(err)))
            } else if (value) {
              setError(null)
              api
                .setTarget({ kind: 'window', windowId: Number(value) })
                .catch((err) => setError(toMessage(err)))
            }
          }}
        >
          <option value="screen">画面全体</option>
          {options.map((w) => (
            <option key={w.windowId} value={String(w.windowId)}>
              {describeWindow(w)}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => void refresh()} disabled={loading}>
          {loading ? '取得中…' : '一覧を更新'}
        </button>
      </div>
      {current && state?.targetStatus === 'ok' && (
        <p className="target-status">
          追従中: <code>{`${current.bounds.x}, ${current.bounds.y}`}</code>（
          {`${current.bounds.width}×${current.bounds.height}`}）
        </p>
      )}
      {current && state?.targetStatus === 'lost' && (
        <p className="target-status target-status--lost">
          対象ウィンドウが見つかりません（最小化・終了・別のデスクトップへの移動など）
        </p>
      )}
      {titlesHidden && (
        <p className="target-note">
          ウィンドウのタイトルを表示するには、システム設定の「画面収録」でこのアプリを許可してください
        </p>
      )}

      {error && <p className="target-status target-status--lost">{error}</p>}
    </fieldset>
  )
}

export default TargetSection
