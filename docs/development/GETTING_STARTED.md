# 开发快速开始指南

## 环境要求

- **Node.js**: 18+ (推荐 20+)
- **npm**: 9+ 或 **pnpm**: 8+
- **操作系统**: macOS 10.15+ 或 Windows 10+

## 安装依赖

```bash
# 克隆仓库
git clone https://github.com/onekb/cc-look.git
cd cc-look

# 安装依赖
npm install
```

## 开发命令

```bash
# 启动开发模式
npm run dev

# 类型检查
npm run typecheck

# 代码检查
npm run lint

# 代码检查并修复
npm run lint:fix

# 构建生产版本
npm run build

# 预览生产版本
npm run preview
```

## 打包命令

```bash
# 打包 macOS (生成 .dmg)
npm run build:mac

# 打包 Windows (生成 .exe)
npm run build:win

# 解压模式（用于调试）
npm run build:unpack
```

## 开发模式

开发模式下：
- Vite Dev Server 自动启动
- 热重载 (HMR) 自动刷新
- DevTools 自动打开

### 调试技巧

**主进程调试**
- 查看终端输出日志
- 使用 `console.log` 打印调试信息

**渲染进程调试**
- 使用 Chrome DevTools (开发模式自动打开)
- React Developer Tools

**数据库位置**
- macOS: `~/Library/Application Support/cc-look/cc-look.db`
- Windows: `%APPDATA%/cc-look/cc-look.db`

## 添加新的 AI 协议支持

### 1. 更新类型定义

编辑 `src/shared/types.ts`:

```typescript
export type ProtocolType = 'openai' | 'anthropic' | 'your-new-protocol'
```

### 2. 实现代理逻辑

编辑 `src/main/proxy/index.ts`，在 `parseSseEvent` 函数中添加新协议的解析逻辑。

### 3. 更新前端表单

在 `src/renderer/pages/Platforms.tsx` 中添加新协议选项。

## 项目配置文件

| 文件 | 用途 |
|------|------|
| `package.json` | 项目配置、依赖、脚本 |
| `electron.vite.config.ts` | Vite 构建配置 |
| `tsconfig.json` | TypeScript 配置 |
| `tailwind.config.cjs` | TailwindCSS 配置 |
| `electron-builder.yml` (可选) | 打包配置 |

## 路径别名

项目配置了以下路径别名：

```typescript
// 主进程
'@main/*' -> 'src/main/*'
'@shared/*' -> 'src/shared/*'

// 预加载脚本
'@preload/*' -> 'src/preload/*'
'@shared/*' -> 'src/shared/*'

// 渲染进程
'@renderer/*' -> 'src/renderer/*'
'@shared/*' -> 'src/shared/*'
```

## 常见问题

### 1. 端口被占用

```bash
# 查找占用端口的进程
lsof -i :5005

# 终止进程
kill -9 <PID>
```

### 2. 数据库损坏

删除数据库文件后重启应用，会自动创建新数据库。

### 3. 构建失败

```bash
# 清理并重新安装
rm -rf node_modules
npm install

# 清理构建缓存
rm -rf out
rm -rf release
```

## Git 工作流

```bash
# 创建特性分支
git checkout -b feature/your-feature

# 提交更改
git add .
git commit -m "feat: 添加新功能"

# 推送到远程
git push origin feature/your-feature

# 创建 Pull Request
```

## 发布流程

1. 更新 `package.json` 中的版本号
2. 更新 `CHANGELOG.md`
3. 提交更改：`git commit -m "chore: bump version to x.x.x"`
4. 创建标签：`git tag vx.x.x`
5. 推送标签：`git push origin vx.x.x`
6. GitHub Actions 自动构建并发布
