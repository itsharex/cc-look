import { ipcMain, BrowserWindow, dialog } from 'electron'
import { IPC_CHANNELS, type Platform, type RequestLog, type AppSettings, type StreamEvent, type PlatformProxy } from '@shared/types'
import * as db from '../database'
import { ProxyManager } from '../proxy'

const proxyManager = new ProxyManager()
let mainWindow: BrowserWindow | null = null

export function setupIpcHandlers(): void {
  mainWindow = BrowserWindow.getAllWindows()[0]

  // ==================== 平台管理 ====================

  ipcMain.handle(IPC_CHANNELS.PLATFORM_GET_ALL, (): Platform[] => {
    console.log('[IPC] 获取所有平台')
    return db.getAllPlatforms()
  })

  ipcMain.handle(IPC_CHANNELS.PLATFORM_GET, (_, id: string): Platform | null => {
    console.log(`[IPC] 获取平台: ${id}`)
    return db.getPlatformById(id)
  })

  ipcMain.handle(IPC_CHANNELS.PLATFORM_CREATE, (_, data: Omit<Platform, 'id' | 'createdAt' | 'updatedAt'>): Platform => {
    console.log(`[IPC] 创建平台: ${data.name}`)
    return db.createPlatform(data)
  })

  ipcMain.handle(IPC_CHANNELS.PLATFORM_UPDATE, async (_, id: string, updates: Partial<Platform>): Promise<Platform | null> => {
    console.log(`[IPC] 更新平台: ${id}`)
    const platform = db.updatePlatform(id, updates)

    // 如果端口改变且代理正在运行，重启代理
    if (platform && updates.localPort !== undefined) {
      proxyManager.stop(id)
      const success = await proxyManager.start(platform, mainWindow)
      if (!success) {
        dialog.showErrorBox('重启失败', `无法重启代理服务，端口 ${platform.localPort} 可能已被占用`)
      }
    }

    return platform
  })

  ipcMain.handle(IPC_CHANNELS.PLATFORM_DELETE, (_, id: string): boolean => {
    console.log(`[IPC] 删除平台: ${id}`)
    proxyManager.stop(id)
    return db.deletePlatform(id)
  })

  ipcMain.handle(IPC_CHANNELS.PLATFORM_TOGGLE, (_, id: string): Platform | null => {
    console.log(`[IPC] 切换平台状态: ${id}`)
    const platform = db.getPlatformById(id)
    if (!platform) return null
    return db.updatePlatform(id, { enabled: !platform.enabled })
  })

  // ==================== 代理服务 ====================

  ipcMain.handle(IPC_CHANNELS.PROXY_START, async (_, platformId: string): Promise<boolean> => {
    console.log(`[IPC] 启动代理: ${platformId}`)
    const platform = db.getPlatformById(platformId)
    if (!platform) {
      console.error(`[IPC] 平台不存在: ${platformId}`)
      dialog.showErrorBox('启动失败', `平台不存在: ${platformId}`)
      return false
    }
    const success = await proxyManager.start(platform, mainWindow)
    if (!success) {
      dialog.showErrorBox('启动失败', `无法启动代理服务，端口 ${platform.localPort} 可能已被占用`)
    }
    return success
  })

  ipcMain.handle(IPC_CHANNELS.PROXY_STOP, (_, platformId: string): boolean => {
    console.log(`[IPC] 停止代理: ${platformId}`)
    return proxyManager.stop(platformId)
  })

  ipcMain.handle(IPC_CHANNELS.PROXY_STATUS, (_, platformId: string): PlatformProxy | null => {
    return proxyManager.getStatus(platformId)
  })

  // ==================== 日志管理 ====================

  ipcMain.handle(IPC_CHANNELS.LOG_GET_ALL, (_, limit?: number, offset?: number): RequestLog[] => {
    console.log(`[IPC] 获取所有日志: limit=${limit}, offset=${offset}`)
    return db.getAllLogs(limit, offset)
  })

  ipcMain.handle(IPC_CHANNELS.LOG_GET_BY_PLATFORM, (_, platformId: string, limit?: number, offset?: number): RequestLog[] => {
    console.log(`[IPC] 获取平台日志: ${platformId}`)
    return db.getLogsByPlatform(platformId, limit, offset)
  })

  ipcMain.handle(IPC_CHANNELS.LOG_CLEAR, (_, platformId?: string): boolean => {
    console.log(`[IPC] 清空日志: ${platformId || 'all'}`)
    return db.clearLogs(platformId)
  })

  ipcMain.handle(IPC_CHANNELS.LOG_EXPORT, (_, format: 'json' | 'csv', platformId?: string): string => {
    console.log(`[IPC] 导出日志: format=${format}, platformId=${platformId}`)
    return db.exportLogs(format, platformId)
  })

  // ==================== 设置管理 ====================

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, (): AppSettings => {
    return db.getSettings()
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, (_, settings: Partial<AppSettings>): AppSettings => {
    console.log(`[IPC] 更新设置`)
    return db.setSettings(settings)
  })
}

// 导出流事件发送函数
export function sendStreamEvent(window: BrowserWindow | null, event: StreamEvent): void {
  console.log(`[IPC] sendStreamEvent called: type=${event.type}, requestId=${event.requestId}`)
  if (window && !window.isDestroyed()) {
    window.webContents.send(IPC_CHANNELS.PROXY_STREAM, event)
    console.log(`[IPC] Stream event sent to renderer`)
  } else {
    console.log(`[IPC] Window not available, cannot send stream event`)
  }
}
