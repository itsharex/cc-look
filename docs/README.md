# CC Look 文档中心

欢迎来到 CC Look 文档中心。这里包含了项目的完整文档，按类别组织。

## 文档目录

### 开发文档 (Development)

面向开发者的文档，包含架构设计和开发指南。

| 文档 | 说明 |
|------|------|
| [架构设计](./development/ARCHITECTURE.md) | 项目架构、技术栈、核心模块设计 |
| [快速开始](./development/GETTING_STARTED.md) | 开发环境搭建、常用命令、调试技巧 |

### 技术文档 (Technical)

面向技术人员的详细文档，包含 API 和实现细节。

| 文档 | 说明 |
|------|------|
| [IPC API 文档](./technical/API.md) | 渲染进程与主进程通信的完整 API 文档 |
| [数据库设计](./technical/DATABASE.md) | SQLite 数据库表结构和操作 API |
| [代理服务实现](./technical/PROXY.md) | 代理服务的核心实现细节 |

### 用户文档 (User)

面向最终用户的使用文档。

| 文档 | 说明 |
|------|------|
| [用户指南](./user/USER_GUIDE.md) | 安装、配置和使用的完整指南 |
| [常见问题](./user/FAQ.md) | 常见问题解答 |

### 发布文档 (Release)

版本更新和发布相关文档。

| 文档 | 说明 |
|------|------|
| [更新日志](./release/CHANGELOG.md) | 各版本的更新记录 |
| [发布流程](./release/RELEASE.md) | 版本发布和构建流程说明 |

---

## 快速链接

- [GitHub 仓库](https://github.com/onekb/cc-look)
- [Releases 下载](https://github.com/onekb/cc-look/releases)
- [问题反馈](https://github.com/onekb/cc-look/issues)

## 文档贡献

发现文档有误或想补充内容？欢迎提交 Pull Request！

1. Fork 仓库
2. 修改 `docs/` 目录下的文档
3. 提交 Pull Request

## 文档结构

```
docs/
├── README.md                    # 本文件（文档索引）
├── development/                 # 开发文档
│   ├── ARCHITECTURE.md          # 架构设计
│   └── GETTING_STARTED.md       # 快速开始
├── technical/                   # 技术文档
│   ├── API.md                   # IPC API 文档
│   ├── DATABASE.md              # 数据库设计
│   └── PROXY.md                 # 代理服务实现
├── user/                        # 用户文档
│   ├── USER_GUIDE.md            # 用户指南
│   └── FAQ.md                   # 常见问题
└── release/                     # 发布文档
    ├── CHANGELOG.md             # 更新日志
    └── RELEASE.md               # 发布流程
```
