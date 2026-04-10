# 发布流程文档

## 概述

CC Look 使用 GitHub Actions 实现自动化构建和发布。当推送新的版本标签时，会自动构建 macOS 和 Windows 安装包并创建 GitHub Release。

## 发布流程

### 1. 准备发布

#### 1.1 更新版本号

编辑 `package.json` 更新版本号：

```json
{
  "version": "1.0.2"
}
```

#### 1.2 更新 CHANGELOG

在 `docs/release/CHANGELOG.md` 中添加新版本的更新记录：

```markdown
## [1.0.2] - 2026-03-10

### 新增
- 新功能描述

### 修复
- bug 修复描述

### 变更
- 变更描述
```

#### 1.3 提交更改

```bash
git add .
git commit -m "chore: bump version to 1.0.2"
```

### 2. 创建标签

```bash
# 创建带注释的标签
git tag -a v1.0.2 -m "Release v1.0.2"

# 推送标签到远程
git push origin v1.0.2
```

### 3. 自动构建

GitHub Actions 会自动执行以下步骤：

1. **构建矩阵**: 在 macOS 和 Windows 上并行构建
2. **安装依赖**: `npm ci`
3. **构建应用**: `npm run build:mac` / `npm run build:win`
4. **上传产物**: 将安装包上传为 Artifacts
5. **创建 Release**: 下载所有产物并创建 GitHub Release

### 4. 验证发布

1. 访问 [GitHub Actions](https://github.com/onekb/cc-look/actions) 查看构建状态
2. 构建完成后，访问 [Releases](https://github.com/onekb/cc-look/releases) 页面
3. 下载并测试安装包

## 构建产物

### macOS

| 文件 | 说明 |
|------|------|
| `CC-Look-{version}.dmg` | DMG 安装镜像 |
| `CC-Look-{version}-mac.zip` | ZIP 压缩包 |
| `latest-mac.yml` | 自动更新配置 |

### Windows

| 文件 | 说明 |
|------|------|
| `CC-Look Setup {version}.exe` | NSIS 安装程序 |
| `CC-Look {version}.exe` | 便携版 |
| `latest.yml` | 自动更新配置 |

## GitHub Actions 配置

### 触发条件

```yaml
on:
  push:
    tags:
      - 'v*'  # 推送 v 开头的标签时触发
```

### 构建矩阵

```yaml
strategy:
  matrix:
    os: [macos-latest, windows-latest]
```

### 权限配置

```yaml
permissions:
  contents: write  # 需要写权限创建 Release
```

## 手动发布（备用）

如果 GitHub Actions 不可用，可以手动构建：

### macOS

```bash
# 安装依赖
npm ci

# 构建
npm run build:mac

# 产物位于 release/ 目录
```

### Windows

```powershell
# 安装依赖
npm ci

# 构建
npm run build:win

# 产物位于 release/ 目录
```

## 版本命名规范

遵循 [语义化版本](https://semver.org/lang/zh-CN/)：

- **主版本号 (Major)**: 不兼容的 API 修改
- **次版本号 (Minor)**: 向下兼容的功能性新增
- **修订号 (Patch)**: 向下兼容的问题修正

示例：
- `v1.0.0` - 初始版本
- `v1.0.1` - Bug 修复
- `v1.1.0` - 新功能
- `v2.0.0` - 重大更新

## 回滚发布

如果发布的版本有严重问题：

1. **删除 Release**:
   - 进入 Releases 页面
   - 点击有问题的 Release
   - 点击 Delete

2. **删除标签**:
   ```bash
   # 删除本地标签
   git tag -d v1.0.2

   # 删除远程标签
   git push origin :refs/tags/v1.0.2
   ```

3. **修复问题后重新发布**:
   - 修复代码
   - 更新版本号（如 v1.0.3）
   - 重新走发布流程

## 环境要求

### 构建环境

- Node.js 20+
- npm 9+

### macOS 构建

- macOS 10.15+
- Xcode Command Line Tools

### Windows 构建

- Windows 10+
- Visual Studio Build Tools (可选)

## 注意事项

1. **代码签名**: 当前版本未进行代码签名，用户可能需要手动信任应用
2. **自动更新**: 暂未实现自动更新功能
3. **构建时间**: 完整构建约需 5-10 分钟

## 相关链接

- [GitHub Actions Workflow](../../.github/workflows/release.yml)
- [Releases 页面](https://github.com/onekb/cc-look/releases)
- [Actions 页面](https://github.com/onekb/cc-look/actions)