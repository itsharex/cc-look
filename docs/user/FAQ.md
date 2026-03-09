# 常见问题 (FAQ)

## 安装与启动

### Q: 支持哪些操作系统？

A: CC Look 支持：
- macOS 10.15 (Catalina) 或更高版本
- Windows 10 或更高版本

暂不支持 Linux。

### Q: macOS 提示"无法打开，因为它来自身份不明的开发者"

A: 这是 macOS 的安全机制。解决方法：
1. 右键点击应用，选择「打开」
2. 在弹出的对话框中点击「打开」
3. 或在「系统设置」>「隐私与安全性」中允许运行

### Q: Windows Defender 报毒怎么办？

A: 这是误报，因为应用没有代码签名。解决方法：
1. 在 Windows 安全中心选择「允许」
2. 或临时关闭实时保护进行安装

### Q: 应用启动后没有窗口显示

A: 可能是最小化到了系统托盘。检查系统托盘（任务栏右下角）是否有 CC Look 图标。

---

## 代理服务

### Q: 端口被占用怎么办？

A:
1. 在「设置」页面修改代理端口（如改为 3200）
2. 重启代理服务
3. 更新客户端配置使用新端口

### Q: 代理服务启动失败

A: 可能原因：
- 端口被占用：更换端口
- 防火墙阻止：允许应用通过防火墙
- 权限不足：以管理员身份运行

### Q: 请求显示 404 错误

A: 检查：
1. 请求路径是否包含正确的路径前缀
2. 平台是否已启用
3. 代理服务是否正在运行

示例正确路径：
- `http://localhost:5005/openai/v1/chat/completions`
- `http://localhost:5005/claude/v1/messages`

### Q: 请求超时

A: 可能原因：
- 网络问题：检查网络连接
- API 服务慢：正常现象，AI 生成需要时间
- 请求体过大：尝试减少输入内容

---

## 平台配置

### Q: 如何配置 OpenAI API？

A:
1. 名称：自定义，如 "OpenAI"
2. 协议：选择 "OpenAI"
3. API URL：`https://api.openai.com`
4. 路径前缀：`/openai`

### Q: 如何配置 Claude API？

A:
1. 名称：自定义，如 "Claude"
2. 协议：选择 "Anthropic"
3. API URL：`https://api.anthropic.com`
4. 路径前缀：`/claude`

### Q: 如何使用中转/代理服务？

A: 将 API URL 改为中转服务地址，例如：
- `https://api.your-proxy.com`
- `https://openai.your-domain.com`

路径前缀保持不变。

### Q: 支持哪些 API 协议？

A: 目前支持：
- **OpenAI 协议**：GPT 系列、兼容 OpenAI 的 API
- **Anthropic 协议**：Claude 系列

---

## 日志与监控

### Q: 日志存储在哪里？

A:
- macOS: `~/Library/Application Support/cc-look/cc-look.db`
- Windows: `%APPDATA%/cc-look/cc-look.db`

### Q: 如何导出日志？

A: 在「调用日志」页面：
1. 点击「导出」按钮
2. 选择格式（JSON 或 CSV）
3. 选择保存位置

### Q: 日志占用太多空间怎么办？

A:
1. 在「设置」中减少日志保留天数
2. 手动清除日志
3. 定期导出后删除旧日志

### Q: 为什么有些日志没有 Token 统计？

A: Token 统计来自 API 响应：
- 部分旧版 API 不返回 usage 信息
- 非流式请求可能没有详细统计
- 估算值可能不准确

---

## 浮动窗口

### Q: 浮动窗口不显示？

A: 检查：
1. 设置中是否启用了浮动窗口
2. 是否重启了代理服务
3. 是否有流式请求正在执行

### Q: 如何调整浮动窗口位置？

A: 直接拖动窗口到想要的位置即可。

### Q: 浮动窗口什么时候出现？

A: 浮动窗口只在检测到流式请求时自动创建，请求结束后自动关闭。

---

## 客户端配置

### Q: 如何在 Cursor 中使用？

A: 在 Cursor 设置中配置：
- OpenAI API Base URL: `http://localhost:5005/openai/v1`
- API Key: 你的 OpenAI API Key

### Q: 如何在 VS Code Copilot 中使用？

A: VS Code Copilot 暂不支持自定义 API 地址。

### Q: 如何在 Python 代码中使用？

A:
```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:5005/openai/v1",
    api_key="your-api-key"
)
```

### Q: 如何在 Node.js 中使用？

A:
```javascript
import OpenAI from 'openai'

const openai = new OpenAI({
  baseURL: 'http://localhost:5005/openai/v1',
  apiKey: 'your-api-key'
})
```

---

## 安全与隐私

### Q: API Key 安全吗？

A: API Key 存储在本地 SQLite 数据库中，不会上传到任何服务器。但请注意：
- 不要分享数据库文件
- 定期更换 API Key
- 导出日志时注意敏感信息

### Q: 请求数据会上传吗？

A: 不会。CC Look 是纯本地应用，所有数据都在本地处理和存储。

### Q: 如何彻底清除数据？

A: 删除应用数据目录：
- macOS: `~/Library/Application Support/cc-look/`
- Windows: `%APPDATA%/cc-look/`

---

## 其他问题

### Q: 如何获取更新？

A: 关注 [GitHub Releases](https://github.com/onekb/cc-look/releases) 页面，下载最新版本。

### Q: 如何报告问题？

A: 在 [GitHub Issues](https://github.com/onekb/cc-look/issues) 提交问题，包含：
- 操作系统和版本
- 应用版本
- 问题描述
- 复现步骤

### Q: 如何贡献代码？

A:
1. Fork 仓库
2. 创建特性分支
3. 提交 Pull Request

详见 [贡献指南](../README.md#贡献指南)。

### Q: 为什么叫 CC Look？

A: CC = Claude Code，Look = 查看。最初是为了解决使用 Claude Code 时无法看到实时输出的问题而开发的。
