// 平台协议类型
export type ProtocolType = 'openai' | 'anthropic'

// 平台配置
export interface Platform {
  id: string
  name: string
  protocol: ProtocolType
  baseUrl: string
  apiKey?: string  // 可选，如果不配置则直接转发客户端的请求头
  localPort: number
  localPath?: string
  enabled: boolean
  createdAt: number
  updatedAt: number
}

// 代理状态
export type ProxyStatus = 'idle' | 'running' | 'error' | 'stopped'

// 平台代理信息
export interface PlatformProxy {
  platformId: string
  status: ProxyStatus
  localUrl: string
  requestCount: number
  lastRequestAt?: number
}

// 请求日志
export interface RequestLog {
  id: string
  platformId: string
  baseUrl: string
  method: string
  path: string
  requestHeaders?: Record<string, string>
  requestBody?: string
  responseStatus: number
  responseHeaders?: Record<string, string>
  responseBody?: string
  duration: number
  isStream: boolean
  error?: string
  createdAt: number
}

// 流式输出事件
export interface StreamEvent {
  platformId: string
  requestId: string
  type: 'start' | 'delta' | 'end' | 'error'
  content?: string
  timestamp: number
}

// IPC 通道名称
export const IPC_CHANNELS = {
  // 平台管理
  PLATFORM_GET_ALL: 'platform:getAll',
  PLATFORM_GET: 'platform:get',
  PLATFORM_CREATE: 'platform:create',
  PLATFORM_UPDATE: 'platform:update',
  PLATFORM_DELETE: 'platform:delete',
  PLATFORM_TOGGLE: 'platform:toggle',

  // 代理服务
  PROXY_START: 'proxy:start',
  PROXY_STOP: 'proxy:stop',
  PROXY_STATUS: 'proxy:status',
  PROXY_STREAM: 'proxy:stream',

  // 日志
  LOG_GET_ALL: 'log:getAll',
  LOG_GET_BY_PLATFORM: 'log:getByPlatform',
  LOG_CLEAR: 'log:clear',
  LOG_EXPORT: 'log:export',

  // 设置
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set'
} as const

// 应用设置
export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  logRetentionDays: number
  basePort: number
  autoStart: boolean
  minimizeToTray: boolean
}

// 默认设置
export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  logRetentionDays: 7,
  basePort: 3100,
  autoStart: false,
  minimizeToTray: true
}
