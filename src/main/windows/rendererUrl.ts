import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { BrowserWindow } from 'electron'

export const preloadPath = join(__dirname, '../preload/index.js')

/** electron-vite の dev サーバーまたはビルド済み HTML を読み込む */
export function loadRendererPage(win: BrowserWindow, page: 'index' | 'overlay'): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (is.dev && devUrl) {
    win.loadURL(`${devUrl}/${page}.html`)
  } else {
    win.loadFile(join(__dirname, `../renderer/${page}.html`))
  }
}
