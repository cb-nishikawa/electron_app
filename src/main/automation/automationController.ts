import { screen, systemPreferences } from 'electron'
import type { ClickActionType, ScreenPoint } from '@shared/types'
import { toNutKeys } from './keyMap'

export interface AutomationController {
  /** OS 操作を実行できる状態か確認する。できない場合は理由を返す */
  ensureReady(): string | null
  /** 対象ウィンドウを前面に出す */
  activate(): Promise<void>
  perform(action: ClickActionType, point: ScreenPoint): Promise<void>
  /** 現在フォーカスしているウィンドウへテキストを入力する */
  typeText(text: string): Promise<void>
  /** 現在フォーカスしているウィンドウへホットキーを送る */
  pressHotkey(keys: string[]): Promise<void>
}

type NutJs = typeof import('@nut-tree-fork/nut-js')
type NutPoint = InstanceType<NutJs['Point']>

/** ホットキーを押したままにする時間 */
const KEY_HOLD_MS = 50

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

let nutJs: Promise<NutJs> | null = null

function loadNutJs(): Promise<NutJs> {
  nutJs ??= import('@nut-tree-fork/nut-js').then((mod) => {
    // 待機はランナー側で管理するので、nut.js の操作ごとの自動待機は最小にする
    mod.mouse.config.autoDelayMs = 20
    mod.keyboard.config.autoDelayMs = 20
    if (mod.providerRegistry.hasKeyboard()) {
      mod.providerRegistry.getKeyboard().setKeyboardDelay(20)
    }
    return mod
  })
  return nutJs
}

/** 実際のマウスカーソルを動かして操作する */
export class ForegroundDriver implements AutomationController {
  ensureReady(): string | null {
    if (process.platform === 'darwin' && !systemPreferences.isTrustedAccessibilityClient(true)) {
      return 'マウス・キーボード操作にはアクセシビリティ権限が必要です。システム設定の「プライバシーとセキュリティ > アクセシビリティ」でこのアプリを許可してから、もう一度実行してください'
    }
    return null
  }

  async activate(): Promise<void> {
    // 実行時にマウスフォーカスが移動しないようにするため、アクティベートは行わない
  }

  async perform(action: ClickActionType, point: ScreenPoint): Promise<void> {
    const { mouse, Button, Point } = await loadNutJs()
    // libnut は macOS ではポイント（= DIP）、Windows では物理ピクセルで座標を受け取る
    const toNative = (target: ScreenPoint): NutPoint => {
      const native = process.platform === 'win32' ? screen.dipToScreenPoint(target) : target
      return new Point(Math.round(native.x), Math.round(native.y))
    }

    // 操作の前後でカーソルが実行箇所に留まらないように、元の位置へ戻す
    const origin = screen.getCursorScreenPoint()
    try {
      await mouse.setPosition(toNative(point))
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
    } finally {
      await mouse.setPosition(toNative(origin))
    }
  }

  async typeText(text: string): Promise<void> {
    if (!text) return
    const { keyboard } = await loadNutJs()
    await keyboard.type(text)
  }

  async pressHotkey(keys: string[]): Promise<void> {
    if (keys.length === 0) throw new Error('ホットキーが設定されていません')
    const { keyboard, Key } = await loadNutJs()
    const combo = toNutKeys(keys, Key)
    try {
      await keyboard.pressKey(...combo)
      await sleep(KEY_HOLD_MS)
    } finally {
      // 押したままになると操作不能になるので、失敗時も必ず離す
      await keyboard.releaseKey(...combo).catch(() => undefined)
    }
  }
}
