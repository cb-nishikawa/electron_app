import { screen, type BrowserWindow } from 'electron'
import type {
  AppWindowInfo,
  OverlayMode,
  OverlayState,
  OverlayTarget,
  OverlayTargetStatus,
  ScreenRect
} from '@shared/types'

/** record / edit はオーバーレイがクリックを受け取る。normal / run は背後のアプリへ透過する */
const INTERACTIVE_MODES: ReadonlySet<OverlayMode> = new Set(['record', 'edit'])

export class OverlayModeManager {
  private mode: OverlayMode = 'normal'
  private visible = true
  private target: OverlayTarget = { kind: 'screen' }
  private targetStatus: OverlayTargetStatus = 'ok'

  constructor(
    private readonly overlay: BrowserWindow,
    private readonly onChange: (state: OverlayState) => void
  ) {}

  getState(): OverlayState {
    return {
      mode: this.mode,
      visible: this.visible,
      bounds: this.overlay.getBounds(),
      target: this.target,
      targetStatus: this.targetStatus
    }
  }

  isInteractive(): boolean {
    return INTERACTIVE_MODES.has(this.mode)
  }

  setMode(mode: OverlayMode): OverlayState {
    this.mode = mode
    if (this.isInteractive()) this.visible = true
    this.apply()
    return this.getState()
  }

  setVisible(visible: boolean): OverlayState {
    this.visible = visible
    if (!visible && this.isInteractive()) this.mode = 'normal'
    this.apply()
    return this.getState()
  }

  toggleVisible(): OverlayState {
    return this.setVisible(!this.visible)
  }

  setTarget(target: OverlayTarget): OverlayState {
    this.target = target
    this.targetStatus = 'ok'
    this.apply()
    return this.getState()
  }

  /** 追従中のウィンドウが動いた・見つかり直したときに呼ぶ */
  updateTargetWindow(window: AppWindowInfo): void {
    if (this.target.kind !== 'window') return
    const recovered = this.targetStatus === 'lost'
    this.target = { kind: 'window', window }
    this.targetStatus = 'ok'
    this.setBounds(this.desiredBounds())
    // apply() は記録モードでフォーカスを奪い直すため、表示状態が変わるときだけ呼ぶ
    if (recovered) {
      this.apply()
    } else {
      this.emit()
    }
  }

  /** 追従中のウィンドウが最小化・終了などで見つからなくなったときに呼ぶ */
  markTargetLost(): void {
    if (this.target.kind !== 'window') return
    this.targetStatus = 'lost'
    if (this.isInteractive()) this.mode = 'normal'
    this.apply()
  }

  fitToPrimaryDisplay(): void {
    if (this.target.kind !== 'screen' && this.mode !== 'run') return
    this.setBounds(this.desiredBounds())
    this.emit()
  }

  apply(): void {
    const interactive = this.isInteractive()
    this.setBounds(this.desiredBounds())

    if (interactive) {
      this.overlay.setIgnoreMouseEvents(false)
    } else {
      this.overlay.setIgnoreMouseEvents(true, { forward: true })
    }
    this.overlay.setFocusable(interactive)

    const targetHidden = this.targetStatus === 'lost' && this.mode !== 'run'
    if (!this.visible || targetHidden) {
      this.overlay.hide()
    } else if (interactive) {
      this.overlay.show()
      this.overlay.focus()
    } else {
      this.overlay.showInactive()
    }

    this.emit()
  }

  /** 実行中はアプリをまたいで現在位置を示すため、対象にかかわらず画面全体を覆う */
  private desiredBounds(): ScreenRect {
    if (this.mode !== 'run' && this.target.kind === 'window') return this.target.window.bounds
    return screen.getPrimaryDisplay().bounds
  }

  private setBounds(bounds: ScreenRect): void {
    this.overlay.setBounds({
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height)
    })
  }

  private emit(): void {
    this.onChange(this.getState())
  }
}
