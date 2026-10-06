import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { screen, systemPreferences } from 'electron'
import type { AppWindowInfo, ClickActionType, ScreenPoint } from '@shared/types'

export interface AutomationController {
  /** OS 操作を実行できる状態か確認する。できない場合は理由を返す */
  ensureReady(): string | null
  /** 対象ウィンドウを前面に出す */
  activate(window: AppWindowInfo): Promise<void>
  perform(action: ClickActionType, point: ScreenPoint): Promise<void>
}

type NutJs = typeof import('@nut-tree-fork/nut-js')

const execFileAsync = promisify(execFile)

let nutJs: Promise<NutJs> | null = null

function loadNutJs(): Promise<NutJs> {
  nutJs ??= import('@nut-tree-fork/nut-js').then((mod) => {
    // 待機はランナー側で管理するので、nut.js の操作ごとの自動待機は最小にする
    mod.mouse.config.autoDelayMs = 20
    return mod
  })
  return nutJs
}

/** 実際のマウスカーソルを動かして操作する */
export class ForegroundDriver implements AutomationController {
  ensureReady(): string | null {
    if (process.platform === 'darwin' && !systemPreferences.isTrustedAccessibilityClient(true)) {
      return 'マウス操作にはアクセシビリティ権限が必要です。システム設定の「プライバシーとセキュリティ > アクセシビリティ」でこのアプリを許可してから、もう一度実行してください'
    }
    return null
  }

  async activate(window: AppWindowInfo): Promise<void> {
    const { Window, providerRegistry } = await loadNutJs()
    try {
      // windowId は get-windows と libnut で共通（macOS: CGWindowID / Windows: HWND）
      if (await new Window(providerRegistry, window.windowId).focus()) return
    } catch {
      // 下のフォールバックへ
    }
    if (process.platform !== 'darwin') return
    // 同じアプリが複数起動していると別インスタンスが前面に出ることがあるので最後の手段
    const args = window.bundleId
      ? ['-b', window.bundleId]
      : window.path?.endsWith('.app')
        ? ['-a', window.path]
        : null
    if (args) await execFileAsync('open', args)
  }

  async perform(action: ClickActionType, point: ScreenPoint): Promise<void> {
    const { mouse, Button, Point } = await loadNutJs()
    // libnut は macOS ではポイント（= DIP）、Windows では物理ピクセルで座標を受け取る
    const p = process.platform === 'win32' ? screen.dipToScreenPoint(point) : point
    await mouse.setPosition(new Point(Math.round(p.x), Math.round(p.y)))

    switch (action) {
      case 'click':
        await mouse.click(Button.LEFT)
        break
      case 'doubleClick':
        await mouse.doubleClick(Button.LEFT)
        break
      case 'rightClick':
        await mouse.click(Button.RIGHT)
        break
    }
  }
}
