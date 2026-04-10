import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { setupIpcHandlers } from './ipc'
import { initDatabase } from './database'
import { createTray, isAppQuitting } from './tray'
import * as db from './database'

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow: BrowserWindow | null = null

function isMinimizeToTray(): boolean {
  try {
    return db.getSettings().minimizeToTray
  } catch {
    return true
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'CC Look',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 关闭窗口时最小化到托盘（如果启用）
  mainWindow.on('close', (event) => {
    if (!isAppQuitting() && isMinimizeToTray()) {
      event.preventDefault()
      mainWindow?.hide()
      if (process.platform === 'darwin') {
        app.dock.hide()
      }
    }
  })

  // 开发模式下加载 dev server，生产模式下加载本地文件
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    // 开发模式打开 DevTools
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// 应用就绪
app.whenReady().then(async () => {
  // 设置应用用户模型 ID (Windows)
  app.setAppUserModelId('com.cclook.app')

  // 初始化数据库
  await initDatabase()

  // 创建窗口
  createWindow()

  // 创建系统托盘
  createTray()

  // 设置 IPC 处理器 (必须在 createWindow 之后，因为需要获取 mainWindow)
  setupIpcHandlers()

  // macOS 激活应用时创建窗口
  app.on('activate', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      win.show()
      win.focus()
    } else {
      createWindow()
    }
  })
})

// 关闭所有窗口时退出
app.on('window-all-closed', () => {
  // 未启用最小化到托盘时，直接退出（包括 macOS）
  if (process.platform !== 'darwin' || !isMinimizeToTray()) {
    app.quit()
  }
})
