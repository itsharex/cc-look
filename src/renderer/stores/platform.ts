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

interface LogState {
  platforms: Platform[]
  logs: RequestLog[]
  activeRequests: ActiveRequest[]
  loading: boolean

  // 平台管理
  fetchPlatforms: () => Promise<void>
  createPlatform: (platform: Omit<Platform, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Platform>
  updatePlatform: (id: string, updates: Partial<Platform>) => Promise<void>
  deletePlatform: (id: string) => Promise<void>

  // 代理服务
  startProxy: (platformId: string) => Promise<void>
  stopProxy: (platformId: string) => Promise<void>
  getProxyStatus: (platformId: string) => Promise<{ status: string; localUrl: string } | null>
  proxyStatuses: Map<string, { status: string; localUrl: string }>

  // 日志管理
  fetchLogs: (limit?: number) => Promise<void>
  clearLogs: (platformId?: string) => Promise<void>
  exportLogs: (format: 'json' | 'csv') => Promise<string>

  // 实时请求管理
  addActiveRequest: (event: StreamEvent, platformName: string) => void
  updateActiveRequest: (event: StreamEvent) => void
  removeActiveRequest: (requestId: string) => void

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
  proxyStatuses: new Map(),

  // ==================== 平台管理 ====================

  fetchPlatforms: async () => {
    set({ loading: true })
    try {
      const platforms = await window.api.platform.getAll()
      set({ platforms, loading: false })

      // 获取所有平台的代理状态
      for (const platform of platforms) {
        get().getProxyStatus(platform.id)
      }
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
      logs: state.logs.filter((l) => l.platformId !== id),
      proxyStatuses: new Map([...state.proxyStatuses].filter(([k]) => k !== id))
    }))
  },

  // ==================== 代理服务 ====================

  startProxy: async (platformId) => {
    await window.api.proxy.start(platformId)
    await get().getProxyStatus(platformId)
  },

  stopProxy: async (platformId) => {
    await window.api.proxy.stop(platformId)
    await get().getProxyStatus(platformId)
  },

  getProxyStatus: async (platformId) => {
    try {
      const status = await window.api.proxy.status(platformId)
      set((state) => {
        const newStatuses = new Map(state.proxyStatuses)
        if (status) {
          newStatuses.set(platformId, { status: status.status, localUrl: status.localUrl || '' })
        } else {
          newStatuses.set(platformId, { status: 'stopped', localUrl: '' })
        }
        return { proxyStatuses: newStatuses }
      })
    } catch (error) {
      console.error('Failed to get proxy status:', error)
    }
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
        // 如果找不到，可能是新请求，添加它
        const platformName = getPlatformName(state.platforms, event.platformId)
        return {
          activeRequests: [
            {
              requestId: event.requestId,
              platformId: event.platformId,
              platformName,
              method: 'POST',
              path: '/v1/messages',
              startTime: event.timestamp,
              rawContent: event.content ? [event.content] : [],
              status: event.type === 'error' ? 'error' : 'streaming'
            },
            ...state.activeRequests
          ]
        }
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
