import { create } from 'zustand'
import type { Platform, StreamEvent, RequestLog } from '@shared/types'

// 进行中的请求
export interface ActiveRequest {
  requestId: string
  platformId: string
  platformName: string
  method: string
  path: string
  startTime: number
  rawContent: string[]
  status: 'pending' | 'streaming' | 'error'
}

// 代理服务状态
export interface ProxyState {
  isRunning: boolean
  port: number
}

interface LogState {
  platforms: Platform[]
  logs: RequestLog[]
  activeRequests: ActiveRequest[]
  loading: boolean

  // 代理服务状态（统一）
  proxyState: ProxyState
  fetchProxyState: () => Promise<void>
  startProxy: () => Promise<void>
  stopProxy: () => Promise<void>

  // 平台管理
  fetchPlatforms: () => Promise<void>
  createPlatform: (platform: Omit<Platform, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Platform>
  updatePlatform: (id: string, updates: Partial<Platform>) => Promise<void>
  deletePlatform: (id: string) => Promise<void>

  // 日志管理
  fetchLogs: (limit?: number) => Promise<void>
  clearLogs: (platformId?: string) => Promise<void>
  exportLogs: (format: 'json' | 'csv') => Promise<string>

  // 实时请求管理
  addActiveRequest: (event: StreamEvent, platformName: string) => void
  updateActiveRequest: (event: StreamEvent) => void
  removeActiveRequest: (requestId: string) => void
  abortRequest: (requestId: string) => Promise<boolean>

  // 流事件订阅
  subscribeToStream: () => () => void
}

// 获取平台名称的辅助函数
const getPlatformName = (platforms: Platform[], platformId: string): string => {
  const platform = platforms.find(p => p.id === platformId)
  return platform?.name || 'Unknown'
}

export const useLogStore = create<LogState>((set, get) => ({
  platforms: [],
  logs: [],
  activeRequests: [],
  loading: false,
  proxyState: { isRunning: false, port: 5005 },

  // ==================== 代理服务（统一） ====================

  fetchProxyState: async () => {
    try {
      const settings = await window.api.settings.get()
      const state = await window.api.proxy.getGlobalState()
      set({ proxyState: { isRunning: state.isRunning, port: settings.proxyPort || 5005 } })
    } catch (error) {
      console.error('Failed to fetch proxy state:', error)
    }
  },

  startProxy: async () => {
    try {
      await window.api.proxy.startGlobal()
      await get().fetchProxyState()
    } catch (error) {
      console.error('Failed to start proxy:', error)
    }
  },

  stopProxy: async () => {
    try {
      await window.api.proxy.stopGlobal()
      await get().fetchProxyState()
    } catch (error) {
      console.error('Failed to stop proxy:', error)
    }
  },

  // ==================== 平台管理 ====================

  fetchPlatforms: async () => {
    set({ loading: true })
    try {
      const platforms = await window.api.platform.getAll()
      set({ platforms, loading: false })
    } catch (error) {
      console.error('Failed to fetch platforms:', error)
      set({ loading: false })
    }
  },

  createPlatform: async (platformData) => {
    const platform = await window.api.platform.create(platformData)
    set((state) => ({
      platforms: [...state.platforms, platform]
    }))
    return platform
  },

  updatePlatform: async (id, updates) => {
    await window.api.platform.update(id, updates)
    set((state) => ({
      platforms: state.platforms.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      )
    }))
  },

  deletePlatform: async (id) => {
    await window.api.platform.delete(id)
    set((state) => ({
      platforms: state.platforms.filter((p) => p.id !== id),
      logs: state.logs.filter((l) => l.platformId !== id)
    }))
  },

  // ==================== 日志管理 ====================

  fetchLogs: async (limit = 200) => {
    try {
      const logs = await window.api.log.getAll(limit)
      set({ logs })
    } catch (error) {
      console.error('Failed to fetch logs:', error)
    }
  },

  clearLogs: async (platformId?: string) => {
    await window.api.log.clear(platformId)
    set((state) => ({
      logs: platformId
        ? state.logs.filter((l) => l.platformId !== platformId)
        : []
    }))
  },

  exportLogs: async (format) => {
    return await window.api.log.export(format)
  },

  // ==================== 实时请求管理 ====================

  addActiveRequest: (event, platformName) => {
    // 解析 start 事件中的请求信息
    let method = 'POST'
    let path = '/v1/messages'
    if (event.content) {
      try {
        const requestData = JSON.parse(event.content)
        method = requestData.method || 'POST'
        path = requestData.path || '/v1/messages'
      } catch {
        // ignore parse error
      }
    }

    const activeRequest: ActiveRequest = {
      requestId: event.requestId,
      platformId: event.platformId,
      platformName,
      method,
      path,
      startTime: event.timestamp,
      rawContent: [],
      status: 'pending'
    }

    set((state) => ({
      activeRequests: [activeRequest, ...state.activeRequests]
    }))
  },

  updateActiveRequest: (event) => {
    set((state) => {
      const requestIndex = state.activeRequests.findIndex(
        (r) => r.requestId === event.requestId
      )

      if (requestIndex === -1) {
        // 请求不在活跃列表中（可能已被用户中止或已结束），忽略此事件
        return state
      }

      const updatedRequests = [...state.activeRequests]
      const request = { ...updatedRequests[requestIndex] }

      if (event.type === 'delta' && event.content) {
        request.rawContent = [...request.rawContent, event.content]
        request.status = 'streaming'
      } else if (event.type === 'error') {
        request.status = 'error'
        if (event.content) {
          request.rawContent = [...request.rawContent, `ERROR: ${event.content}`]
        }
      }

      updatedRequests[requestIndex] = request
      return { activeRequests: updatedRequests }
    })
  },

  removeActiveRequest: (requestId) => {
    set((state) => ({
      activeRequests: state.activeRequests.filter((r) => r.requestId !== requestId)
    }))
  },

  abortRequest: async (requestId) => {
    try {
      const result = await window.api.proxy.abortRequest(requestId)
      if (result) {
        // 立即移除活动请求
        set((state) => ({
          activeRequests: state.activeRequests.filter((r) => r.requestId !== requestId)
        }))
      }
      return result
    } catch (error) {
      console.error('Failed to abort request:', error)
      return false
    }
  },

  // ==================== 流事件订阅 ====================

  subscribeToStream: () => {
    console.log('[Store] subscribeToStream called')
    const unsubscribe = window.api.proxy.onStream((event: StreamEvent) => {
      console.log('[Store] Received stream event:', event.type, event.requestId)
      const state = get()

      if (event.type === 'start') {
        // 新请求开始
        const platformName = getPlatformName(state.platforms, event.platformId)
        get().addActiveRequest(event, platformName)
      } else if (event.type === 'delta' || event.type === 'error') {
        // 更新请求内容
        get().updateActiveRequest(event)
      } else if (event.type === 'end') {
        // 请求结束，延迟移除并刷新日志
        setTimeout(() => {
          get().removeActiveRequest(event.requestId)
          get().fetchLogs()
        }, 500)
      }
    })

    return unsubscribe
  }
}))

// 导出别名以保持兼容性
export const usePlatformStore = useLogStore
