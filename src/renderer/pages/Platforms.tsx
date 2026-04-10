import { useEffect, useState } from 'react'
import { usePlatformStore } from '../stores/platform'
import type { Platform, ProtocolType } from '@shared/types'

interface PlatformFormData {
  name: string
  protocol: ProtocolType
  baseUrl: string
  pathPrefix: string
}

const initialFormData: PlatformFormData = {
  name: '',
  protocol: 'openai',
  baseUrl: 'https://api.openai.com',
  pathPrefix: '/openai'
}

export default function Platforms() {
  const { platforms, loading, fetchPlatforms, createPlatform, deletePlatform, proxyState, fetchProxyState, startProxy, stopProxy } = usePlatformStore()
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState<PlatformFormData>(initialFormData)
  const [editingPlatform, setEditingPlatform] = useState<Platform | null>(null)

  useEffect(() => {
    fetchPlatforms()
    fetchProxyState()
  }, [fetchPlatforms, fetchProxyState])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const pathPrefix = formData.pathPrefix.startsWith('/') ? formData.pathPrefix : `/${formData.pathPrefix}`

    if (editingPlatform) {
      await usePlatformStore.getState().updatePlatform(editingPlatform.id, { ...formData, pathPrefix })
    } else {
      await createPlatform({
        ...formData,
        pathPrefix,
        enabled: true
      })
    }

    setShowModal(false)
    setFormData(initialFormData)
    setEditingPlatform(null)
  }

  const handleEdit = (platform: Platform) => {
    setEditingPlatform(platform)
    setFormData({
      name: platform.name,
      protocol: platform.protocol,
      baseUrl: platform.baseUrl,
      pathPrefix: platform.pathPrefix
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除这个平台吗？')) {
      await deletePlatform(id)
    }
  }

  const handleToggleProxy = async () => {
    if (proxyState.isRunning) {
      await stopProxy()
    } else {
      await startProxy()
    }
  }

  const getProtocolLabel = (protocol: ProtocolType) => {
    return protocol === 'openai' ? 'OpenAI' : 'Anthropic'
  }

  const getProtocolColor = (protocol: ProtocolType) => {
    return protocol === 'openai'
      ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800'
      : 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 ring-1 ring-orange-200 dark:ring-orange-800'
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const getDefaultPathPrefix = (protocol: ProtocolType) => {
    return protocol === 'openai' ? '/openai' : '/claude'
  }

  return (
    <div className="p-8 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">平台管理</h1>
          <p className="text-gray-400 mt-1 text-sm">管理 AI API 平台配置和代理服务</p>
        </div>
        <button
          onClick={() => {
            setEditingPlatform(null)
            setFormData(initialFormData)
            setShowModal(true)
          }}
          className="px-4 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 active:scale-[0.98] transition-all flex items-center gap-2 text-sm font-medium shadow-sm shadow-primary-600/20"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          添加平台
        </button>
      </div>

      {/* Proxy Status Card */}
      <div className={`rounded-2xl p-5 mb-6 border transition-all ${
        proxyState.isRunning
          ? 'bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border-emerald-200/60 dark:border-emerald-700/40'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-5">
            {/* Status Indicator */}
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              proxyState.isRunning
                ? 'bg-emerald-100 dark:bg-emerald-900/30'
                : 'bg-gray-100 dark:bg-gray-700'
            }`}>
              <span className={`status-dot !w-4 !h-4 ${proxyState.isRunning ? 'running' : 'stopped'}`}></span>
            </div>

            {/* Proxy Info */}
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">代理服务</h3>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-2">
                <code className="px-2 py-0.5 bg-gray-900 text-gray-300 rounded text-xs font-mono">
                  http://localhost:{proxyState.port}
                </code>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>{platforms.length} 个平台已配置</span>
              </div>
            </div>
          </div>

          {/* Toggle Button */}
          <button
            onClick={handleToggleProxy}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.98] ${
              proxyState.isRunning
                ? 'bg-red-500 text-white hover:bg-red-600 shadow-sm shadow-red-500/20'
                : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm shadow-emerald-500/20'
            }`}
          >
            {proxyState.isRunning ? '停止服务' : '启动服务'}
          </button>
        </div>
      </div>

      {/* Platform List */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            <span className="text-gray-400 text-sm">加载中...</span>
          </div>
        </div>
      ) : platforms.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-16 text-center border border-dashed border-gray-200 dark:border-gray-700">
          <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">还没有添加平台</h3>
          <p className="text-gray-400 text-sm mb-5">点击上方按钮添加一个 AI API 平台</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {platforms.map((platform) => (
            <div
              key={platform.id}
              className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-card hover:shadow-card-hover border border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 transition-all group"
            >
              <div className="flex items-center justify-between">
                {/* Platform Info */}
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                    platform.protocol === 'openai'
                      ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600'
                      : 'bg-orange-50 dark:bg-orange-900/30 text-orange-600'
                  }`}>
                    {platform.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{platform.name}</h3>
                      <span className={`px-2 py-0.5 text-[11px] rounded-full font-medium ${getProtocolColor(platform.protocol)}`}>
                        {getProtocolLabel(platform.protocol)}
                      </span>
                      {proxyState.isRunning && (
                        <div className="flex items-center gap-1.5">
                          <code className="px-2 py-0.5 text-xs bg-gray-50 dark:bg-gray-700 rounded-md font-mono text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-gray-600">
                            http://localhost:{proxyState.port}{platform.pathPrefix}
                          </code>
                          <button
                            onClick={() => copyToClipboard(`http://localhost:${proxyState.port}${platform.pathPrefix}`)}
                            className="p-1 text-gray-300 hover:text-primary-500 transition-colors rounded-md hover:bg-primary-50 dark:hover:bg-primary-900/30"
                            title="复制路径"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-gray-400 mt-0.5">
                      <span className="font-mono text-xs">{platform.baseUrl}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleEdit(platform)}
                    className="px-3.5 py-1.5 rounded-lg text-sm font-medium bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(platform.id)}
                    className="px-3.5 py-1.5 rounded-lg text-sm font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                  >
                    删除
                  </button>
                </div>
              </div>

              {/* Usage Example */}
              {proxyState.isRunning && (
                <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-700">
                  <div className="bg-gray-900 rounded-xl p-4 text-xs font-mono text-gray-400 overflow-x-auto shadow-inner-sm">
                    <div className="text-gray-500 mb-2 text-[11px]"># {platform.name} API 示例</div>
                    <pre className="whitespace-pre-wrap break-all text-gray-300">
{platform.protocol === 'openai' ? `curl http://localhost:${proxyState.port}${platform.pathPrefix}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'` : `curl http://localhost:${proxyState.port}${platform.pathPrefix}/v1/messages \\
  -H "Content-Type: application/json" \\
  -H "anthropic-version: 2023-06-01" \\
  -d '{
    "model": "claude-sonnet-4-6",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "Hello, Claude"}]
  }'`}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-elevated animate-scale-in">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-5">
              {editingPlatform ? '编辑平台' : '添加平台'}
            </h2>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    平台名称
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50 dark:bg-gray-700 focus:bg-white dark:focus:bg-gray-600"
                    placeholder="例如: OpenAI"
                    required
                  />
                </div>

                {/* Protocol */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    协议类型
                  </label>
                  <select
                    value={formData.protocol}
                    onChange={(e) => {
                      const protocol = e.target.value as ProtocolType
                      setFormData({
                        ...formData,
                        protocol,
                        baseUrl: protocol === 'openai'
                          ? 'https://api.openai.com'
                          : 'https://api.anthropic.com',
                        pathPrefix: getDefaultPathPrefix(protocol)
                      })
                    }}
                    className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50 dark:bg-gray-700 focus:bg-white dark:focus:bg-gray-600"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic (Claude)</option>
                  </select>
                </div>

                {/* Base URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    API Base URL
                  </label>
                  <input
                    type="url"
                    value={formData.baseUrl}
                    onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50 dark:bg-gray-700 focus:bg-white dark:focus:bg-gray-600 font-mono text-sm"
                    placeholder="https://api.openai.com"
                    required
                  />
                </div>

                {/* Path Prefix */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    路径前缀
                  </label>
                  <input
                    type="text"
                    value={formData.pathPrefix}
                    onChange={(e) => setFormData({ ...formData, pathPrefix: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50 dark:bg-gray-700 focus:bg-white dark:focus:bg-gray-600 font-mono text-sm"
                    placeholder="/openai"
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1.5">
                    用于区分不同平台的 URL 前缀，例如 <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">/openai</code> 或 <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">/claude</code>
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingPlatform(null)
                  }}
                  className="px-4 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-xl transition-colors text-sm font-medium"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 active:scale-[0.98] transition-all text-sm font-medium shadow-sm shadow-primary-600/20"
                >
                  {editingPlatform ? '保存' : '添加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
