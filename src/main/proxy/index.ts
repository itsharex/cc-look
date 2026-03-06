import express, { type Request, type Response } from 'express'
import { type BrowserWindow } from 'electron'
import { type Platform, type StreamEvent } from '@shared/types'
import { v4 as uuidv4 } from 'uuid'
import * as http from 'http'
import * as https from 'https'
import * as zlib from 'zlib'
import * as net from 'net'
import * as db from '../database'
import { sendStreamEvent } from '../ipc'

interface ProxyInstance {
  platform: Platform
  server: http.Server
  port: number
}

export class ProxyManager {
  private proxies: Map<string, ProxyInstance> = new Map()

  // 检查端口是否可用
  private isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const tester = net.createServer()
        .once('error', () => resolve(false))
        .once('listening', () => {
          tester.once('close', () => resolve(true)).close()
        })
        .listen(port)
    })
  }

  // 强制关闭占用端口的进程
  private async killPortProcess(port: number): Promise<boolean> {
    // 先检查是否是我们自己的代理占用的端口
    for (const [id, instance] of this.proxies) {
      if (instance.port === port) {
        this.stop(id)
        console.log(`[Proxy] 已停止占用端口 ${port} 的代理`)
        return true
      }
    }

    // 如果不是我们的代理，等待端口释放
    const available = await this.isPortAvailable(port)
    if (available) {
      return true
    }

    console.error(`[Proxy] 端口 ${port} 被其他进程占用`)
    return false
  }

  async start(platform: Platform, mainWindow: BrowserWindow | null): Promise<boolean> {
    // 如果已有该平台的代理，先停止
    if (this.proxies.has(platform.id)) {
      this.stop(platform.id)
    }

    // 检查并释放端口
    const portReady = await this.killPortProcess(platform.localPort)
    if (!portReady) {
      console.error(`[Proxy] 端口 ${platform.localPort} 不可用`)
      return false
    }

    const app = express()
    app.use(express.json({ limit: '10mb' }))

    app.use((req: Request, res: Response, next) => {
      ;(req as any).startTime = Date.now()
      ;(req as any).requestBody = req.body
      ;(req as any).requestId = uuidv4()
      console.log(`[Proxy] ${platform.name} - 收到请求: ${req.method} ${req.path}`)
      next()
    })

    app.all('*', async (req: Request, res: Response) => {
      await this.handleRequest(platform, req, res, mainWindow)
    })

    app.get('/health', (_req: Request, res: Response) => {
      res.json({ status: 'ok', platform: platform.name, timestamp: Date.now() })
    })

    app.use((_req: Request, res: Response) => {
      res.status(404).json({ error: 'Not found' })
    })

    return new Promise((resolve) => {
      const server = app.listen(platform.localPort, () => {
        console.log(`[Proxy] ${platform.name} 监听端口 ${platform.localPort}`)
        server.timeout = 120000
        server.keepAliveTimeout = 65000
        this.proxies.set(platform.id, { platform, server, port: platform.localPort })
        resolve(true)
      })

      server.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`[Proxy] 端口 ${platform.localPort} 已被占用`)
        } else {
          console.error(`[Proxy] 启动 ${platform.name} 失败:`, error)
        }
        resolve(false)
      })
    })
  }

  stop(platformId: string): boolean {
    const instance = this.proxies.get(platformId)
    if (!instance) return false

    try {
      instance.server.close()
      this.proxies.delete(platformId)
      console.log(`[Proxy] 已停止 ${instance.platform.name}`)
      return true
    } catch (error) {
      console.error(`[Proxy] 停止失败:`, error)
      return false
    }
  }

  getStatus(platformId: string) {
    const instance = this.proxies.get(platformId)
    if (!instance) {
      return { platformId, status: 'stopped', localUrl: '' }
    }
    return {
      platformId,
      status: 'running',
      localUrl: `http://localhost:${instance.port}`
    }
  }

  private async handleRequest(
    platform: Platform,
    req: Request,
    res: Response,
    mainWindow: BrowserWindow | null
  ): Promise<void> {
    const startTime = (req as any).startTime || Date.now()
    const requestBody = (req as any).requestBody
    const requestId = (req as any).requestId || uuidv4()

    // 发送请求开始事件
    sendStreamEvent(mainWindow, {
      platformId: platform.id,
      requestId,
      type: 'start',
      timestamp: Date.now(),
      content: JSON.stringify({
        method: req.method,
        path: req.path,
        body: requestBody
      })
    })

    // 构建目标 URL（包含 localPath 前缀）
    const pathPrefix = platform.localPath || ''
    const fullPath = `${pathPrefix}${req.path}`
    const targetUrl = `${platform.baseUrl}${fullPath}`
    console.log(`[Proxy] ${platform.name} - 原始路径: ${req.path}, localPath: ${pathPrefix || '(空)'}, 完整路径: ${fullPath}`)
    console.log(`[Proxy] ${platform.name} - 转发到: ${targetUrl}`)

    const url = new URL(targetUrl)
    const isHttps = url.protocol === 'https:'
    const httpModule = isHttps ? https : http

    // 准备请求头 - 直接转发客户端的所有请求头
    const headers: Record<string, string> = {}

    // 复制原始请求头，排除一些 hop-by-hop 头和可能导致问题的头
    const excludedHeaders = ['host', 'content-length', 'connection', 'keep-alive', 'transfer-encoding', 'accept-encoding']
    for (const [key, value] of Object.entries(req.headers)) {
      if (!excludedHeaders.includes(key.toLowerCase())) {
        headers[key] = Array.isArray(value) ? value.join(', ') : (value as string)
      }
    }

    // 确保有必要的头
    if (!headers['content-type']) {
      headers['Content-Type'] = 'application/json'
    }
    if (!headers['accept']) {
      headers['Accept'] = 'application/json, text/event-stream'
    }

    // 准备请求体并设置 Content-Length
    let bodyString: string | undefined
    if (requestBody && Object.keys(requestBody).length > 0) {
      bodyString = JSON.stringify(requestBody)
      headers['Content-Length'] = Buffer.byteLength(bodyString).toString()
    }

    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: req.method,
      headers
    }

    const proxyReq = httpModule.request(options, (proxyRes) => {
      const duration = Date.now() - startTime
      const statusCode = proxyRes.statusCode || 0
      const contentType = proxyRes.headers['content-type'] || ''
      const isStream = contentType.includes('text/event-stream')

      console.log(`[Proxy] ${platform.name} - 收到响应: ${statusCode} (${contentType})`)

      const responseHeaders: Record<string, string> = {}
      for (const [key, value] of Object.entries(proxyRes.headers)) {
        if (value) {
          responseHeaders[key] = Array.isArray(value) ? value.join(', ') : value
          res.setHeader(key, responseHeaders[key])
        }
      }

      if (isStream) {
        this.handleStreamResponse(platform, req, res, proxyRes, mainWindow, requestId, responseHeaders, duration, headers)
      } else {
        const chunks: Buffer[] = []
        proxyRes.on('data', (chunk) => chunks.push(chunk))
        proxyRes.on('end', () => {
          const buffer = Buffer.concat(chunks)

          // 检查是否是压缩的响应，如果是则不尝试解析为文本
          const contentEncoding = (proxyRes.headers['content-encoding'] || '').toLowerCase()
          const isCompressed = ['gzip', 'deflate', 'br'].some(enc => contentEncoding.includes(enc))

          // 只有未压缩的响应才转换为文本记录日志
          const responseBody = isCompressed ? `[压缩数据 ${buffer.length} bytes]` : buffer.toString('utf-8')

          this.createLog(platform, req, statusCode, responseBody, responseHeaders, duration, false, undefined, headers)

          // 发送原始 buffer 给客户端
          res.status(statusCode).send(buffer)

          // 发送结束事件
          sendStreamEvent(mainWindow, {
            platformId: platform.id,
            requestId,
            type: 'end',
            timestamp: Date.now()
          })
        })
        proxyRes.on('error', (err) => {
          console.error(`[Proxy] 响应错误:`, err)
          this.createLog(platform, req, statusCode, undefined, responseHeaders, duration, false, err.message, headers)
          sendStreamEvent(mainWindow, {
            platformId: platform.id,
            requestId,
            type: 'error',
            content: err.message,
            timestamp: Date.now()
          })
        })
      }
    })

    proxyReq.on('error', (err) => {
      const duration = Date.now() - startTime
      console.error(`[Proxy] 请求错误:`, err.message)
      this.createLog(platform, req, 0, undefined, {}, duration, false, err.message, headers)

      sendStreamEvent(mainWindow, {
        platformId: platform.id,
        requestId,
        type: 'error',
        content: err.message,
        timestamp: Date.now()
      })

      if (!res.headersSent) {
        res.status(500).json({ error: 'Proxy error', message: err.message })
      }
    })

    proxyReq.setTimeout(120000, () => {
      console.error(`[Proxy] 请求超时`)
      proxyReq.destroy(new Error('Request timeout'))
    })

    if (requestBody && Object.keys(requestBody).length > 0) {
      const bodyString = JSON.stringify(requestBody)
      // 设置正确的 Content-Length
      headers['Content-Length'] = Buffer.byteLength(bodyString).toString()
      proxyReq.write(bodyString)
    }
    proxyReq.end()
  }

  private handleStreamResponse(
    platform: Platform,
    req: Request,
    res: Response,
    proxyRes: http.IncomingMessage,
    mainWindow: BrowserWindow | null,
    requestId: string,
    responseHeaders: Record<string, string>,
    duration: number,
    requestHeaders: Record<string, string>
  ): void {
    let fullContent = ''
    let sseBuffer = ''
    const chunks: Buffer[] = []

    // 检查是否是压缩的响应
    const contentEncoding = (proxyRes.headers['content-encoding'] || '').toLowerCase()
    const isCompressed = ['gzip', 'deflate', 'br'].some(enc => contentEncoding.includes(enc))

    console.log(`[Proxy] ${platform.name} - 开始流式响应 (压缩: ${isCompressed})`)

    // 创建解压流
    let decompressStream: NodeJS.ReadWriteStream
    if (contentEncoding.includes('gzip')) {
      decompressStream = zlib.createGunzip()
    } else if (contentEncoding.includes('deflate')) {
      decompressStream = zlib.createInflate()
    } else if (contentEncoding.includes('br')) {
      decompressStream = zlib.createBrotliDecompress()
    } else {
      decompressStream = null as any// 不需要解压
    }

    // 处理解压后的数据（用于日志和SSE事件）
    const processDecompressedData = (data: string) => {
      fullContent += data
      sseBuffer += data

      // 解析 SSE 行
      const lines = sseBuffer.split('\n')
      sseBuffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const content = line.slice(6).trim()
          sendStreamEvent(mainWindow, {
            platformId: platform.id,
            requestId,
            type: 'delta',
            content,
            timestamp: Date.now()
          })
        } else if (line.trim() && !line.startsWith(':')) {
          sendStreamEvent(mainWindow, {
            platformId: platform.id,
            requestId,
            type: 'delta',
            content: line,
            timestamp: Date.now()
          })
        }
      }
    }

    if (isCompressed && decompressStream) {
      // 压缩响应：解压后处理文本，转发原始压缩数据
      decompressStream.on('data', (chunk: Buffer) => {
        processDecompressedData(chunk.toString('utf-8'))
      })

      proxyRes.on('data', (chunk: Buffer) => {
        chunks.push(chunk)
        decompressStream.write(chunk)
        res.write(chunk)
      })

      proxyRes.on('end', () => {
        decompressStream.end()
      })

      decompressStream.on('end', () => {
        console.log(`[Proxy] ${platform.name} - 流式响应结束`)
        this.createLog(platform, req, proxyRes.statusCode || 0, fullContent.slice(0, 50000), responseHeaders, duration, true, undefined, requestHeaders)

        sendStreamEvent(mainWindow, {
          platformId: platform.id,
          requestId,
          type: 'end',
          timestamp: Date.now()
        })

        res.end()
      })

      decompressStream.on('error', (err) => {
        console.error(`[Proxy] 解压错误:`, err)
        // 解压失败时，至少记录原始数据大小
        const totalBytes = chunks.reduce((sum, c) => sum + c.length, 0)
        this.createLog(platform, req, proxyRes.statusCode || 0, `[解压失败，原始数据 ${totalBytes} bytes]`, responseHeaders, duration, true, undefined, requestHeaders)

        sendStreamEvent(mainWindow, {
          platformId: platform.id,
          requestId,
          type: 'end',
          timestamp: Date.now()
        })

        res.end()
      })
    } else {
      // 未压缩响应：直接处理
      proxyRes.on('data', (chunk: Buffer) => {
        const data = chunk.toString('utf-8')
        processDecompressedData(data)
        res.write(chunk)
      })

      proxyRes.on('end', () => {
        console.log(`[Proxy] ${platform.name} - 流式响应结束`)
        this.createLog(platform, req, proxyRes.statusCode || 0, fullContent.slice(0, 50000), responseHeaders, duration, true, undefined, requestHeaders)

        sendStreamEvent(mainWindow, {
          platformId: platform.id,
          requestId,
          type: 'end',
          timestamp: Date.now()
        })

        res.end()
      })
    }

    proxyRes.on('error', (err) => {
      console.error(`[Proxy] 流式响应错误:`, err)
      this.createLog(platform, req, proxyRes.statusCode || 0, fullContent.slice(0, 50000), responseHeaders, duration, true, err.message, requestHeaders)

      sendStreamEvent(mainWindow, {
        platformId: platform.id,
        requestId,
        type: 'error',
        content: err.message,
        timestamp: Date.now()
      })
    })
  }

  private createLog(
    platform: Platform,
    req: Request,
    responseStatus: number,
    responseBody: string | undefined,
    responseHeaders: Record<string, string>,
    duration: number,
    isStream: boolean,
    error?: string,
    filteredHeaders?: Record<string, string>
  ): void {
    try {
      const requestBody = (req as any).requestBody
      const pathPrefix = platform.localPath || ''
      const fullPath = `${pathPrefix}${req.path}`

      // 使用过滤后的请求头（如果提供）
      const requestHeaders = filteredHeaders || {}

      console.log(`[Proxy Debug] baseUrl: ${platform.baseUrl}`)
      console.log(`[Proxy Debug] localPath: ${platform.localPath || '(empty)'}`)
      console.log(`[Proxy Debug] req.path: ${req.path}`)
      console.log(`[Proxy Debug] fullPath: ${fullPath}`)

      db.createLog({
        platformId: platform.id,
        baseUrl: platform.baseUrl,
        method: req.method || 'GET',
        path: fullPath,
        requestHeaders,
        requestBody: requestBody ? JSON.stringify(requestBody, null, 2) : undefined,
        responseStatus,
        responseHeaders,
        responseBody,
        duration,
        isStream,
        error
      })

      console.log(`[Proxy] ${platform.name} - 日志已创建: ${req.method} ${fullPath} -> ${responseStatus} (${duration}ms)`)
    } catch (err) {
      console.error(`[Proxy] 创建日志失败:`, err)
    }
  }
}
