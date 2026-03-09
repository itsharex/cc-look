# IPC API 文档

## 概述

CC Look 使用 Electron 的 IPC (Inter-Process Communication) 机制在渲染进程和主进程之间通信。渲染进程通过 `window.api` 对象调用主进程方法。

## 基础 API

### invoke(channel, ...args)

调用主进程方法并返回 Promise。

```typescript
const result = await window.api.invoke('channel:name', arg1, arg2)
```

### on(channel, callback)

监听主进程发送的事件。

```typescript
window.api.on('channel:name', (data) => {
  console.log('Received:', data)
})
```

### removeListener(channel, callback)

移除事件监听器。

```typescript
const handler = (data) => console.log(data)
window.api.on('channel:name', handler)
// 稍后移除
window.api.removeListener('channel:name', handler)
```

---

## 平台管理 API

### platform:getAll

获取所有平台配置。

**返回值**: `Platform[]`

```typescript
const platforms = await window.api.invoke('platform:getAll')
// [
//   {
//     id: 'xxx',
//     name: 'OpenAI',
//     protocol: 'openai',
//     baseUrl: 'https://api.openai.com',
//     pathPrefix: '/openai',
//     enabled: true,
//     createdAt: 1234567890,
//     updatedAt: 1234567890
//   }
// ]
```

### platform:get

获取单个平台配置。

**参数**:
- `id: string` - 平台 ID

**返回值**: `Platform | null`

```typescript
const platform = await window.api.invoke('platform:get', 'platform-id')
```

### platform:create

创建新平台。

**参数**:
- `data: Omit<Platform, 'id' | 'createdAt' | 'updatedAt'>`

**返回值**: `Platform`

```typescript
const platform = await window.api.invoke('platform:create', {
  name: 'My Platform',
  protocol: 'openai',
  baseUrl: 'https://api.example.com',
  pathPrefix: '/my-platform',
  enabled: true
})
```

### platform:update

更新平台配置。

**参数**:
- `id: string` - 平台 ID
- `updates: Partial<Platform>`

**返回值**: `Platform | null`

```typescript
const platform = await window.api.invoke('platform:update', 'platform-id', {
  name: 'New Name',
  baseUrl: 'https://new-url.com'
})
```

### platform:delete

删除平台。

**参数**:
- `id: string` - 平台 ID

**返回值**: `boolean`

```typescript
const success = await window.api.invoke('platform:delete', 'platform-id')
```

### platform:toggle

切换平台启用状态。

**参数**:
- `id: string` - 平台 ID
- `enabled: boolean`

**返回值**: `Platform | null`

```typescript
const platform = await window.api.invoke('platform:toggle', 'platform-id', false)
```

---

## 代理服务 API

### proxy:start

启动代理服务器。

**返回值**: `boolean` - 是否启动成功

```typescript
const success = await window.api.invoke('proxy:start')
```

### proxy:stop

停止代理服务器。

**返回值**: `boolean` - 是否停止成功

```typescript
const success = await window.api.invoke('proxy:stop')
```

### proxy:status

获取代理服务状态。

**返回值**: `{ isRunning: boolean, port: number }`

```typescript
const status = await window.api.invoke('proxy:status')
// { isRunning: true, port: 3100 }
```

### proxy:stream (事件)

流式响应事件，由主进程发送。

**事件数据**: `StreamEvent`

```typescript
interface StreamEvent {
  platformId: string
  requestId: string
  type: 'start' | 'delta' | 'end' | 'error'
  content?: string
  timestamp: number
}

window.api.on('proxy:stream', (event: StreamEvent) => {
  switch (event.type) {
    case 'start':
      console.log('Request started:', event.requestId)
      break
    case 'delta':
      console.log('Received chunk:', event.content)
      break
    case 'end':
      console.log('Request completed:', event.requestId)
      break
    case 'error':
      console.error('Request failed:', event.content)
      break
  }
})
```

---

## 日志 API

### log:getAll

获取所有日志。

**参数**:
- `limit?: number` - 返回数量限制，默认 100
- `offset?: number` - 偏移量，默认 0

**返回值**: `RequestLog[]`

```typescript
const logs = await window.api.invoke('log:getAll', 50, 0)
```

### log:getByPlatform

获取指定平台的日志。

**参数**:
- `platformId: string`
- `limit?: number` - 默认 100
- `offset?: number` - 默认 0

**返回值**: `RequestLog[]`

```typescript
const logs = await window.api.invoke('log:getByPlatform', 'platform-id', 100, 0)
```

### log:clear

清除日志。

**参数**:
- `platformId?: string` - 可选，指定平台则只清除该平台日志

**返回值**: `boolean`

```typescript
// 清除所有日志
await window.api.invoke('log:clear')

// 清除指定平台日志
await window.api.invoke('log:clear', 'platform-id')
```

### log:export

导出日志。

**参数**:
- `format: 'json' | 'csv'`
- `platformId?: string` - 可选，指定平台

**返回值**: `string` - 日志内容

```typescript
const jsonLogs = await window.api.invoke('log:export', 'json')
const csvLogs = await window.api.invoke('log:export', 'csv', 'platform-id')
```

---

## 设置 API

### settings:get

获取应用设置。

**返回值**: `AppSettings`

```typescript
interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  logRetentionDays: number
  proxyPort: number
  autoStart: boolean
  minimizeToTray: boolean
  floatingWindow: boolean
}

const settings = await window.api.invoke('settings:get')
```

### settings:set

保存应用设置。

**参数**:
- `settings: Partial<AppSettings>`

**返回值**: `AppSettings` - 更新后的完整设置

```typescript
const settings = await window.api.invoke('settings:set', {
  theme: 'dark',
  proxyPort: 3200,
  floatingWindow: true
})
```

---

## 类型定义

详见 `src/shared/types.ts`。

```typescript
// 平台协议类型
type ProtocolType = 'openai' | 'anthropic'

// 平台配置
interface Platform {
  id: string
  name: string
  protocol: ProtocolType
  baseUrl: string
  pathPrefix: string
  enabled: boolean
  createdAt: number
  updatedAt: number
}

// 代理状态
type ProxyStatus = 'idle' | 'running' | 'error' | 'stopped'

// 请求日志
interface RequestLog {
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
  streamData?: string
  duration: number
  isStream: boolean
  inputTokens?: number
  outputTokens?: number
  cacheReadInputTokens?: number
  firstTokenTime?: number
  tokensPerSecond?: number
  error?: string
  createdAt: number
}

// 流式事件
interface StreamEvent {
  platformId: string
  requestId: string
  type: 'start' | 'delta' | 'end' | 'error'
  content?: string
  timestamp: number
}

// 应用设置
interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  logRetentionDays: number
  proxyPort: number
  autoStart: boolean
  minimizeToTray: boolean
  floatingWindow: boolean
}
```
