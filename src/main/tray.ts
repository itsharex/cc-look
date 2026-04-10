import { app, Tray, Menu, nativeImage, BrowserWindow } from 'electron'
import { join } from 'path'

let tray: Tray | null = null
let isQuitting = false

export function setIsQuitting(val: boolean): void {
  isQuitting = val
}

export function isAppQuitting(): boolean {
  return isQuitting
}

function getIconPath(): string {
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
  if (isDev) {
    return join(__dirname, '../../resources/icon.png')
  }
  return join(process.resourcesPath, 'icon.png')
}

export function createTray(): void {
  const icon = nativeImage.createFromPath(getIconPath())
  tray = new Tray(icon.resize({ width: 16, height: 16 }))

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        const win = BrowserWindow.getAllWindows()[0]
        if (win) {
          if (win.isMinimized()) win.restore()
          win.show()
          win.focus()
          if (process.platform === 'darwin') {
            app.dock.show()
          }
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setToolTip('CC Look')
  tray.setContextMenu(contextMenu)

  // 点击托盘图标显示窗口并置顶
  tray.on('click', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      win.show()
      win.focus()
      if (process.platform === 'darwin') {
        app.dock.show()
      }
    }
  })
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}
