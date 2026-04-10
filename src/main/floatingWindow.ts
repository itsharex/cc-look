import { BrowserWindow, screen, ipcMain } from 'electron'
import { join } from 'path'
import * as db from './database'

interface FloatingWindowInfo {
  window: BrowserWindow
  requestId: string
  timeoutId: NodeJS.Timeout | null
  orderIndex: number
  closePending: boolean
}

interface ToolFloatingWindowInfo {
  window: BrowserWindow
  timeoutId: NodeJS.Timeout | null
}

interface FloatingWindowPosition {
  x: number
  y: number
}

class FloatingWindowManager {
  private windows: Map<string, FloatingWindowInfo> = new Map()
  private toolWindows: Map<string, ToolFloatingWindowInfo> = new Map()
  private windowWidth: number = 400
  private windowHeight: number = 200
  private windowGap: number = 10
  private isDev: boolean
  private nextOrderIndex: number = 0
  private basePosition: FloatingWindowPosition | null = null
  private dragStartBasePos: FloatingWindowPosition | null = null
  private isInitialized: boolean = false
  private hoveredWindows: Set<string> = new Set()
  private isHovering: boolean = false
  private hoverCheckInterval: NodeJS.Timeout | null = null

  constructor() {
    this.isDev = process.env.NODE_ENV === 'development' || !require('electron').app.isPackaged
    this.startHoverPolling()
  }

  // 轮询检测鼠标是否悬停在任意浮动窗上（兜底机制，修复 mouseleave 不触发的问题）
  private startHoverPolling() {
    if (this.hoverCheckInterval) return
    this.hoverCheckInterval = setInterval(() => {
      const point = screen.getCursorScreenPoint()
      let currentlyHovering = false

      for (const info of this.windows.values()) {
        if (!info.window.isDestroyed()) {
          const b = info.window.getBounds()
          if (point.x >= b.x && point.x <= b.x + b.width && point.y >= b.y && point.y <= b.y + b.height) {
            currentlyHovering = true
            break
          }
        }
      }
      if (!currentlyHovering) {
        for (const info of this.toolWindows.values()) {
          if (!info.window.isDestroyed()) {
            const b = info.window.getBounds()
            if (point.x >= b.x && point.x <= b.x + b.width && point.y >= b.y && point.y <= b.y + b.height) {
              currentlyHovering = true
              break
            }
          }
        }
      }

      if (currentlyHovering && !this.isHovering) {
        this.isHovering = true
        for (const info of this.windows.values()) {
          if (info.timeoutId) {
            clearTimeout(info.timeoutId)
            info.timeoutId = null
          }
        }
      } else if (!currentlyHovering && this.isHovering) {
        this.isHovering = false
        for (const [rid, info] of this.windows) {
          if (info.closePending && !info.window.isDestroyed() && !info.timeoutId) {
            this.scheduleClose(rid, 3000)
          }
        }
      }
    }, 200)
  }

  // 初始化 IPC 监听
  private initIpc() {
    if (this.isInitialized) return
    this.isInitialized = true

    // 拖拽开始
    ipcMain.on('floating:dragstart', (_event) => {
      this.dragStartBasePos = { ...this.basePosition! }
      console.log('[FloatingWindow] 拖拽开始, basePos:', this.dragStartBasePos)
    })

    // 拖拽移动
    ipcMain.on('floating:drag', (_event, delta: { dx: number; dy: number }) => {
      if (!this.dragStartBasePos) return

      const newBaseX = this.dragStartBasePos.x + delta.dx
      const newBaseY = this.dragStartBasePos.y + delta.dy

      // 更新所有窗口位置
      for (const info of this.windows.values()) {
        const newY = newBaseY + info.orderIndex * (this.windowHeight + this.windowGap)
        if (!info.window.isDestroyed()) {
          info.window.setPosition(newBaseX, newY)
        }
        // 同步移动右侧工具浮窗
        const toolInfo = this.toolWindows.get(info.requestId)
        if (toolInfo && !toolInfo.window.isDestroyed()) {
          toolInfo.window.setPosition(newBaseX + this.windowWidth + this.windowGap, newY)
        }
      }
    })

    // 拖拽结束
    ipcMain.on('floating:dragend', (_event, delta: { dx: number; dy: number }) => {
      if (!this.dragStartBasePos) return

      // 保存最终位置
      this.basePosition = {
        x: this.dragStartBasePos.x + delta.dx,
        y: this.dragStartBasePos.y + delta.dy
      }
      this.savePosition(this.basePosition)
      this.dragStartBasePos = null

      console.log('[FloatingWindow] 拖拽结束, 新位置:', this.basePosition)
    })

    // 鼠标进入任意浮动窗：暂停所有自动关闭计时器
    ipcMain.on('floating:hoverEnter', (_event) => {
      const requestId = this.findRequestIdByWebContents(_event.sender)
      if (requestId) this.hoveredWindows.add(requestId)
      if (this.hoveredWindows.size === 1) {
        console.log('[FloatingWindow] 鼠标进入浮动窗，暂停自动关闭')
        for (const info of this.windows.values()) {
          if (info.timeoutId) {
            clearTimeout(info.timeoutId)
            info.timeoutId = null
          }
        }
      }
    })

    // 鼠标离开所有浮动窗：恢复自动关闭计时器
    ipcMain.on('floating:hoverLeave', (_event) => {
      const requestId = this.findRequestIdByWebContents(_event.sender)
      if (requestId) this.hoveredWindows.delete(requestId)
      if (this.hoveredWindows.size === 0) {
        console.log('[FloatingWindow] 鼠标离开浮动窗，恢复自动关闭')
        for (const [rid, info] of this.windows) {
          if (info.closePending && !info.window.isDestroyed()) {
            this.scheduleClose(rid, 3000)
          }
        }
      }
    })
  }

  // 获取保存的位置
  private getSavedPosition(): FloatingWindowPosition {
    const settings = db.getSettings()
    const saved = (settings as any).floatingWindowPosition as FloatingWindowPosition | undefined
    if (saved) {
      return saved
    }
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width: screenWidth } = primaryDisplay.workAreaSize
    return {
      x: screenWidth - this.windowWidth - 20,
      y: 100
    }
  }

  // 保存位置
  private savePosition(pos: FloatingWindowPosition) {
    db.setSettings({ floatingWindowPosition: pos } as any)
  }

  // 根据 WebContents 查找 requestId（主窗口或工具窗口）
  private findRequestIdByWebContents(webContents: Electron.WebContents): string | null {
    for (const [requestId, info] of this.windows) {
      if (info.window.webContents === webContents) return requestId
    }
    for (const [requestId, info] of this.toolWindows) {
      if (info.window.webContents === webContents) return requestId
    }
    return null
  }

  // 获取窗口应该显示的位置
  private getWindowPosition(orderIndex: number): FloatingWindowPosition {
    if (!this.basePosition) {
      this.basePosition = this.getSavedPosition()
    }
    return {
      x: this.basePosition.x,
      y: this.basePosition.y + orderIndex * (this.windowHeight + this.windowGap)
    }
  }

  // 创建或获取浮动窗口
  createWindow(requestId: string): BrowserWindow {
    this.initIpc()

    const existing = this.windows.get(requestId)
    if (existing) {
      if (existing.timeoutId) {
        clearTimeout(existing.timeoutId)
        existing.timeoutId = null
      }
      return existing.window
    }

    const orderIndex = this.nextOrderIndex++
    const pos = this.getWindowPosition(orderIndex)

    const window = new BrowserWindow({
      width: this.windowWidth,
      height: this.windowHeight,
      x: pos.x,
      y: pos.y,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      resizable: false,
      skipTaskbar: true,
      focusable: true,
      show: false, // 先不显示，等待 load 完成后用 showInactive 显示
      webPreferences: {
        preload: join(__dirname, '../preload/floating.js'),
        sandbox: false,
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    window.setAlwaysOnTop(true, 'floating')

    if (this.isDev && process.env['ELECTRON_RENDERER_URL']) {
      window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/floating.html`)
    } else {
      window.loadFile(join(__dirname, '../renderer/floating.html'))
    }

    // 无感弹出：页面加载完成后显示窗口但不抢占焦点
    window.webContents.on('did-finish-load', () => {
      window.showInactive()
    })

    this.windows.set(requestId, {
      window,
      requestId,
      timeoutId: null,
      orderIndex,
      closePending: false
    })

    window.on('closed', () => {
      const info = this.windows.get(requestId)
      const closedOrderIndex = info?.orderIndex ?? 0
      this.windows.delete(requestId)
      this.rearrangeWindows(closedOrderIndex)
    })

    console.log(`[FloatingWindow] 创建浮动窗口: ${requestId}, 位置: (${pos.x}, ${pos.y}), 顺序: ${orderIndex}`)

    return window
  }

  // 重新排列窗口（填补空位）
  private rearrangeWindows(closedOrderIndex: number) {
    for (const info of this.windows.values()) {
      if (info.orderIndex > closedOrderIndex) {
        info.orderIndex--
        const newPos = this.getWindowPosition(info.orderIndex)
        if (!info.window.isDestroyed()) {
          info.window.setPosition(newPos.x, newPos.y)
        }
        // 同步重排右侧工具浮窗
        const toolInfo = this.toolWindows.get(info.requestId)
        if (toolInfo && !toolInfo.window.isDestroyed()) {
          toolInfo.window.setPosition(newPos.x + this.windowWidth + this.windowGap, newPos.y)
        }
      }
    }
    this.nextOrderIndex = this.windows.size > 0
      ? Math.max(...Array.from(this.windows.values()).map(i => i.orderIndex)) + 1
      : 0
  }

  // 发送内容到窗口
  sendContent(requestId: string, content: string, type: 'thinking' | 'content' | 'tool_use' | 'server_tool_use' | 'start' | 'end' | 'tool_detail') {
    const info = this.windows.get(requestId)
    if (info && !info.window.isDestroyed()) {
      info.window.webContents.send('floating:content', { content, type })
    }
  }

  // 发送 token 统计到主浮窗
  sendTokens(requestId: string, input: number | null, output: number) {
    const info = this.windows.get(requestId)
    if (info && !info.window.isDestroyed()) {
      info.window.webContents.send('floating:tokens', { input, output })
    }
  }

  // 创建右侧工具详情浮窗
  createToolWindow(requestId: string): BrowserWindow {
    const existing = this.toolWindows.get(requestId)
    if (existing && !existing.window.isDestroyed()) {
      return existing.window
    }

    const mainInfo = this.windows.get(requestId)
    const mainPos = mainInfo
      ? mainInfo.window.getPosition()
      : this.basePosition
        ? [this.basePosition.x, this.basePosition.y]
        : [screen.getPrimaryDisplay().workAreaSize.width - this.windowWidth - 20, 100]

    const toolX = mainPos[0] + this.windowWidth + this.windowGap
    const toolY = mainPos[1]

    const window = new BrowserWindow({
      width: this.windowWidth,
      height: this.windowHeight,
      x: toolX,
      y: toolY,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      resizable: false,
      skipTaskbar: true,
      focusable: true,
      show: false,
      webPreferences: {
        preload: join(__dirname, '../preload/floating.js'),
        sandbox: false,
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    window.setAlwaysOnTop(true, 'floating')

    if (this.isDev && process.env['ELECTRON_RENDERER_URL']) {
      window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/floating.html`)
    } else {
      window.loadFile(join(__dirname, '../renderer/floating.html'))
    }

    window.webContents.on('did-finish-load', () => {
      window.showInactive()
    })

    this.toolWindows.set(requestId, {
      window,
      timeoutId: null
    })

    window.on('closed', () => {
      this.toolWindows.delete(requestId)
    })

    console.log(`[FloatingWindow] 创建工具浮窗: ${requestId}, 位置: (${toolX}, ${toolY})`)
    return window
  }

  // 发送工具详情到右侧浮窗
  sendToolContent(requestId: string, content: string) {
    const toolInfo = this.toolWindows.get(requestId)
    if (toolInfo && !toolInfo.window.isDestroyed()) {
      toolInfo.window.webContents.send('floating:content', { content, type: 'tool_detail' })
    }
  }

  // 关闭工具浮窗
  closeToolWindow(requestId: string) {
    const toolInfo = this.toolWindows.get(requestId)
    if (toolInfo) {
      if (toolInfo.timeoutId) {
        clearTimeout(toolInfo.timeoutId)
      }
      if (!toolInfo.window.isDestroyed()) {
        toolInfo.window.close()
      }
      this.toolWindows.delete(requestId)
    }
  }

  // 标记流式结束，开始倒计时关闭
  scheduleClose(requestId: string, delay: number = 3000) {
    const info = this.windows.get(requestId)
    if (!info) return

    if (info.timeoutId) {
      clearTimeout(info.timeoutId)
      info.timeoutId = null
    }

    info.closePending = true

    if (this.isHovering) {
      console.log(`[FloatingWindow] ${requestId} 等待关闭（鼠标悬停中）`)
      return
    }

    info.timeoutId = setTimeout(() => {
      this.fadeOutAndClose(requestId)
    }, delay)
  }

  // 渐变消失并关闭
  private fadeOutAndClose(requestId: string) {
    const info = this.windows.get(requestId)
    if (info && !info.window.isDestroyed()) {
      info.window.webContents.send('floating:fadeout')
      setTimeout(() => {
        const info2 = this.windows.get(requestId)
        if (info2 && !info2.window.isDestroyed()) {
          info2.window.close()
        }
      }, 500)
    }
    this.closeToolWindow(requestId)
  }

  // 关闭指定窗口
  closeWindow(requestId: string) {
    const info = this.windows.get(requestId)
    if (info) {
      if (info.timeoutId) {
        clearTimeout(info.timeoutId)
      }
      if (!info.window.isDestroyed()) {
        info.window.close()
      }
    }
    this.closeToolWindow(requestId)
  }

  // 关闭所有窗口
  closeAll() {
    for (const [_requestId, info] of this.windows) {
      if (info.timeoutId) {
        clearTimeout(info.timeoutId)
      }
      if (!info.window.isDestroyed()) {
        info.window.close()
      }
    }
    this.windows.clear()
    this.nextOrderIndex = 0
    for (const [requestId] of this.toolWindows) {
      this.closeToolWindow(requestId)
    }
  }

  // 检查是否启用
  isEnabled(): boolean {
    const settings = db.getSettings()
    return settings.floatingWindow === true
  }
}

export const floatingWindowManager = new FloatingWindowManager()
