import { useState } from 'react'
import type { RunState } from '@shared/types'
import { toMessage } from '../shared/ipcError'

const RESULT_LABELS: Record<NonNullable<RunState['lastResult']>, string> = {
  completed: 'すべての操作を実行しました',
  stopped: '実行を停止しました'
}

function RunSection({
  run,
  markerCount
}: {
  run: RunState | null
  markerCount: number
}): React.JSX.Element {
  const api = window.liveLens
  const [error, setError] = useState<string | null>(null)

  const call = (fn: () => Promise<unknown>): void => {
    setError(null)
    fn().catch((e) => setError(toMessage(e)))
  }

  const status = run?.status ?? 'idle'
  const progress =
    run && run.currentIndex !== null ? `${run.currentIndex + 1} / ${run.total}` : null

  return (
    <div>
      {progress && (
        <div className="section__title">
          <span className="run-progress">{progress}</span>
        </div>
      )}

      {status === 'idle' && (
        <div className="run-buttons">
          <button
            type="button"
            className="primary-button"
            disabled={markerCount === 0}
            onClick={() => call(api.startRun)}
          >
            実行
          </button>
        </div>
      )}

      {status === 'running' && (
        <div className="run-buttons">
          <button type="button" onClick={() => call(api.pauseRun)}>
            一時停止
          </button>
          <button type="button" onClick={() => call(api.stopRun)}>
            停止
          </button>
        </div>
      )}

      {status === 'paused' && (
        <>
          <p className="run-message">一時停止中</p>
          <div className="run-buttons">
            <button type="button" className="primary-button" onClick={() => call(api.resumeRun)}>
              再開
            </button>
            <button type="button" onClick={() => call(api.stopRun)}>
              停止
            </button>
          </div>
        </>
      )}

      {status === 'error' && (
        <>
          <p className="run-message run-message--error">{run?.error}</p>
          <div className="run-buttons">
            <button type="button" className="primary-button" onClick={() => call(api.retryRun)}>
              再試行
            </button>
            <button type="button" onClick={() => call(api.stopRun)}>
              停止
            </button>
          </div>
        </>
      )}

      {status === 'idle' && run?.lastResult && (
        <p className="run-message">{RESULT_LABELS[run.lastResult]}</p>
      )}
      {error && <p className="run-message run-message--error">{error}</p>}
    </div>
  )
}

export default RunSection
