import { app, BrowserWindow, screen } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { IpcChannels } from '@shared/ipcChannels'
import { broadcast } from './broadcast'
import { registerIpc } from './ipc'
import { MarkerStore } from './markers/markerStore'
import { OverlayModeManager } from './overlay/overlayModeManager'
import { ForegroundDriver } from './automation/automationController'
import { AutomationRunner } from './automation/automationRunner'
import {
  registerRunStopShortcut,
  registerShortcuts,
  unregisterRunStopShortcut,
  unregisterShortcuts
} from './shortcuts'
import { AppWindowTracker } from './targets/appWindowTracker'
import { createControlWindow } from './windows/controlWindow'
import { createOverlayWindow } from './windows/overlayWindow'

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.cb-nishikawa.live-lens')

  // dev では F12 で DevTools、本番では CommandOrControl+R を無効化
  app.on('browser-window-created', (_, window: BrowserWindow) => {
    optimizer.watchWindowShortcuts(window)
  })

  const overlay = createOverlayWindow()
  const markerStore = new MarkerStore((markers) => broadcast(IpcChannels.markersChanged, markers))
  const modeManager = new OverlayModeManager(overlay, (state) =>
    broadcast(IpcChannels.overlayStateChanged, state)
  )

  const windowTracker = new AppWindowTracker()

  const runner: AutomationRunner = new AutomationRunner({
    controller: new ForegroundDriver(),
    windowTracker,
    getMarkers: () => markerStore.list(),
    getTrackedWindow: () => {
      const { target } = modeManager.getState()
      return target.kind === 'window' ? target.window : null
    },
    onChange: (state) => broadcast(IpcChannels.runStateChanged, state),
    onStart: () => {
      modeManager.setMode('run')
      registerRunStopShortcut(runner)
    },
    onFinish: () => {
      unregisterRunStopShortcut()
      modeManager.setMode('normal')
    }
  })

  registerIpc({ overlay, modeManager, markerStore, windowTracker, runner })
  registerShortcuts(modeManager, runner)

  overlay.once('ready-to-show', () => modeManager.apply())

  const control = createControlWindow()
  control.on('closed', () => {
    runner.stop()
    windowTracker.stop()
    app.quit()
  })

  screen.on('display-metrics-changed', () => modeManager.fitToPrimaryDisplay())
  screen.on('display-added', () => modeManager.fitToPrimaryDisplay())
  screen.on('display-removed', () => modeManager.fitToPrimaryDisplay())
})

app.on('will-quit', () => {
  unregisterShortcuts()
})

app.on('window-all-closed', () => {
  app.quit()
})
