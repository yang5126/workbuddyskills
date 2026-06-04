#!/usr/bin/env node

/**
 * Deploy MCP Server
 * 为 remotenew 运维管理平台提供发包部署能力
 *
 * 工具列表：
 *   deploy_list_environments  — 列出所有环境及 JAR 状态
 *   deploy_build              — Maven 打包
 *   deploy_upload             — 上传 JAR 到目标服务器
 *   deploy_verify             — 验证服务器上的文件
 *   deploy_restart            — 重启服务
 *   deploy_full               — 一键发包（打包+上传+验证+重启）
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

// ==================== 环境配置 ====================

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ENVIRONMENTS = {
  mt: {
    name: "煤炭正式",
    type: "prod",
    projectPath: "C:/Users/yg/IdeaProjects/scm_mt_server",
    jarPath: "C:/Users/yg/IdeaProjects/scm_mt_server/target/gdt_mt.jar",
    jarName: "gdt_mt.jar",
    baseUrl: "http://10.237.1.31:8022",
    targetPath: "/data/gdt_home/gdt_mt/server",
    restartCmd: "sh reStart-mt.sh",
    account: "Admin",
    password: "Spic@1455cs",
  },
  mt_test: {
    name: "煤炭测试",
    type: "test",
    projectPath: "C:/Users/yg/IdeaProjects/scm_mt_server",
    jarPath: "C:/Users/yg/IdeaProjects/scm_mt_server/target/gdt_mt.jar",
    jarName: "gdt_mt.jar",
    baseUrl: "http://10.237.1.32:8022",
    targetPath: "/data/gdt_home/gdt_mt/server",
    restartCmd: "sh reStart-mt.sh",
    account: "Admin",
    password: "Spic@1455cs",
  },
  ly: {
    name: "铝业正式",
    type: "prod",
    projectPath: "C:/Users/yg/IdeaProjects/scm_ly_server",
    jarPath: "C:/Users/yg/IdeaProjects/scm_ly_server/target/gdt_ly.jar",
    jarName: "gdt_ly.jar",
    baseUrl: "http://10.237.1.31:8044",
    targetPath: "/data/gdt_home/gdt_ly/server",
    restartCmd: "sh reStart-ly.sh",
    account: "Admin",
    password: "SPICly@1455",
  },
  ly_test: {
    name: "铝业测试",
    type: "test",
    projectPath: "C:/Users/yg/IdeaProjects/scm_ly_server",
    jarPath: "C:/Users/yg/IdeaProjects/scm_ly_server/target/gdt_ly.jar",
    jarName: "gdt_ly.jar",
    baseUrl: "http://10.237.1.32:8033/gdt_server",
    targetPath: "/data/gdt_home/gdt_ly/server",
    restartCmd: "sh reStart-ly.sh",
    account: "Admin",
    password: "SPICly@1455",
  },
  lg: {
    name: "陆港正式",
    type: "prod",
    projectPath: "C:/Users/yg/IdeaProjects/scm_lg_server",
    jarPath: "C:/Users/yg/IdeaProjects/scm_lg_server/target/gdt_lg.jar",
    jarName: "gdt_lg.jar",
    baseUrl: "http://10.237.1.31:8066",
    targetPath: "/data/gdt_home/gdt_lg/server",
    restartCmd: "sh reStart-lg.sh",
    account: "Admin",
    password: "Spic@1455",
  },
  lg_test: {
    name: "陆港测试",
    type: "test",
    projectPath: "C:/Users/yg/IdeaProjects/scm_lg_server",
    jarPath: "C:/Users/yg/IdeaProjects/scm_lg_server/target/gdt_lg.jar",
    jarName: "gdt_lg.jar",
    baseUrl: "http://10.237.1.32:8066",
    targetPath: "/data/gdt_home/gdt_lg/server",
    restartCmd: "sh reStart-lg.sh",
    account: "Admin",
    password: "Spic@1455",
  },
};

// ==================== Token 缓存 ====================

const tokenCache = {};

/**
 * 获取指定环境的 token（含缓存）
 */
async function getToken(envKey) {
  const env = ENVIRONMENTS[envKey];
  if (!env) throw new Error(`未知环境: ${envKey}`);

  // 检查缓存
  if (tokenCache[envKey]) return tokenCache[envKey];

  const resp = await fetch(`${env.baseUrl}/user/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ account: env.account, password: env.password }),
  });

  if (!resp.ok) throw new Error(`登录失败: ${resp.status}`);
  const data = await resp.json();
  if (!data.data?.token) throw new Error("未获取到 token");

  tokenCache[envKey] = data.data.token;
  return data.data.token;
}

/**
 * 获取 JAR 文件状态
 */
function getJarStatus(envKey) {
  const env = ENVIRONMENTS[envKey];
  if (!env) return { exists: false, error: "unknown key" };

  try {
    const stat = fs.statSync(env.jarPath);
    return {
      exists: true,
      size: stat.size,
      sizeFormatted: formatBytes(stat.size),
      modTime: stat.mtime.toISOString().replace("T", " ").substring(0, 19),
      path: env.jarPath,
    };
  } catch (e) {
    return { exists: false, path: env.jarPath, error: e.code };
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ==================== 部署操作 ====================

/**
 * Maven 打包
 */
function buildJar(envKey) {
  const env = ENVIRONMENTS[envKey];
  if (!env) throw new Error(`未知环境: ${envKey}`);

  const startTime = Date.now();
  const cmd = `cd "${env.projectPath}" && mvn clean package -DskipTests`;

  try {
    const output = execSync(cmd, {
      cwd: env.projectPath,
      encoding: "utf-8",
      timeout: 600000, // 10 分钟超时
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // 提取关键信息
    const buildSuccess = /BUILD SUCCESS/.test(output);
    const buildFailure = /BUILD FAILURE/.test(output);

    // 提取 build 结果摘要
    const lines = output.split("\n");
    const summary = lines
      .filter((l) => /BUILD|ERROR|WARNING|Tests run/i.test(l))
      .slice(-5)
      .join("\n");

    // 验证 JAR
    const jarStatus = getJarStatus(envKey);

    return {
      success: buildSuccess && !buildFailure,
      elapsed: `${elapsed}s`,
      buildSummary: summary || "无摘要",
      jarExists: jarStatus.exists,
      jarSize: jarStatus.exists ? jarStatus.sizeFormatted : null,
      jarModTime: jarStatus.exists ? jarStatus.modTime : null,
      fullOutput: output.substring(Math.max(0, output.length - 2000)), // 最后 2000 字符
    };
  } catch (e) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    return {
      success: false,
      elapsed: `${elapsed}s`,
      error: e.message,
      stderr: e.stderr ? e.stderr.substring(e.stderr.length - 2000) : "",
    };
  }
}

/**
 * 上传 JAR 到目标服务器
 */
async function uploadJar(envKey) {
  const env = ENVIRONMENTS[envKey];
  if (!env) throw new Error(`未知环境: ${envKey}`);

  const jarStatus = getJarStatus(envKey);
  if (!jarStatus.exists) {
    throw new Error(`JAR 文件不存在: ${env.jarPath}`);
  }

  const token = await getToken(envKey);
  const fileBuffer = fs.readFileSync(env.jarPath);
  const blob = new Blob([fileBuffer]);

  const formData = new FormData();
  formData.append("targetPath", env.targetPath);
  formData.append("file", blob, env.jarName);

  const startTime = Date.now();
  const resp = await fetch(`${env.baseUrl}/remote/files/uploadFile`, {
    method: "POST",
    headers: { Authorization: token },
    body: formData,
  });

  const data = await resp.json();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  return {
    success: data.code === 200,
    elapsed: `${elapsed}s`,
    message: data.msg || "",
    jarSize: jarStatus.sizeFormatted,
  };
}

/**
 * 验证服务器上的文件
 */
async function verifyUpload(envKey) {
  const env = ENVIRONMENTS[envKey];
  if (!env) throw new Error(`未知环境: ${envKey}`);

  const token = await getToken(envKey);
  const resp = await fetch(
    `${env.baseUrl}/remote/files/list?path=${encodeURIComponent(env.targetPath)}`,
    { method: "POST", headers: { Authorization: token } }
  );

  const files = await resp.json();
  if (!Array.isArray(files)) {
    throw new Error(`文件列表响应异常: ${JSON.stringify(files).substring(0, 200)}`);
  }

  const target = files.find((f) => f.fileName === env.jarName);
  if (!target) {
    const fileNames = files.map((f) => f.fileName).join(", ");
    return {
      found: false,
      message: `在 ${env.targetPath} 中未找到 ${env.jarName}`,
      directoryContents: fileNames,
    };
  }

  return {
    found: true,
    fileName: target.fileName,
    fileSize: target.fileSize,
    serverTime: target.createTime || "未知",
    fileId: target.fileId,
  };
}

/**
 * 重启服务
 */
async function restartService(envKey) {
  const env = ENVIRONMENTS[envKey];
  if (!env) throw new Error(`未知环境: ${envKey}`);

  const token = await getToken(envKey);
  const resp = await fetch(`${env.baseUrl}/remote/command/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({
      command: env.restartCmd,
      platform: "linux",
      workingDirectory: env.targetPath,
    }),
  });

  const data = await resp.json();
  return {
    success: resp.ok,
    command: env.restartCmd,
    workingDirectory: env.targetPath,
    output: data.output ? data.output.substring(0, 500) : "",
    message: data.message || data.msg || "",
  };
}

// ==================== MCP Server ====================

const server = new Server(
  { name: "deploy-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// 工具列表
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "deploy_list_environments",
      description:
        "列出所有发包环境（煤炭/铝业/陆港 × 正式/测试），包含 JAR 文件状态（大小、修改时间）和 API 地址",
      inputSchema: {
        type: "object",
        properties: {
          industry: {
            type: "string",
            description: "可选：按产业过滤。煤炭=mt, 铝业=ly, 陆港=lg",
          },
          type: {
            type: "string",
            description: "可选：按类型过滤。正式=prod, 测试=test",
          },
        },
      },
    },
    {
      name: "deploy_build",
      description:
        "Maven 打包。在本地项目目录执行 mvn clean package -DskipTests，完成后自动检测 JAR 是否生成及大小。",
      inputSchema: {
        type: "object",
        required: ["env"],
        properties: {
          env: {
            type: "string",
            description: "环境标识: mt/mt_test/ly/ly_test/lg/lg_test",
          },
        },
      },
    },
    {
      name: "deploy_upload",
      description:
        "上传本地 JAR 包到目标服务器的服务路径。需要指定环境 key（如 mt/mt_test/ly/ly_test/lg/lg_test）",
      inputSchema: {
        type: "object",
        required: ["env"],
        properties: {
          env: {
            type: "string",
            description: "环境标识: mt/mt_test/ly/ly_test/lg/lg_test",
          },
        },
      },
    },
    {
      name: "deploy_verify",
      description: "验证 JAR 文件是否已成功上传到服务器，检查文件大小和修改时间",
      inputSchema: {
        type: "object",
        required: ["env"],
        properties: {
          env: {
            type: "string",
            description: "环境标识",
          },
        },
      },
    },
    {
      name: "deploy_restart",
      description: "在目标服务器上执行服务重启命令（sh reStart-{产业}.sh）",
      inputSchema: {
        type: "object",
        required: ["env"],
        properties: {
          env: {
            type: "string",
            description: "环境标识",
          },
        },
      },
    },
    {
      name: "deploy_full",
      description:
        "一键部署：(可选打包) → 上传 JAR → 验证文件时间 → 重启服务。设置 buildFirst=true 可先自动 Maven 打包。",
      inputSchema: {
        type: "object",
        required: ["env"],
        properties: {
          env: {
            type: "string",
            description: "环境标识",
          },
          buildFirst: {
            type: "boolean",
            description: "是否先执行 Maven 打包（默认 false）。设为 true 则自动 mvn clean package -DskipTests",
          },
          skipRestart: {
            type: "boolean",
            description: "是否跳过重启（默认 false，即自动重启）",
          },
        },
      },
    },
  ],
}));

// 工具调用处理
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "deploy_list_environments": {
        let envs = Object.entries(ENVIRONMENTS).map(([key, env]) => {
          const jar = getJarStatus(key);
          return {
            key,
            name: env.name,
            type: env.type,
            baseUrl: env.baseUrl,
            targetPath: env.targetPath,
            restartCmd: env.restartCmd,
            jar,
          };
        });

        if (args.industry) {
          envs = envs.filter(
            (e) =>
              e.key === args.industry ||
              e.key === `${args.industry}_test`
          );
        }
        if (args.type) {
          envs = envs.filter((e) => e.type === args.type);
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(envs, null, 2),
            },
          ],
        };
      }

      case "deploy_build": {
        const result = buildJar(args.env);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "deploy_upload": {
        const result = await uploadJar(args.env);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "deploy_verify": {
        const result = await verifyUpload(args.env);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "deploy_restart": {
        const result = await restartService(args.env);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "deploy_full": {
        const env = ENVIRONMENTS[args.env];
        if (!env) {
          return {
            content: [{ type: "text", text: `未知环境: ${args.env}` }],
            isError: true,
          };
        }

        const steps = [];

        // Step 0: Build (optional)
        if (args.buildFirst) {
          try {
            const buildResult = buildJar(args.env);
            steps.push({ step: 0, action: "Maven打包", ...buildResult });
            if (!buildResult.success) {
              return {
                content: [{ type: "text", text: JSON.stringify({ steps, error: "Maven 打包失败，流程终止" }, null, 2) }],
                isError: true,
              };
            }
          } catch (e) {
            steps.push({ step: 0, action: "Maven打包", success: false, error: e.message });
            return {
              content: [{ type: "text", text: JSON.stringify({ steps, error: "打包异常，流程终止" }, null, 2) }],
              isError: true,
            };
          }
        }

        // Step 1: Upload
        let uploadResult;
        try {
          uploadResult = await uploadJar(args.env);
          steps.push({ step: 1, action: "上传", ...uploadResult });
        } catch (e) {
          steps.push({ step: 1, action: "上传", success: false, error: e.message });
          return {
            content: [{ type: "text", text: JSON.stringify({ steps, error: "上传失败，流程终止" }, null, 2) }],
            isError: true,
          };
        }

        // Step 2: Verify
        let verifyResult;
        try {
          verifyResult = await verifyUpload(args.env);
          steps.push({ step: 2, action: "验证", ...verifyResult });
        } catch (e) {
          steps.push({ step: 2, action: "验证", success: false, error: e.message });
          return {
            content: [{ type: "text", text: JSON.stringify({ steps, error: "验证失败，流程终止" }, null, 2) }],
            isError: true,
          };
        }

        // Step 3: Restart (optional)
        let restartResult = null;
        if (!args.skipRestart) {
          try {
            restartResult = await restartService(args.env);
            steps.push({ step: 3, action: "重启", ...restartResult });
          } catch (e) {
            steps.push({ step: 3, action: "重启", success: false, error: e.message });
          }
        } else {
          steps.push({ step: 3, action: "重启", skipped: true });
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  environment: env.name,
                  key: args.env,
                  jarSize: uploadResult.jarSize,
                  uploadElapsed: uploadResult.elapsed,
                  serverTime: verifyResult.serverTime,
                  steps,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `未知工具: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [{ type: "text", text: `错误: ${error.message}` }],
      isError: true,
    };
  }
});

// 启动
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Deploy MCP Server 已启动 (stdio)");
  console.error(`可用工具: deploy_list_environments, deploy_build, deploy_upload, deploy_verify, deploy_restart, deploy_full`);
  console.error(`支持环境: ${Object.keys(ENVIRONMENTS).join(", ")}`);
}

main().catch((err) => {
  console.error("MCP Server 启动失败:", err);
  process.exit(1);
});
