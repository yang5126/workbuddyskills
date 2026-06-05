#!/usr/bin/env node

/**
 * 虎牙直播流地址抓取 MCP Server
 *
 * 提供三个工具:
 * 1. huya_see_together  - 获取「一起看」频道所有正在直播的房间及流地址
 * 2. huya_stream        - 获取指定房间的实时流地址
 * 3. huya_resolve_id    - 解析虎牙短 ID 为数字 roomId
 */

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");

// ============================================================
// 虎牙 API 核心逻辑
// ============================================================

const API_URL = "https://mp.huya.com/cache.php?m=Live&do=profileRoom&roomid=";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

// CDN 优先级：HS 无需 Referer，第三方播放器兼容
const CDN_ORDER = ["HS", "TX", "TXDIRECT", "AL"];

// 一起看频道房间列表（硬编码，从页面采集）
const SEETOGETHER_ROOMS = [
  "11336726","31215877","31199435","31194377","11336579","880256",
  "11342412","30611864","31196942","30590779","31223843","31109333",
  "31246031","sangejieshuo","11342396","31248609","11352944","30219264",
  "30241641","30682679","11342433","30080238","29465875","31087618",
  "adgll","31091630","30951757","31091335","30951533","30080148",
  "31185035","30968485","30951578","23740156","31283988","mit26649",
  "30649359","31107167","30627334","30867383","30830295","31212603",
  "30439645","30523326","30376663","31081313","29982632","30692708",
  "30065341","30156310","30613314","29805872","30970882","30415827",
  "30362138","30837912","31269567","11336572","30515137","30860538",
  "30527430","30769485","30653672","30440855","29835225","31192789",
  "29687270","30526426","31247276","31261631","31014063","30653660",
  "30080247","31273637","29808803","31275822","31248781","30692769",
  "29807256","30882696","31027196","30762073","31106626","29862625",
  "30986994","23650774","30080227","20985796","11352958","11352874",
  "11352960","cxldb","11352919","30631741","29835716","30829078",
  "11342421","30832594","30311494","11342384","26355840","11352970",
  "11342426","11352871","31169570","bdcmovie","30145009","29465870",
  "11342439","11601986","31125322","30569910","30277823","17269326",
  "31067747","26355864","30311525","11336592","11342402","30296971",
];

async function fetchJson(url) {
  const resp = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Referer": "https://www.huya.com/",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) return null;
  return resp.json();
}

async function fetchText(url) {
  const resp = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Referer": "https://www.huya.com/",
    },
    signal: AbortSignal.timeout(10000),
    redirect: "follow",
  });
  if (!resp.ok) return null;
  return resp.text();
}

async function resolveShortId(shortId) {
  const html = await fetchText(`https://www.huya.com/${shortId}`);
  if (!html) return null;
  const m1 = html.match(/"roomId":(\d+)/);
  if (m1) return m1[1];
  const m2 = html.match(/"profileRoom":(\d+)/);
  if (m2) return m2[1];
  return null;
}

/**
 * 从 stream 对象中提取最佳 HLS/FLV URL
 * 优先 HS CDN（无需 Referer，第三方播放器兼容）
 */
function pickBestUrl(streamData) {
  const hlsLines = streamData?.hls?.multiLine || [];
  const flvLines = streamData?.flv?.multiLine || [];

  let hls = null, flv = null;
  for (const cdn of CDN_ORDER) {
    if (!hls) {
      const line = hlsLines.find(l => l.cdnType === cdn);
      if (line) hls = line.url;
    }
    if (!flv) {
      const line = flvLines.find(l => l.cdnType === cdn);
      if (line) flv = line.url;
    }
  }
  return { hls, flv };
}

async function getStreamInfo(roomId) {
  const data = await fetchJson(API_URL + roomId);
  if (!data || data.status !== 200) return null;

  const d = data.data || {};
  if (d.liveStatus !== "ON") return null;

  const profile = d.profileInfo || {};
  const liveData = d.liveData || {};
  const stream = d.stream || {};

  const rateArray = stream.hls?.rateArray || [];
  const quality = rateArray[0]?.sDisplayName || "未知";

  const { hls, flv } = pickBestUrl(stream);

  return {
    room_id: roomId,
    nick: profile.nick || "未知",
    title: liveData.introduction || liveData.roomName || "",
    quality,
    room_url: `https://www.huya.com/${roomId}`,
    hls_url: hls,
    flv_url: flv,
  };
}

async function scrapeSeeTogether() {
  const roomIds = [];
  for (const rid of SEETOGETHER_ROOMS) {
    if (/^\d+$/.test(rid)) {
      roomIds.push(rid);
    } else {
      const resolved = await resolveShortId(rid);
      if (resolved) roomIds.push(resolved);
    }
  }

  // 并发查询（分批 10 个）
  const results = [];
  for (let i = 0; i < roomIds.length; i += 10) {
    const batch = roomIds.slice(i, i + 10);
    const batchResults = await Promise.all(batch.map(getStreamInfo));
    for (const r of batchResults) {
      if (r) results.push(r);
    }
  }

  return results;
}

// ============================================================
// MCP Server
// ============================================================

const server = new Server(
  {
    name: "huya-live-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "huya_see_together",
      description:
        "获取虎牙「一起看」频道所有正在直播的房间列表及实时流地址（HLS/FLV）。" +
        "优先返回 HS CDN 地址，兼容 VLC/PotPlayer 等第三方播放器。",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "huya_stream",
      description:
        "获取指定虎牙房间的实时流地址。参数 room_id 为房间号（数字或短ID均可）。" +
        "返回 HLS (m3u8) 和 FLV 地址，优先 HS CDN。",
      inputSchema: {
        type: "object",
        properties: {
          room_id: {
            type: "string",
            description: "虎牙房间号（数字ID或短ID如 cxldb）",
          },
        },
        required: ["room_id"],
      },
    },
    {
      name: "huya_resolve_id",
      description: "将虎牙短ID（如 sangejieshuo、cxldb）解析为数字 roomId。",
      inputSchema: {
        type: "object",
        properties: {
          short_id: {
            type: "string",
            description: "虎牙短ID",
          },
        },
        required: ["short_id"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "huya_see_together") {
      const rooms = await scrapeSeeTogether();
      const m3uLines = [
        "#EXTM3U",
        "#PLAYLIST: 虎牙一起看直播 - 实时抓取",
      ];
      for (const r of rooms) {
        m3uLines.push(`#EXTINF:-1 group-title="虎牙一起看",${r.nick} - ${r.title}`);
        m3uLines.push(r.hls_url || r.flv_url || "");
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                total: rooms.length,
                rooms: rooms.map((r) => ({
                  room_id: r.room_id,
                  nick: r.nick,
                  title: r.title,
                  quality: r.quality,
                  room_url: r.room_url,
                  hls_url: r.hls_url,
                  flv_url: r.flv_url,
                })),
                m3u: m3uLines.join("\n"),
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (name === "huya_stream") {
      let roomId = args.room_id;
      if (!/^\d+$/.test(roomId)) {
        const resolved = await resolveShortId(roomId);
        if (!resolved) {
          return {
            content: [{ type: "text", text: `无法解析短ID: ${roomId}` }],
            isError: true,
          };
        }
        roomId = resolved;
      }

      const info = await getStreamInfo(roomId);
      if (!info) {
        return {
          content: [
            {
              type: "text",
              text: `房间 ${args.room_id} (${roomId}) 未开播或不存在`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(info, null, 2) }],
      };
    }

    if (name === "huya_resolve_id") {
      const resolved = await resolveShortId(args.short_id);
      if (!resolved) {
        return {
          content: [
            {
              type: "text",
              text: `无法解析短ID: ${args.short_id}`,
            },
          ],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                short_id: args.short_id,
                room_id: resolved,
                room_url: `https://www.huya.com/${resolved}`,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    return {
      content: [{ type: "text", text: `未知工具: ${name}` }],
      isError: true,
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: `错误: ${error.message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
