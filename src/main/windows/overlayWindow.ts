import { BrowserWindow, screen } from 'electron'
import { loadRendererPage, preloadPath } from './rendererUrl'

export function createOverlayWindow(): BrowserWindow {
  const { bounds } = screen.getPrimaryDisplay()

  const win = new BrowserWindow({
    ...bounds,
    show: false,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    alwaysOnTop: true,
    enableLargerThanScreen: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.setAlwaysOnTop(true, 'screen-saver')
  if (process.platform === 'darwin') {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }
  win.setIgnoreMouseEvents(true, { forward: true })
  // macOS はメニューバー下へ押し下げることがあるため、生成後に改めてディスプレイ全体へ合わせる
  win.setBounds(bounds)

  loadRendererPage(win, 'overlay')
  return win
}
