# CC Look 架构设计文档

## 概述

CC Look 是一个基于 Electron 的本地 AI API 代理软件，支持多平台 AI API 监控与调试。采用现代化的前端技术栈和模块化的后端设计。

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Electron | ^33.2.1 | 跨平台桌面应用框架 |
| React | ^19.0.0 | 前端 UI 框架 |
| TypeScript | ^5.7.2 | 类型安全 |
| Vite | ^5.4.11 | 构建工具 |
| electron-vite | ^2.3.0 | Electron 构建集成 |
| TailwindCSS | ^3.4.17 | 样式方案 |
| Zustand | ^5.0.2 | 状态管理 |
| Express | ^4.21.2 | 本地代理服务器 |
| sql.js | ^1.14.1 | 本地数据库 (SQLite) |

## 项目结构

```
cc-look/
├── src/
│   ├── main/                 # Electron 主进程
│   │   ├── index.ts         # 主进程入口
│   │   ├── ipc/             # IPC 通信处理
│   │   │   └── index.ts     # IPC 处理器注册
│   │   ├── database/        # 数据存储层
│   │   │   └── index.ts     # SQLite 数据库操作
│   │   ├── proxy/           # 代理服务
│   │   │   └── index.ts     # ProxyManager 类
│   │   └── floatingWindow.ts # 浮动窗口管理
│   │
│   ├── renderer/            # React 前端
│   │   ├── index.html       # 入口 HTML
│   │   ├── main.tsx         # React 入口
│   │   ├── App.tsx          # 根组件
│   │   ├── pages/           # 页面组件
│   │   │   ├── Platforms.tsx # 平台管理页
│   │   │   ├── Logs.tsx     # 日志查看页
│   │   │   └── Settings.tsx # 设置页
│   │   ├── components/      # UI 组件
│   │   │   └── Sidebar.tsx  # 侧边栏
│   │   ├── stores/          # 状态管理
│   │   │   └── platform.ts  # Zustand store
│   │   └── styles/          # 样式文件
│   │       └── index.css
│   │
│   ├── preload/             # 预加载脚本
│   │   ├── index.ts         # 主窗口预加载
│   │   └── floating.ts      # 浮动窗口预加载
│   │
│   └── shared/              # 共享代码
│       ├── types.ts         # 类型定义
│       └── constants.ts     # 常量
│
├── resources/               # 资源文件
│   └── icon.png            # 应用图标
│
├── .github/                 # GitHub 配置
│   └── workflows/
│       └── release.yml      # 自动发布 workflow
│
├── package.json
├── electron.vite.config.ts  # Vite 配置
├── tailwind.config.cjs
└── tsconfig.json
```

## 核心模块

### 1. 主进程 (Main Process)

主进程负责：
- 创建和管理应用窗口
- 运行本地代理服务器
- 处理数据库操作
- 处理 IPC 通信

#### ProxyManager

代理服务核心类，负责：
- 启动/停止 Express 代理服务器
- 路由请求到对应的 AI 平台
- 处理流式响应 (SSE)
- 记录请求/响应日志
- 发送实时事件到渲染进程

```typescript
// 单端口多路径架构
// 所有平台共用一个端口 (默认 3100)
// 通过 pathPrefix 区分不同平台
// 例如：
// - http://localhost:3100/openai/v1/chat/completions
// - http://localhost:3100/claude/v1/messages
```

### 2. 渲染进程 (Renderer Process)

渲染进程是 React 应用，负责：
- 用户界面展示
- 用户交互处理
- 通过 IPC 与主进程通信

#### 页面结构

| 页面 | 路由 | 功能 |
|------|------|------|
| Platforms | platforms | 平台管理，添加/编辑/删除 AI 平台配置 |
| Logs | logs | 查看请求日志，支持筛选和导出 |
| Settings | settings | 应用设置，主题/端口/自启动等 |

### 3. 预加载脚本 (Preload)

预加载脚本通过 `contextBridge` 暴露安全的 API 给渲染进程：

```typescript
// 主窗口 API
window.api.invoke(channel, ...args)
window.api.on(channel, callback)
window.api.removeListener(channel, callback)

// 浮动窗口 API
window.floatingApi.onContent(callback)
```

### 4. 数据库 (Database)

使用 sql.js (SQLite 的 JavaScript 实现) 存储数据：

#### 表结构

**platforms 表**
```sql
CREATE TABLE platforms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  protocol TEXT NOT NULL,      -- 'openai' | 'anthropic'
  baseUrl TEXT NOT NULL,
  pathPrefix TEXT NOT NULL,    -- 路径前缀，如 /openai, /claude
  enabled INTEGER DEFAULT 1,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
)
```

**request_logs 表**
```sql
CREATE TABLE request_logs (
  id TEXT PRIMARY KEY,
  platformId TEXT NOT NULL,
  baseUrl TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  requestBody TEXT,
  requestHeaders TEXT,
  responseStatus INTEGER,
  responseBody TEXT,
  responseHeaders TEXT,
  streamData TEXT,             -- 汇总的流式数据
  duration INTEGER,
  isStream INTEGER DEFAULT 0,
  inputTokens INTEGER,
  outputTokens INTEGER,
  cacheReadInputTokens INTEGER,
  firstTokenTime INTEGER,
  tokensPerSecond REAL,
  error TEXT,
  createdAt INTEGER NOT NULL,
  FOREIGN KEY (platformId) REFERENCES platforms(id)
)
```

**settings 表**
```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
)
```

## 通信架构

### IPC 通道

渲染进程通过 IPC 与主进程通信：

```typescript
// 平台管理
'platform:getAll'     // 获取所有平台
'platform:get'        // 获取单个平台
'platform:create'     // 创建平台
'platform:update'     // 更新平台
'platform:delete'     // 删除平台
'platform:toggle'     // 切换启用状态

// 代理服务
'proxy:start'         // 启动代理
'proxy:stop'          // 停止代理
'proxy:status'        // 获取状态
'proxy:stream'        // 流式事件 (主进程 -> 渲染进程)

// 日志
'log:getAll'          // 获取所有日志
'log:getByPlatform'   // 获取平台日志
'log:clear'           // 清除日志
'log:export'          // 导出日志

// 设置
'settings:get'        // 获取设置
'settings:set'        // 保存设置
```

## 构建配置

使用 electron-vite 进行构建，支持多入口：

```typescript
// electron.vite.config.ts
{
  main: {
    input: 'src/main/index.ts'
  },
  preload: {
    input: {
      index: 'src/preload/index.ts',
      floating: 'src/preload/floating.ts'
    }
  },
  renderer: {
    input: {
      index: 'src/renderer/index.html',
      floating: 'src/renderer/floating.html'
    }
  }
}
```

## 数据流

```
用户操作
    ↓
React 组件
    ↓
Zustand Store
    ↓
IPC 调用 (window.api.invoke)
    ↓
主进程 IPC 处理器
    ↓
数据库操作 / 代理服务
    ↓
IPC 事件返回 (window.api.on)
    ↓
React 状态更新
    ↓
UI 重渲染
```

## 代理请求流程

```
客户端请求 → localhost:3100/openai/v1/chat/completions
                    ↓
           ProxyManager (Express)
                    ↓
         根据 pathPrefix 查找平台
                    ↓
         转发到实际 API (如 api.openai.com)
                    ↓
         接收响应 (支持 SSE 流式)
                    ↓
         ┌─────────┴─────────┐
         ↓                   ↓
    记录日志           发送事件到渲染进程
         ↓                   ↓
    SQLite 数据库      实时监控 UI 更新
```

## 浮动窗口

浮动窗口功能用于在桌面上实时显示 AI 输出内容：

- 独立的 BrowserWindow
- 透明/无边框样式
- 接收流式内容并实时显示
- 支持内容类型：文本、思考、工具调用

## 安全考虑

1. **Context Isolation**: 启用上下文隔离
2. **Node Integration**: 禁用 Node 集成
3. **Sandbox**: 预加载脚本不使用沙箱（以便访问 Node API）
4. **API Key 存储**: 存储在本地 SQLite，不上传服务器
5. **本地通信**: 所有代理通信都在本地进行
