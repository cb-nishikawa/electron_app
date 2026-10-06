import { globalShortcut } from 'electron'
import type { AutomationRunner } from './automation/automationRunner'
import type { OverlayModeManager } from './overlay/overlayModeManager'

/** Ctrl+Shift+Esc は Windows のタスクマネージャーに予約されているため使わない */
export const Shortcuts = {
  toggleOverlay: 'CommandOrControl+Shift+L',
  backToNormal: 'CommandOrControl+Shift+N',
  /** 実行中だけ登録する緊急停止 */
  stopRun: 'Escape'
} as const

function register(accelerator: string, handler: () => void): void {
  if (!globalShortcut.register(accelerator, handler)) {
    console.warn(`[shortcuts] ${accelerator} を登録できませんでした（他のアプリが使用中の可能性）`)
  }
}

export function registerShortcuts(modeManager: OverlayModeManager, runner: AutomationRunner): void {
  register(Shortcuts.toggleOverlay, () => modeManager.toggleVisible())
  register(Shortcuts.backToNormal, () => {
    if (runner.isActive()) {
      runner.stop()
    } else {
      modeManager.setMode('normal')
    }
  })
}

export function registerRunStopShortcut(runner: AutomationRunner): void {
  register(Shortcuts.stopRun, () => runner.stop())
}

export function unregisterRunStopShortcut(): void {
  if (globalShortcut.isRegistered(Shortcuts.stopRun)) globalShortcut.unregister(Shortcuts.stopRun)
}

export function unregisterShortcuts(): void {
  globalShortcut.unregisterAll()
}
