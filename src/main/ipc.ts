import { ipcMain, screen, type BrowserWindow } from 'electron'
import { IpcChannels } from '@shared/ipcChannels'
import {
  ACTION_ITEM_TYPES,
  CLICK_ACTION_TYPES,
  MAX_HOTKEY_KEYS,
  MAX_KEY_NAME_LENGTH,
  MAX_TEXT_LENGTH,
  MAX_WAIT_AFTER_MS,
  OVERLAY_MODES,
  type ActionItemType,
  type MarkerPatch,
  type OverlayMode,
  type OverlayTargetRequest,
  type ScreenPoint
} from '@shared/types'
import type { AutomationRunner } from './automation/automationRunner'
import type { MarkerStore } from './markers/markerStore'
import type { OverlayModeManager } from './overlay/overlayModeManager'
import type { AppWindowTracker } from './targets/appWindowTracker'

type IpcDeps = {
  overlay: BrowserWindow
  modeManager: OverlayModeManager
  markerStore: MarkerStore
  windowTracker: AppWindowTracker
  runner: AutomationRunner
}

function isOverlayMode(value: unknown): value is OverlayMode {
  return typeof value === 'string' && (OVERLAY_MODES as readonly string[]).includes(value)
}

function isScreenPoint(value: unknown): value is ScreenPoint {
  if (typeof value !== 'object' || value === null) return false
  const { x, y } = value as Record<string, unknown>
  return typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y)
}

function isTargetRequest(value: unknown): value is OverlayTargetRequest {
  if (typeof value !== 'object' || value === null) return false
  const { kind, windowId } = value as Record<string, unknown>
  if (kind === 'screen') return true
  return kind === 'window' && typeof windowId === 'number' && Number.isFinite(windowId)
}

function isMillisInRange(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_WAIT_AFTER_MS
  )
}

const MARKER_PATCH_KEYS = ['action', 'waitAfterMs', 'itemType', 'text', 'keys', 'delayMs']

function isMarkerPatch(value: unknown): value is MarkerPatch {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  if (Object.keys(record).some((key) => !MARKER_PATCH_KEYS.includes(key))) return false

  const { action, waitAfterMs, itemType, text, keys, delayMs } = record
  if (action !== undefined && !(CLICK_ACTION_TYPES as readonly unknown[]).includes(action)) {
    return false
  }
  if (waitAfterMs !== undefined && !isMillisInRange(waitAfterMs)) return false
  if (itemType !== undefined && !(ACTION_ITEM_TYPES as readonly unknown[]).includes(itemType)) {
    return false
  }
  if (text !== undefined) {
    if (typeof text !== 'string') return false
    if (text.length > MAX_TEXT_LENGTH) return false
  }
  if (keys !== undefined) {
    if (!Array.isArray(keys)) return false
    if (keys.length > MAX_HOTKEY_KEYS) return false
    if (
      keys.some(
        (key) => typeof key !== 'string' || key.length === 0 || key.length > MAX_KEY_NAME_LENGTH
      )
    ) {
      return false
    }
  }
  if (delayMs !== undefined && !isMillisInRange(delayMs)) return false
  return true
}

export function registerIpc({
  overlay,
  modeManager,
  markerStore,
  windowTracker,
  runner
}: IpcDeps): void {
  const rejectWhileRunning = (): void => {
    if (runner.isActive()) throw new Error('実行中は変更できません。停止してから操作してください')
  }

  ipcMain.handle(IpcChannels.overlayGetState, () => modeManager.getState())

  ipcMain.handle(IpcChannels.overlaySetMode, (_event, mode: unknown) => {
    if (!isOverlayMode(mode)) throw new Error(`不正なモードです: ${String(mode)}`)
    if (mode === 'run') throw new Error('実行モードは「実行」ボタンから開始してください')
    rejectWhileRunning()
    return modeManager.setMode(mode)
  })

  ipcMain.handle(IpcChannels.overlaySetVisible, (_event, visible: unknown) => {
    if (typeof visible !== 'boolean') throw new Error('visible は boolean で指定してください')
    return modeManager.setVisible(visible)
  })

  ipcMain.handle(IpcChannels.windowsList, () => windowTracker.list())

  ipcMain.handle(IpcChannels.overlaySetTarget, async (_event, request: unknown) => {
    if (!isTargetRequest(request)) throw new Error('対象の指定が不正です')
    rejectWhileRunning()

    if (request.kind === 'screen') {
      windowTracker.stop()
      return modeManager.setTarget({ kind: 'screen' })
    }

    const window = (await windowTracker.list()).find((w) => w.windowId === request.windowId)
    if (!window) throw new Error('指定したウィンドウが見つかりません。一覧を更新してください')

    const state = modeManager.setTarget({ kind: 'window', window })
    windowTracker.track(window, {
      onUpdate: (w) => modeManager.updateTargetWindow(w),
      onLost: () => modeManager.markTargetLost()
    })
    return state
  })

  ipcMain.handle(IpcChannels.markerList, () => markerStore.list())

  ipcMain.handle(IpcChannels.markerAdd, (event, clientPoint: unknown, itemType?: unknown) => {
    const allowedType = (value: unknown): value is ActionItemType =>
      typeof value === 'string' && (ACTION_ITEM_TYPES as readonly string[]).includes(value)

    // 手動追加（+ボタン）: clientPoint が null の場合。操作パネルからの呼び出しなので送信元は問わない
    if (clientPoint === null) {
      rejectWhileRunning()
      const type = allowedType(itemType) ? itemType : 'text'
      return markerStore.add(undefined, type)
    }

    if (event.sender !== overlay.webContents) return null
    const { mode, target } = modeManager.getState()
    if (mode !== 'record') return null
    if (!isScreenPoint(clientPoint)) throw new Error('座標が不正です')

    // オーバーレイは対象ウィンドウに重なっているので、クライアント座標がそのままウィンドウ内の相対座標になる
    if (target.kind === 'window') {
      const { ownerName, bundleId, path, title } = target.window
      return markerStore.add(
        {
          type: 'windowCoordinate',
          x: Math.round(clientPoint.x),
          y: Math.round(clientPoint.y),
          window: { ownerName, bundleId, path, title }
        },
        'click'
      )
    }

    const origin = overlay.getBounds()
    const x = Math.round(origin.x + clientPoint.x)
    const y = Math.round(origin.y + clientPoint.y)
    const display = screen.getDisplayNearestPoint({ x, y })
    return markerStore.add(
      {
        type: 'coordinate',
        x,
        y,
        displayId: display.id,
        scaleFactor: display.scaleFactor
      },
      'click'
    )
  })

  ipcMain.handle(IpcChannels.markerUpdate, (_event, id: unknown, patch: unknown) => {
    if (typeof id !== 'string') throw new Error('id が不正です')
    if (!isMarkerPatch(patch)) throw new Error('変更内容が不正です')
    rejectWhileRunning()
    markerStore.update(id, patch)
  })

  ipcMain.handle(IpcChannels.markerMove, (event, id: unknown, point: unknown) => {
    if (event.sender !== overlay.webContents) throw new Error('オーバーレイからのみ操作できます')
    const { mode } = modeManager.getState()
    if (mode !== 'edit') throw new Error('編集モードでのみ移動できます')
    if (typeof id !== 'string') throw new Error('id が不正です')
    if (!isScreenPoint(point)) throw new Error('座標が不正です')
    rejectWhileRunning()

    const marker = markerStore.list().find((m) => m.id === id)
    if (!marker) throw new Error('マーカーが見つかりません')
    if (!marker.target) throw new Error('この項目は位置を持ちません')

    const target = marker.target
    if (target.type === 'windowCoordinate') {
      // オーバーレイは対象ウィンドウに重なっているので、ローカル座標がそのままウィンドウ内の相対座標になる
      markerStore.updateTarget(id, {
        ...target,
        x: Math.round(point.x),
        y: Math.round(point.y)
      })
      return
    }

    const origin = overlay.getBounds()
    const x = Math.round(origin.x + point.x)
    const y = Math.round(origin.y + point.y)
    const display = screen.getDisplayNearestPoint({ x, y })
    markerStore.updateTarget(id, {
      ...target,
      x,
      y,
      displayId: display.id,
      scaleFactor: display.scaleFactor
    })
  })

  ipcMain.handle(IpcChannels.markerRemove, (_event, id: unknown) => {
    if (typeof id !== 'string') throw new Error('id が不正です')
    rejectWhileRunning()
    markerStore.remove(id)
  })

  ipcMain.handle(IpcChannels.markerClear, () => {
    rejectWhileRunning()
    markerStore.clear()
  })

  ipcMain.handle(IpcChannels.markerReorder, (_event, fromIndex: unknown, toIndex: unknown) => {
    if (typeof fromIndex !== 'number' || typeof toIndex !== 'number') {
      throw new Error('インデックスが不正です')
    }
    rejectWhileRunning()
    markerStore.reorder(fromIndex, toIndex)
  })

  ipcMain.handle(IpcChannels.cursorGetPosition, () => screen.getCursorScreenPoint())

  // ホットキーのキャプチャ中は Cmd/Ctrl+C などのメニューショートカットを奪われないようにする
  ipcMain.handle(IpcChannels.menuSetShortcutsIgnored, (event, ignore: unknown) => {
    if (typeof ignore !== 'boolean') throw new Error('ignore は boolean で指定してください')
    event.sender.setIgnoreMenuShortcuts(ignore)
  })

  ipcMain.handle(IpcChannels.runGetState, () => runner.getState())
  ipcMain.handle(IpcChannels.runStart, () => runner.run())
  ipcMain.handle(IpcChannels.runPause, () => runner.pause())
  ipcMain.handle(IpcChannels.runResume, () => runner.resume())
  ipcMain.handle(IpcChannels.runStop, () => runner.stop())
  ipcMain.handle(IpcChannels.runRetry, () => runner.retry())
}
