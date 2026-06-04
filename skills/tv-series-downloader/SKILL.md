---
name: tv-series-downloader
description: |
  从 maccms 类影视站点（hkys6.cc 等）下载电视剧全集。自动提取播放页中的真实 m3u8 视频地址，
  生成批量下载脚本。触发词：下载电视剧、下载全集、提取剧集地址、m3u8 下载、批量下载剧集、
  download tv series, batch download episodes.
  This skill should be used when the user asks to download a TV series from hkys6.cc or similar
  maccms-based streaming sites, or when they want to extract video source URLs from play pages.
agent_created: true
---

# TV Series Downloader — 电视剧批量下载

从 maccms 类影视站点自动提取剧集播放地址并生成下载方案。

## 适用场景

- 用户指定一个影视站点和剧名，要求下载全剧
- 用户已经打开某个剧集的播放页，需要提取视频源地址
- 用户拿到 m3u8 地址列表后需要批量下载

## 下载策略优先级

1. **优先 hkys6.cc 直链 mp4** — 最快速，直接推迅雷
2. **m3u8 回退** — 无直链时提取 m3u8 播放地址
3. **磁力链/种子** — 老剧不在流媒体站时，搜索 BT 站点

## 核心流程

### 第 1 步：定位电视剧详情页

1. 打开目标站点首页
2. 搜索或浏览找到目标电视剧的详情页（如 `/show-331400/`）
3. 从详情页确认集数、播放节点信息

### 第 2 步：确定播放页 URL 模式

每个播放节点对应一组播放页，URL 格式通常为：
```
https://域名/paly-{show_id}-{server_id}-{ep}/
```

参数说明：
- `show_id`：剧集 ID，从详情页 URL 中获取（如 `331400`）
- `server_id`：播放节点编号（1=BF, 2=RY, 3=FF, 5=LZ, 6=UK 等）
- `ep`：集数（从 1 开始）

**选择播放节点的建议：**
- 优先选 `lzm3u8`（LZ节点，sid=5）或 `ukm3u8`（UK节点，sid=6），这些通常提供 m3u8 格式
- 可在详情页查看各节点的视频质量再决定

### 第 3 步：提取 m3u8 地址

使用 `scripts/extract_m3u8.py` 批量提取：

```bash
python scripts/extract_m3u8.py "https://hkys6.cc/paly-331400-5-{ep}/" 1 32 -o 输出文件.txt
```

**脚本工作原理：**
- 依次访问每集的播放页
- 从页面中提取 `player_aaaa` JavaScript 配置对象
- 从中获取 URL 编码的视频地址（`url` 字段）
- 解码得到真实的 `.m3u8` 播放地址
- 输出格式化的地址列表文件

**常见站点及播放节点映射：**

| 站点 | 节点 ID 映射 |
|------|-------------|
| hkys6.cc | LZ=lzm3u8(sid=5), UK=ukm3u8(sid=6), BF=bfzym3u8(sid=1), RY=rym3u8(sid=2), FF=ffm3u8(sid=3), HD=1080zyk(sid=4) |
| 其他 maccms 站点 | 一般 sid=5/LZ 节点最稳定 |

### 第 4 步：验证链接

提取完成后，抽查几个链接确保可访问：

```bash
curl -sI --connect-timeout 10 "提取的m3u8地址" -H "Referer: https://站点域名/" | head -5
```

如果返回 `HTTP/1.1 200 OK` 且 `Content-Type: application/vnd.apple.mpegurl`，则链接有效。

> **注意：** 部分站点需要 Referer 请求头，否则返回 403/404。

### 第 5 步：生成下载方案

将地址文件提交给用户，并说明下载方式：

**方案 A — 用附带的 PowerShell 脚本：**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/download.ps1 -M3u8File 地址文件.txt -OutputDir 下载目录 -ShowName 剧名
```
需要系统已安装 ffmpeg。

**方案 B — 逐集用 ffmpeg 下载：**
```bash
ffmpeg -user_agent "Mozilla/5.0" -headers "Referer: https://站点域名/" -i "m3u8地址" -c copy "输出.mp4"
```

**方案 C — 用 N_m3u8DL-CLI 等专业工具：**
将地址文件导入即可。

### 第 6 步（可选）：直接在该会话中下载

如果用户要求直接下载，逐集用 curl 或 ffmpeg 执行下载操作，保存到用户指定目录。

## 重要注意事项

1. **Referer 头**：m3u8 地址通常需要 `Referer` 请求头指向来源站点，否则可能被反盗链拦截
2. **播放节点质量**：不同节点清晰度不同，mkv 类节点可能提供更高清资源
3. **地址有效期**：m3u8 地址可能有时间限制，提取后尽快下载
4. **站点域名**：此类站点频繁更换域名（如 hkys6.cc → hkys7.cc），需使用当前有效域名
5. **player_aaaa 变量**：绝大多数 maccms 站点使用此变量名，若遇到其他命名可用 `--player-key` 参数指定
6. **超过 100GB 需确认**：推送前检查总大小，超过 100 GiB 必须先告知用户并等待确认

## 磁力链/种子回退方案

当 maccms 站点搜不到目标剧集时（尤其是老剧），按以下流程搜索磁力链：

### BT 站点

| 站点 | URL | 搜索方式 |
|------|-----|----------|
| **Nyaa** | https://nyaa.land | `https://nyaa.land/?f=0&c=0_0&q=剧名` |
| 百度贴吧 | https://tieba.baidu.com | WebSearch `"剧名" magnet OR 磁力` |

### 流程

1. **搜索**：WebSearch `"剧名" nyaa` 或 `"剧名" magnet:?xt=`
2. **提取**：WebFetch nyaa 详情页，正则提取 `magnet:?xt=urn:btih:...`
3. **校验**：通过迅雷 MCP `xunlei_download_check_urls` 验证磁力链有效性
4. **推送**：通过迅雷 MCP `xunlei_download_create` 创建下载任务
5. **大小检查**：推送前确认总大小，超过 100 GiB 需用户确认

### 示例

```
# 搜索老剧
WebSearch: "甄嬛传" nyaa
→ 找到 https://nyaa.land/view/1636111
→ WebFetch 提取 magnet:?xt=urn:btih:ede7c3...
→ check_urls → valid
→ create → 推到公司电脑
```
