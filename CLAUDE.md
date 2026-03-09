# CC Look

本地 AI API 代理软件，用于监控和调试 AI API 调用。

**技术栈**: Electron + React + TypeScript + Vite + TailwindCSS + Zustand + Express + sql.js

## 文档位置

所有技术细节和开发文档都在 `docs/` 目录：

- **文档索引**: `docs/README.md`
- **架构设计**: `docs/development/ARCHITECTURE.md`
- **IPC API**: `docs/technical/API.md`
- **数据库设计**: `docs/technical/DATABASE.md`
- **代理实现**: `docs/technical/PROXY.md`
- **快速开始**: `docs/development/GETTING_STARTED.md`

## 文档维护

**现有文档不满足需求时**：可自主在 `docs/` 目录下创建新文档，并同步更新本文件的文档列表。

**修改代码后请同步更新对应文档**：

| 修改内容 | 需更新的文档 |
|---------|-------------|
| IPC 接口变更 | `docs/technical/API.md` |
| 数据库表结构变更 | `docs/technical/DATABASE.md` |
| 代理服务逻辑变更 | `docs/technical/PROXY.md` |
| 项目结构/架构变更 | `docs/development/ARCHITECTURE.md` |
| 新版本发布 | `docs/release/CHANGELOG.md` |

## 快速命令

```bash
npm run dev          # 开发模式
npm run build:mac    # 打包 macOS
npm run build:win    # 打包 Windows
```
