import { isSameApp } from '@shared/appWindow'
import type { AppWindowInfo, Marker, RunState, ScreenPoint } from '@shared/types'
import type { AppWindowTracker } from '../targets/appWindowTracker'
import type { AutomationController } from './automationController'

const TICK_MS = 50
const ACTIVATE_SETTLE_MS = 300
/** オーバーレイに実行位置が描かれてから操作する */
const BEFORE_ACTION_MS = 150

type ErrorDecision = 'retry' | 'stop'

type RunnerDeps = {
  controller: AutomationController
  windowTracker: AppWindowTracker
  getMarkers: () => Marker[]
  /** オーバーレイが追従中のウィンドウ。同じアプリのマーカーはこのウィンドウだけを操作する */
  getTrackedWindow: () => AppWindowInfo | null
  onChange: (state: RunState) => void
  onStart: () => void
  onFinish: () => void
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const IDLE_STATE: RunState = {
  status: 'idle',
  total: 0,
  currentIndex: null,
  currentMarkerId: null,
  currentPoint: null,
  completedIds: [],
  error: null,
  lastResult: null
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export class AutomationRunner {
  private state: RunState = IDLE_STATE
  private markers: Marker[] = []
  private stopRequested = false
  private paused = false
  private resolveErrorDecision: ((decision: ErrorDecision) => void) | null = null

  constructor(private readonly deps: RunnerDeps) {}

  getState(): RunState {
    return this.state
  }

  isActive(): boolean {
    return this.state.status !== 'idle'
  }

  run(): RunState {
    if (this.isActive()) throw new Error('すでに実行中です')
    const notReady = this.deps.controller.ensureReady()
    if (notReady) throw new Error(notReady)
    const markers = this.deps.getMarkers()
    if (markers.length === 0) throw new Error('実行するマーカーがありません')

    const invalid = markers.find((marker) => {
      if ((marker.itemType ?? 'click') === 'click') return !marker.target
      if (marker.itemType === 'hotkey') return (marker.keys ?? []).length === 0
      return false
    })
    if (invalid) {
      throw new Error(
        (invalid.itemType ?? 'click') === 'click'
          ? `「${invalid.label}」に操作位置がありません`
          : `「${invalid.label}」のホットキーが設定されていません`
      )
    }

    this.markers = markers
    this.stopRequested = false
    this.paused = false
    this.update({ ...IDLE_STATE, status: 'running', total: markers.length })
    this.deps.onStart()
    void this.loop()
    return this.state
  }

  pause(): RunState {
    if (this.state.status === 'running') {
      this.paused = true
      this.update({ status: 'paused' })
    }
    return this.state
  }

  resume(): RunState {
    if (this.state.status === 'paused') {
      this.paused = false
      this.update({ status: 'running' })
    }
    return this.state
  }

  stop(): RunState {
    if (!this.isActive()) return this.state
    this.stopRequested = true
    this.paused = false
    this.decide('stop')
    return this.state
  }

  retry(): RunState {
    if (this.state.status === 'error') this.decide('retry')
    return this.state
  }

  private async loop(): Promise<void> {
    let result: RunState['lastResult'] = 'completed'
    try {
      for (let i = 0; i < this.markers.length; i++) {
        const marker = this.markers[i]
        let done = false
        while (!done) {
          if (await this.checkpoint()) {
            result = 'stopped'
            return
          }
          this.update({
            currentIndex: i,
            currentMarkerId: marker.id,
            currentPoint: null,
            error: null
          })
          try {
            await this.executeStep(marker)
            done = true
          } catch (error) {
            if ((await this.handleError(error)) === 'stop') {
              result = 'stopped'
              return
            }
          }
        }
        if (this.stopRequested) {
          result = 'stopped'
          return
        }
        this.update({ completedIds: [...this.state.completedIds, marker.id] })

        const isLast = i === this.markers.length - 1
        if (!isLast && (await this.wait(marker.waitAfterMs))) {
          result = 'stopped'
          return
        }
      }
    } finally {
      this.finish(result)
    }
  }

  private async executeStep(marker: Marker): Promise<void> {
    const itemType = marker.itemType ?? 'click'

    if (itemType === 'delay') {
      await this.wait(marker.delayMs ?? 0)
      return
    }

    if (itemType === 'click') {
      const point = await this.resolvePoint(marker)
      if (this.stopRequested) return
      this.update({ currentPoint: point })
      await sleep(BEFORE_ACTION_MS)
      if (this.stopRequested) return
      await this.deps.controller.perform(marker.action, point)
      return
    }

    // テキスト / ホットキーはマウスを動かさず、フォーカスしているウィンドウへ入力する
    await sleep(BEFORE_ACTION_MS)
    if (this.stopRequested) return
    if (itemType === 'text') {
      await this.deps.controller.typeText(marker.text ?? '')
      return
    }
    await this.deps.controller.pressHotkey(marker.keys ?? [])
  }

  private async resolvePoint(marker: Marker): Promise<ScreenPoint> {
    const { target } = marker
    if (!target) throw new Error(`「${marker.label}」に操作位置がありません`)
    if (target.type === 'coordinate') return { x: target.x, y: target.y }

    const tracked = this.deps.getTrackedWindow()
    const pinned = tracked && isSameApp(tracked, target.window) ? tracked : null

    const findWindow = async (): Promise<{ window: AppWindowInfo; frontmost: boolean }> => {
      const windows = await this.deps.windowTracker.list()
      const candidates = windows.filter((w) => isSameApp(w, target.window))
      // 追従中のウィンドウが消えたときに同じアプリの別ウィンドウを誤って操作しない
      const window = pinned
        ? candidates.find((w) => w.windowId === pinned.windowId)
        : (candidates.find((w) => w.title === target.window.title) ?? candidates[0])
      if (!window) {
        throw new Error(
          `「${target.window.ownerName}」のウィンドウが見つかりません（最小化されたか閉じられた可能性があります）`
        )
      }
      return { window, frontmost: windows[0]?.windowId === window.windowId }
    }

    const found = await findWindow()
    let { window } = found
    if (!found.frontmost) {
      // avoid stealing focus
      await sleep(ACTIVATE_SETTLE_MS)
      window = (await findWindow()).window
    }
    return { x: window.bounds.x + target.x, y: window.bounds.y + target.y }
  }

  private handleError(error: unknown): Promise<ErrorDecision> {
    if (this.stopRequested) return Promise.resolve('stop')
    this.update({ status: 'error', error: errorMessage(error) })
    return new Promise((resolve) => {
      this.resolveErrorDecision = resolve
    })
  }

  private decide(decision: ErrorDecision): void {
    const resolve = this.resolveErrorDecision
    if (!resolve) return
    this.resolveErrorDecision = null
    if (decision === 'retry') this.update({ status: 'running', error: null })
    resolve(decision)
  }

  /** 一時停止中はここで待つ。停止が要求されていれば true */
  private async checkpoint(): Promise<boolean> {
    while (this.paused && !this.stopRequested) await sleep(TICK_MS)
    return this.stopRequested
  }

  /** 一時停止中は残り時間を減らさない。停止が要求されたら true */
  private async wait(ms: number): Promise<boolean> {
    let remaining = ms
    while (remaining > 0) {
      if (this.stopRequested) return true
      const step = Math.min(TICK_MS, remaining)
      await sleep(step)
      if (!this.paused) remaining -= step
    }
    return this.stopRequested
  }

  private finish(result: RunState['lastResult']): void {
    this.resolveErrorDecision = null
    this.paused = false
    this.update({
      status: 'idle',
      currentIndex: null,
      currentMarkerId: null,
      currentPoint: null,
      error: null,
      lastResult: result
    })
    this.deps.onFinish()
  }

  private update(patch: Partial<RunState>): void {
    this.state = { ...this.state, ...patch }
    this.deps.onChange(this.state)
  }
}
