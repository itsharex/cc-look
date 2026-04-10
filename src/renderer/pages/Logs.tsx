import { useEffect, useState, useRef } from 'react'
import { useLogStore, type ActiveRequest } from '../stores/platform'
import type { RequestLog } from '@shared/types'

const ResizablePanel = ({
  height,
  onResize,
  children,
  minHeight = 60,
  maxHeight = 600,
}: {
  height: number
  onResize: (h: number) => void
  children: React.ReactNode
  minHeight?: number
  maxHeight?: number
}) => {
  const [resizing, setResizing] = useState(false)
  const startYRef = useRef(0)
  const startHeightRef = useRef(0)
  const onResizeRef = useRef(onResize)

  useEffect(() => {
    onResizeRef.current = onResize
  }, [onResize])

  useEffect(() => {
    if (!resizing) return
    const handleMove = (e: MouseEvent) => {
      const delta = e.clientY - startYRef.current
      const newHeight = Math.max(minHeight, Math.min(maxHeight, startHeightRef.current + delta))
      onResizeRef.current(newHeight)
    }
    const handleUp = () => setResizing(false)
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [resizing, minHeight, maxHeight])

  return (
    <div className="relative" style={{ height }}>
      <div className="h-full overflow-auto bg-gray-900 text-gray-300 rounded-xl p-3 font-mono text-xs">{children}</div>
      <div
        onMouseDown={(e) => {
          startYRef.current = e.clientY
          startHeightRef.current = height
          setResizing(true)
        }}
        className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-primary-300/50 active:bg-primary-400/50 transition-colors rounded-b-xl"
      />
    </div>
  )
}

export default function Logs() {
  const {
    platforms,
    logs,
    activeRequests,
    loading,
    fetchPlatforms,
    fetchLogs,
    exportLogs,
    subscribeToStream,
    proxyStatuses,
    abortRequest
  } = useLogStore()

  const [selectedLog, setSelectedLog] = useState<RequestLog | ActiveRequest | null>(null)
  const [selectedType, setSelectedType] = useState<'active' | 'history'>('active')
  const [filter, setFilter] = useState({ platformId: '', status: '' })
  const [expandedActiveRequest, setExpandedActiveRequest] = useState<string | null>(null)
  const [expandedHeaders, setExpandedHeaders] = useState(false)
  const [detailWidth, setDetailWidth] = useState(384)
  const [isResizing, setIsResizing] = useState(false)
  const [heights, setHeights] = useState({
    activeRaw: 240,
    requestBody: 160,
    responseBody: 240,
    streamData: 240,
  })
  const logContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchPlatforms()
    fetchLogs()
    const unsubscribe = subscribeToStream()
    return () => { unsubscribe() }
  }, [fetchPlatforms, fetchLogs, subscribeToStream])

  useEffect(() => {
    if (expandedActiveRequest && logContainerRef.current) {
      const element = logContainerRef.current.querySelector(`#active-${expandedActiveRequest}`)
      if (element) {
        element.scrollTop = element.scrollHeight
      }
    }
  }, [activeRequests, expandedActiveRequest])

  useEffect(() => {
    if (!isResizing) return
    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX
      if (newWidth >= 280 && newWidth <= 800) {
        setDetailWidth(newWidth)
      }
    }
    const handleMouseUp = () => {
      setIsResizing(false)
    }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  const handleExport = async (format: 'json' | 'csv') => {
    const content = await exportLogs(format)
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logs_${new Date().toISOString().split('T')[0]}.${format}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatDuration = (ms: number) => {
    if (!ms) return '-'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const formatTokenSpeed = (tokensPerSecond: number | undefined | null) => {
    if (!tokensPerSecond) return '-'
    return `${tokensPerSecond.toFixed(1)} tok/s`
  }

  const formatFirstTokenTime = (ms: number | undefined | null) => {
    if (!ms) return '-'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-800'
    if (status >= 400 && status < 500) return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:ring-amber-800'
    if (status >= 500) return 'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-900/30 dark:text-red-400 dark:ring-red-800'
    return 'bg-gray-50 text-gray-700 ring-1 ring-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:ring-gray-600'
  }

  const formatJson = (str: string | undefined): string => {
    if (!str) return ''
    try {
      return JSON.stringify(JSON.parse(str), null, 2)
    } catch {
      return str
    }
  }

  const getPlatformName = (platformId: string) => {
    return platforms.find(p => p.id === platformId)?.name || 'Unknown'
  }

  const getProxyStatus = (platformId: string) => {
    return proxyStatuses.get(platformId)?.status || 'stopped'
  }

  const filteredLogs = logs.filter((log) => {
    if (filter.status === 'success' && (log.responseStatus < 200 || log.responseStatus >= 300)) return false
    if (filter.status === 'error' && log.responseStatus < 400) return false
    if (filter.platformId && log.platformId !== filter.platformId) return false
    return true
  })

  const renderActiveRequest = (request: ActiveRequest) => {
    const isExpanded = expandedActiveRequest === request.requestId
    const duration = Date.now() - request.startTime

    const handleAbort = async (e: React.MouseEvent) => {
      e.stopPropagation()
      if (confirm('确定要关闭此连接吗？')) {
        await abortRequest(request.requestId)
      }
    }

    return (
      <div
        key={request.requestId}
        id={`active-${request.requestId}`}
        className={`rounded-2xl overflow-hidden border-2 transition-all ${
          request.status === 'error'
            ? 'bg-red-50/50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
            : 'bg-amber-50/50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
        }`}
      >
        <div
          className="px-4 py-3.5 flex items-center justify-between cursor-pointer hover:bg-white/50 dark:hover:bg-gray-700/50 transition-colors"
          onClick={() => setExpandedActiveRequest(isExpanded ? null : request.requestId)}
        >
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${
              request.status === 'streaming' ? 'bg-emerald-500 animate-pulse' :
              request.status === 'error' ? 'bg-red-500' : 'bg-amber-500 animate-pulse'
            }`} />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">{request.platformName}</span>
                <span className="text-xs text-gray-400 font-mono">{request.method} {request.path}</span>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                进行中 · {formatDuration(duration)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAbort}
              className="px-2.5 py-1 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
            >
              关闭
            </button>
            <span className="text-[11px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">
              {request.rawContent.length} chunks
            </span>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-amber-200/50 dark:border-amber-800/50">
            <div className="px-4 py-2 bg-amber-100/50 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              实时 SSE 数据
            </div>
            <ResizablePanel
              height={heights.activeRaw}
              onResize={(h) => setHeights((prev) => ({ ...prev, activeRaw: h }))}
            >
              <div
                ref={logContainerRef}
                className="h-full"
              >
                {request.rawContent.length === 0 ? (
                  <div className="text-gray-500 text-center py-4">等待数据...</div>
                ) : (
                  request.rawContent.map((content, index) => (
                    <div key={index} className="mb-1">
                      <span className="text-gray-500">{index + 1}:</span>{' '}
                      <span className="text-emerald-400">{content}</span>
                    </div>
                  ))
                )}
              </div>
            </ResizablePanel>
          </div>
        )}
      </div>
    )
  }

  const renderHistoryLog = (log: RequestLog) => {
    const isSelected = selectedLog && selectedType === 'history' && (selectedLog as RequestLog).id === log.id

    return (
      <div
        key={log.id}
        onClick={() => {
          setSelectedLog(log)
          setSelectedType('history')
          setExpandedHeaders(false)
        }}
        className={`bg-white dark:bg-gray-800 rounded-xl p-3.5 border cursor-pointer transition-all ${
          isSelected
            ? 'border-primary-300 shadow-card-hover ring-1 ring-primary-100'
            : 'border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 hover:shadow-card'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`status-dot ${
              log.responseStatus >= 200 && log.responseStatus < 300 ? 'running' : 'stopped'
            }`} />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">{getPlatformName(log.platformId)}</span>
                <span className="text-xs text-gray-400 font-mono">{log.method} {log.path}</span>
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5">
                {new Date(log.createdAt).toLocaleString()} · {formatDuration(log.duration)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {(log.inputTokens || log.outputTokens) && (
              <span className="text-[11px] text-violet-600 bg-violet-50 dark:bg-violet-900/30 dark:text-violet-400 px-2 py-0.5 rounded-full font-medium ring-1 ring-violet-200 dark:ring-violet-800" title="输入/输出 tokens">
                {log.inputTokens || 0}/{log.outputTokens || 0}
              </span>
            )}
            {log.firstTokenTime && (
              <span className="text-[11px] text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium ring-1 ring-amber-200 dark:ring-amber-800" title="首 Token 时间">
                TTFT: {formatFirstTokenTime(log.firstTokenTime)}
              </span>
            )}
            {log.tokensPerSecond && (
              <span className="text-[11px] text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium ring-1 ring-emerald-200 dark:ring-emerald-800" title="输出速度">
                {formatTokenSpeed(log.tokensPerSecond)}
              </span>
            )}
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${getStatusColor(log.responseStatus)}`}>
              {log.responseStatus}
            </span>
            {log.isStream && (
              <span className="text-[11px] text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium ring-1 ring-blue-200 dark:ring-blue-800">Stream</span>
            )}
          </div>
        </div>
      </div>
    )
  }

  const renderDetailPanel = () => {
    if (!selectedLog) return null

    if (selectedType === 'active') {
      const request = selectedLog as ActiveRequest
      return (
        <div style={{ width: detailWidth }} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-elevated animate-slide-in-right flex flex-col">
          <div className="px-4 py-3.5 border-b border-gray-100 dark:border-gray-700 bg-amber-50/50 dark:bg-amber-900/20 flex items-center justify-between">
            <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">实时请求详情</span>
            <button
              onClick={() => setSelectedLog(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-4 flex-1 overflow-auto">
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-gray-400 text-[11px] uppercase tracking-wider font-medium">平台</div>
                <div className="font-medium mt-1">{request.platformName}</div>
              </div>
              <div>
                <div className="text-gray-400 text-[11px] uppercase tracking-wider font-medium">路径</div>
                <div className="font-mono text-xs mt-1">{request.method} {request.path}</div>
              </div>
              <div>
                <div className="text-gray-400 text-[11px] uppercase tracking-wider font-medium">持续时间</div>
                <div className="mt-1">{formatDuration(Date.now() - request.startTime)}</div>
              </div>
              <div>
                <div className="text-gray-400 text-[11px] uppercase tracking-wider font-medium mb-2">原始数据 ({request.rawContent.length} 条)</div>
                <ResizablePanel
                  height={heights.activeRaw}
                  onResize={(h) => setHeights((prev) => ({ ...prev, activeRaw: h }))}
                >
                  <div className="h-full">
                    {request.rawContent.map((content, index) => (
                      <div key={index} className="mb-1">
                        <span className="text-gray-500">[{index + 1}]</span> {content}
                      </div>
                    ))}
                  </div>
                </ResizablePanel>
              </div>
            </div>
          </div>
        </div>
      )
    }

    const log = selectedLog as RequestLog

    const generateCurl = (log: RequestLog): string => {
      const url = `${log.baseUrl}${log.path}`
      let curl = `curl '${url}'`
      if (log.method !== 'GET') {
        curl += ` \\\n  -X ${log.method}`
      }
      if (log.requestHeaders && Object.keys(log.requestHeaders).length > 0) {
        for (const [key, value] of Object.entries(log.requestHeaders)) {
          curl += ` \\\n  -H '${key}: ${value}'`
        }
      }
      if (log.requestBody) {
        const body = log.requestBody.replace(/'/g, "'\\''")
        curl += ` \\\n  -d '${body}'`
      }
      return curl
    }

    const copyCurl = (log: RequestLog) => {
      if (confirm('⚠️ 警告：请求包含密钥信息，请勿泄露给他人！\n\n确定要复制吗？')) {
        const curl = generateCurl(log)
        navigator.clipboard.writeText(curl)
      }
    }

    return (
      <div style={{ width: detailWidth }} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-elevated animate-slide-in-right flex flex-col">
        <div className="px-4 py-3.5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/50 flex items-center justify-between">
          <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">请求详情</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => copyCurl(log)}
              className="text-primary-600 hover:text-primary-700 text-xs flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-primary-50 transition-colors"
              title="复制 curl 命令"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span className="font-medium">curl</span>
            </button>
            <button
              onClick={() => setSelectedLog(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-4 text-sm">
            {/* 基本信息 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-gray-400 text-[11px] uppercase tracking-wider font-medium">平台</div>
                <div className="font-medium mt-1">{getPlatformName(log.platformId)}</div>
              </div>
              <div>
                <div className="text-gray-400 text-[11px] uppercase tracking-wider font-medium">状态码</div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 inline-block ${getStatusColor(log.responseStatus)}`}>
                  {log.responseStatus}
                </span>
              </div>
              <div>
                <div className="text-gray-400 text-[11px] uppercase tracking-wider font-medium">耗时</div>
                <div className="mt-1">{formatDuration(log.duration)}</div>
              </div>
              <div>
                <div className="text-gray-400 text-[11px] uppercase tracking-wider font-medium">时间</div>
                <div className="mt-1 text-xs">{new Date(log.createdAt).toLocaleString()}</div>
              </div>
            </div>

            {/* Token 统计 */}
            {(log.isStream || log.inputTokens || log.outputTokens) && (
              <div className="bg-violet-50/50 dark:bg-violet-900/20 rounded-xl p-3.5 ring-1 ring-violet-200/50 dark:ring-violet-800/50">
                <div className="text-violet-600 dark:text-violet-400 text-[11px] font-semibold uppercase tracking-wider mb-2.5">Token 统计</div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-violet-400 text-xs">输入 Tokens</div>
                    <div className="font-semibold text-violet-700 dark:text-violet-300 mt-0.5">{log.inputTokens ?? '-'}</div>
                  </div>
                  <div>
                    <div className="text-violet-400 text-xs">输出 Tokens</div>
                    <div className="font-semibold text-violet-700 dark:text-violet-300 mt-0.5">{log.outputTokens ?? '-'}</div>
                  </div>
                  {log.cacheReadInputTokens && (
                    <div>
                      <div className="text-violet-400 text-xs">缓存读取 Tokens</div>
                      <div className="font-semibold text-violet-700 dark:text-violet-300 mt-0.5">{log.cacheReadInputTokens}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-violet-400 text-xs">首 Token 时间</div>
                    <div className="font-semibold text-violet-700 dark:text-violet-300 mt-0.5">{formatFirstTokenTime(log.firstTokenTime)}</div>
                  </div>
                  <div>
                    <div className="text-violet-400 text-xs">输出速度</div>
                    <div className="font-semibold text-violet-700 dark:text-violet-300 mt-0.5">{formatTokenSpeed(log.tokensPerSecond)}</div>
                  </div>
                </div>
              </div>
            )}

            {/* URL */}
            <div>
              <div className="text-gray-400 text-[11px] uppercase tracking-wider font-medium mb-1.5">请求地址</div>
              <div className="bg-gray-900 text-emerald-400 p-2.5 rounded-xl font-mono text-xs">
                {log.method} {log.path}
              </div>
              <div className="text-gray-400 text-[11px] mt-1">{log.baseUrl}</div>
            </div>

            {/* 请求头 */}
            {log.requestHeaders && Object.keys(log.requestHeaders).length > 0 && (
              <div>
                <div
                  className="flex items-center justify-between cursor-pointer select-none hover:bg-gray-50 dark:hover:bg-gray-700/50 -mx-1 px-1 py-1.5 rounded-lg transition-colors"
                  onClick={() => setExpandedHeaders(!expandedHeaders)}
                >
                  <span className="text-gray-400 text-[11px] uppercase tracking-wider font-medium">请求头</span>
                  <svg
                    className={`w-3.5 h-3.5 text-gray-400 transition-transform ${expandedHeaders ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {expandedHeaders && (
                  <div className="bg-gray-50 dark:bg-gray-700 p-2.5 rounded-xl font-mono text-xs mt-1 ring-1 ring-gray-100 dark:ring-gray-600">
                    {Object.entries(log.requestHeaders).map(([key, value]) => (
                      <div key={key} className="py-0.5">
                        <span className="text-violet-600 dark:text-violet-400">{key}:</span>{' '}
                        <span className="text-gray-600 dark:text-gray-300">{value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 请求体 */}
            {log.requestBody && (
              <div>
                <div className="text-gray-400 text-[11px] uppercase tracking-wider font-medium mb-1.5">请求体</div>
                <ResizablePanel
                  height={heights.requestBody}
                  onResize={(h) => setHeights((prev) => ({ ...prev, requestBody: h }))}
                >
                  <pre className="m-0">
                    {formatJson(log.requestBody)}
                  </pre>
                </ResizablePanel>
              </div>
            )}

            {/* 响应体 */}
            {log.responseBody && (
              <div>
                <div className="text-gray-400 text-[11px] uppercase tracking-wider font-medium mb-1.5">响应体</div>
                <ResizablePanel
                  height={heights.responseBody}
                  onResize={(h) => setHeights((prev) => ({ ...prev, responseBody: h }))}
                >
                  <pre className="m-0">
                    {formatJson(log.responseBody)}
                  </pre>
                </ResizablePanel>
              </div>
            )}

            {/* 汇总内容 */}
            {log.isStream && log.streamData && (
              <div>
                <div className="text-gray-400 text-[11px] uppercase tracking-wider font-medium mb-1.5">汇总内容</div>
                <ResizablePanel
                  height={heights.streamData}
                  onResize={(h) => setHeights((prev) => ({ ...prev, streamData: h }))}
                >
                  <pre className="m-0">
                    {formatJson(log.streamData)}
                  </pre>
                </ResizablePanel>
              </div>
            )}

            {/* 错误信息 */}
            {log.error && (
              <div>
                <div className="text-red-400 text-[11px] uppercase tracking-wider font-medium mb-1.5">错误</div>
                <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs ring-1 ring-red-200 dark:ring-red-800">
                  {log.error}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 h-full flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">调用日志</h1>
          <p className="text-gray-400 mt-1 text-sm">
            实时监控和历史记录
            {activeRequests.length > 0 && (
              <span className="ml-2 text-amber-600 font-medium">
                · {activeRequests.length} 个请求进行中
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleExport('json')}
            className="px-3.5 py-2 text-sm bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 font-medium shadow-sm"
          >
            导出 JSON
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <select
          value={filter.platformId}
          onChange={(e) => setFilter({ ...filter, platformId: e.target.value })}
          className="px-3.5 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
        >
          <option value="">全部平台</option>
          {platforms.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          className="px-3.5 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
        >
          <option value="">全部状态</option>
          <option value="success">成功 (2xx)</option>
          <option value="error">错误 (4xx/5xx)</option>
        </select>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Log List */}
        <div className={`flex-1 min-w-0 overflow-auto space-y-2 ${selectedLog ? 'pr-4' : 'w-full'}`}>
          {activeRequests
            .filter(r => !filter.platformId || r.platformId === filter.platformId)
            .map(request => renderActiveRequest(request))}

          {activeRequests.length > 0 && filteredLogs.length > 0 && (
            <div className="flex items-center gap-3 py-2">
              <div className="flex-1 h-px bg-gray-100 dark:bg-gray-700"></div>
              <span className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">历史记录</span>
              <div className="flex-1 h-px bg-gray-100 dark:bg-gray-700"></div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="flex flex-col items-center gap-3">
                <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                <span className="text-gray-400 text-sm">加载中...</span>
              </div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400">
              <svg className="w-10 h-10 mb-2 text-gray-200 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-sm">
                {activeRequests.length > 0 ? '暂无历史记录' : '暂无日志记录'}
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map(log => renderHistoryLog(log))}
            </div>
          )}
        </div>

        {selectedLog && (
          <>
            <div
              onMouseDown={() => setIsResizing(true)}
              className="w-1.5 cursor-col-resize hover:bg-primary-300/50 active:bg-primary-400/50 transition-colors flex-shrink-0 self-stretch rounded-full"
            />
            {renderDetailPanel()}
          </>
        )}
      </div>
    </div>
  )
}
