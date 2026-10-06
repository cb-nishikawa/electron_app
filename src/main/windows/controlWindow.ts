import { BrowserWindow, shell } from 'electron'
import icon from '../../../resources/icon.png?asset'
import { loadRendererPage, preloadPath } from './rendererUrl'

export function createControlWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 420,
    height: 840,
    minWidth: 360,
    minHeight: 480,
    title: 'らいぶレンズ',
    show: false,
    autoHideMenuBar: true,
    // macOS 15+ では frame + transparent だとネイティブのタイトルバー（信号機）が描画されない。
    // タイトルバーを隠して信号機だけオーバーレイ表示にする
    ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset' as const } : {}),
    // 背景を 90% 透過にする（描画は CSS 側で制御）
    transparent: true,
    backgroundColor: '#00000000',
    // 起動中は常に最前面
    alwaysOnTop: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.on('ready-to-show', () => {
    win.show()
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  loadRendererPage(win, 'index')
  return win
}
