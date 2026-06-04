---
name: deploy-ops
description: "运维管理平台一键发包技能。触发词：发包、部署、上线、发版、重启服务、上传JAR、deploy、煤炭发包、陆港发包、铝业发包、测试发包、正式发包。涵盖3产业2环境共6个环境，自动检测本地JAR、上传远程服务器、验证文件时间、执行服务重启。"
agent_created: true
---

# Deploy Ops — 运维管理平台发包技能

## 概述

此技能为 remotenew 运维管理平台提供发包部署能力。支持煤炭(mt)、铝业(ly)、陆港(lg) 三个产业的测试/正式共 6 个环境。

## 触发条件

当用户提及以下任何操作时使用此技能：

- "发包"、"部署"、"上线"、"发版"、"发布"
- "重启" + 服务名
- 具体环境名 "煤炭发包"、"陆港测试发版"、"铝业正式部署"
- "deploy"、"upload jar"
- "部署到 XXX 环境"

## 环境映射

详细环境配置见 `references/environments.md`。

| key | 产业 | 类型 | JAR 名称 | 目标路径 |
|-----|------|------|---------|---------|
| mt | 煤炭 | 正式 | gdt_mt.jar | /data/gdt_home/gdt_mt/server |
| mt_test | 煤炭 | 测试 | gdt_mt.jar | /data/gdt_home/gdt_mt/server |
| ly | 铝业 | 正式 | gdt_ly.jar | /data/gdt_home/gdt_ly/server |
| ly_test | 铝业 | 测试 | gdt_ly.jar | /data/gdt_home/gdt_ly/server |
| lg | 陆港 | 正式 | gdt_lg.jar | /data/gdt_home/gdt_lg/server |
| lg_test | 陆港 | 测试 | gdt_lg.jar | /data/gdt_home/gdt_lg/server |

JAR 本地路径前缀：`C:/Users/yg/IdeaProjects/scm_{产业}_server/target/`

## 发包流程

### 步骤 1: 确认目标环境

从用户输入中解析产业和类型：
- 产业：煤炭(mt) / 铝业(ly) / 陆港(lg)
- 类型：正式(prod) / 测试(test)

若用户未明确指定类型，询问是测试环境还是正式环境。

### 步骤 2: Maven 打包（推荐）

若 JAR 不存在或代码有更新，先执行 Maven 打包：

```bash
cd "C:/Users/yg/IdeaProjects/scm_{mt/ly/lg}_server" && mvn clean package -DskipTests
```

项目路径映射：

| 产业 | 项目目录 |
|------|---------|
| 煤炭 | `C:/Users/yg/IdeaProjects/scm_mt_server` |
| 铝业 | `C:/Users/yg/IdeaProjects/scm_ly_server` |
| 陆港 | `C:/Users/yg/IdeaProjects/scm_lg_server` |

打包完成后验证 JAR 是否生成：

```bash
ls -la "C:/Users/yg/IdeaProjects/scm_{mt/ly/lg}_server/target/gdt_{mt/ly/lg}.jar"
```

使用 MCP 时可直接调用 `deploy_build` 工具自动打包。

### 步骤 3: 检查本地 JAR

使用 `ls -la` 或 `stat` 命令检查 JAR 文件是否存在及最后修改时间：

```bash
ls -la "C:/Users/yg/IdeaProjects/scm_{mt/ly/lg}_server/target/gdt_{mt/ly/lg}.jar"
```

若 JAR 不存，提示用户先执行 `mvn package`。

### 步骤 4: 通过 MCP 服务或直接 API 执行上传

**推荐方式**：使用 deploy-mcp 服务的 `deploy_full` 工具（可设置 `buildFirst: true` 先打包再部署），一步完成打包+上传+验证+重启。

**直接 API 方式**（当 MCP 不可用时）：

上传 JAR：
```
POST {baseUrl}/remote/files/uploadFile
Headers: Authorization: {token}
Body: FormData { targetPath, file }
```

验证上传：
```
POST {baseUrl}/remote/files/list?path={targetPath}
Headers: Authorization: {token}
```

重启服务：
```
POST {baseUrl}/remote/command/execute
Headers: Content-Type: application/json, Authorization: {token}
Body: { command: "sh reStart-{mt/ly/lg}.sh", platform: "linux", workingDirectory: "{targetPath}" }
```

### 步骤 4: 上报结果

完成后报告：
- JAR 文件大小
- 上传耗时
- 服务器端文件时间是否确认最新
- 重启命令执行状态

## API 认证

Token 通过登录接口获取：
```
POST {baseUrl}/user/login
Body: { account: "Admin", password: "{password}" }
```

密码映射见 `references/environments.md`。

## 相关文件

- `deploy.html` — 项目里的发包 UI 页面
- `config.js` — 项目环境配置（baseUrl、路径、命令）
- `server.js` — 本地静态服务器（含 `/api/jar-info` 端点）
- `command.html` — 命令执行控制台（含重启功能）
- MCP 服务：`~/.workbuddy/mcp-servers/deploy-mcp/server.js`
