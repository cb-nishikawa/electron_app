import { useCallback, useState } from 'react'
import { describeWindow } from '@shared/appWindow'
import type { AppWindowInfo, OverlayState } from '@shared/types'
import { toMessage } from '../shared/ipcError'

type TargetKind = OverlayState['target']['kind']

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
  const [selectedKind, setChoice] = useState<TargetKind>('screen')
  // ウィンドウ未選択の「アプリ指定」はパネル内だけの状態なので、main 側が window のときはそちらを優先する
  const choice: TargetKind = target?.kind === 'window' ? 'window' : selectedKind
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

  const chooseScreen = (): void => {
    setChoice('screen')
    setError(null)
    api.setTarget({ kind: 'screen' }).catch((e) => setError(toMessage(e)))
  }

  const chooseWindowMode = (): void => {
    setChoice('window')
    void refresh()
  }

  const selectWindow = (windowId: number): void => {
    setError(null)
    api.setTarget({ kind: 'window', windowId }).catch((e) => setError(toMessage(e)))
  }

  const current = target?.kind === 'window' ? target.window : null
  const options =
    current && !windows.some((w) => w.windowId === current.windowId)
      ? [current, ...windows]
      : windows
  const titlesHidden = isMac && windows.length > 0 && windows.every((w) => !w.title)

  return (
    <fieldset className="section" disabled={disabled}>
      <h2>対象</h2>
      <div className="target-kind">
        <label>
          <input type="radio" checked={choice === 'screen'} onChange={chooseScreen} />
          画面全体
        </label>
        <label>
          <input type="radio" checked={choice === 'window'} onChange={chooseWindowMode} />
          アプリ指定
        </label>
      </div>

      {choice === 'window' && (
        <>
          <div className="target-picker">
            <select
              value={current ? String(current.windowId) : ''}
              onChange={(e) => e.target.value && selectWindow(Number(e.target.value))}
            >
              <option value="">ウィンドウを選択…</option>
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
        </>
      )}

      {error && <p className="target-status target-status--lost">{error}</p>}
    </fieldset>
  )
}

export default TargetSection
