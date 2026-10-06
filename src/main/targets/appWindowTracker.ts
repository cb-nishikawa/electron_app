import { screen } from 'electron'
import type { Result } from 'get-windows'
import type { AppWindowInfo, ScreenRect } from '@shared/types'

const POLL_INTERVAL_MS = 200
const MIN_WINDOW_SIZE = 40

type GetWindowsModule = typeof import('get-windows')

let getWindowsModule: Promise<GetWindowsModule> | null = null

/** get-windows は ESM 専用のため動的 import で読み込む */
function loadGetWindows(): Promise<GetWindowsModule> {
  getWindowsModule ??= import('get-windows')
  return getWindowsModule
}

function toAppWindowInfo(w: Result): AppWindowInfo {
  const rect: ScreenRect = {
    x: w.bounds.x,
    y: w.bounds.y,
    width: w.bounds.width,
    height: w.bounds.height
  }
  return {
    windowId: w.id,
    processId: w.owner.processId,
    ownerName: w.owner.name,
    bundleId: 'bundleId' in w.owner ? w.owner.bundleId : undefined,
    path: w.owner.path,
    title: w.title,
    // Windows の GetWindowRect は物理ピクセルを返す
    bounds: process.platform === 'win32' ? screen.screenToDipRect(null, rect) : rect
  }
}

function sameRect(a: ScreenRect, b: ScreenRect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}

type TrackHandlers = {
  onUpdate: (window: AppWindowInfo) => void
  onLost: () => void
}

export class AppWindowTracker {
  private timer: NodeJS.Timeout | null = null
  private polling = false
  private trackedId: number | null = null
  private lastBounds: ScreenRect | null = null
  private lost = false

  /** 前面から順に、自分自身と極小ウィンドウを除いた一覧を返す */
  async list(): Promise<AppWindowInfo[]> {
    const { openWindows } = await loadGetWindows()
    // タイトル取得に画面収録の権限が要る。アクセシビリティ権限はブラウザ URL 取得用なので求めない
    const windows = await openWindows({
      accessibilityPermission: false,
      screenRecordingPermission: true
    })
    return windows
      .filter((w) => w.owner.processId !== process.pid)
      .filter((w) => w.bounds.width >= MIN_WINDOW_SIZE && w.bounds.height >= MIN_WINDOW_SIZE)
      .map(toAppWindowInfo)
  }

  track(window: AppWindowInfo, handlers: TrackHandlers): void {
    this.stop()
    this.trackedId = window.windowId
    this.lastBounds = window.bounds
    this.lost = false
    this.timer = setInterval(() => void this.poll(handlers), POLL_INTERVAL_MS)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.trackedId = null
    this.lastBounds = null
  }

  private async poll(handlers: TrackHandlers): Promise<void> {
    if (this.polling || this.trackedId === null) return
    this.polling = true
    const trackedId = this.trackedId
    try {
      const found = (await this.list()).find((w) => w.windowId === trackedId)
      // 取得中に stop() / 別ウィンドウの track() が呼ばれていたら結果を捨てる
      if (this.trackedId !== trackedId) return

      if (!found) {
        if (!this.lost) {
          this.lost = true
          handlers.onLost()
        }
        return
      }

      if (this.lost || !this.lastBounds || !sameRect(this.lastBounds, found.bounds)) {
        this.lost = false
        this.lastBounds = found.bounds
        handlers.onUpdate(found)
      }
    } catch (error) {
      console.error('[appWindowTracker] ウィンドウ一覧の取得に失敗しました', error)
    } finally {
      this.polling = false
    }
  }
}
