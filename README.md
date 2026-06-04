# workbuddyskills

My [WorkBuddy](https://www.codebuddy.cn/docs/workbuddy/Overview) local skills and MCP configurations collection.

## Structure

```
├── skills/          # 本地安装的所有 Skills
│   ├── AIHOT/                     # AI 资讯查询
│   ├── awesome-design-md/         # 54 个品牌 DESIGN.md 设计系统
│   ├── canvas-design/             # 视觉设计（海报/艺术）
│   ├── deploy-ops/                # 运维管理平台一键发包
│   ├── frontend-dev/              # 全栈前端开发 + 动画
│   ├── ima-skill/                 # IMA OpenAPI 笔记管理 + 知识库
│   ├── neodata-financial-search/  # NeoData 金融搜索
│   ├── obsidian/                  # Obsidian 笔记操作
│   ├── self-improving/            # 自我反思与持续改进
│   ├── tv-series-downloader/      # 电视剧批量下载
│   ├── web-animation-design/      # Web 动画设计
│   └── ...                        # 更多 Skills
├── mcp/
│   ├── mcp.json                   # MCP 服务器配置
│   └── deploy-mcp/                # 自定义部署 MCP Server 源码
│       ├── package.json
│       └── server.js
└── README.md
```

## Usage

Clone and copy the skills you need to `~/.workbuddy/skills/`:

```bash
cp -r skills/deploy-ops ~/.workbuddy/skills/
```

Or install the deploy-mcp server:

```bash
cd mcp/deploy-mcp
npm install
# Then add to ~/.workbuddy/mcp.json
```
