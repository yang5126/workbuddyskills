---
name: tv-series-downloader
description: |
  全场景视频下载技能。覆盖 maccms 影视站点（hkys6.cc）、BT 磁力搜索、以及 YouTube/TikTok/Instagram
  /Twitter/B站 等 1000+ 主流站点（通过 ReClip yt-dlp 引擎）。
  自动选择最优下载策略：直链 → m3u8 → 磁力 → yt-dlp，全程自动化。
  触发词：下载视频、下载电视剧、下载全集、下载电影、下 YouTube、下 B站、下 TikTok、
  提取剧集地址、m3u8 下载、批量下载、download video, download YouTube, download TikTok,
  save video, rip video, grab video.
  This skill should be used for ANY video download request regardless of source.
agent_created: true
---

# TV Series Downloader — 全场景视频下载

覆盖 maccms 影视站、BT 磁力搜索、主流平台视频下载。

## 适用场景

- 用户指定一个影视站点和剧名，要求下载全剧
- 用户提供 YouTube / TikTok / Instagram / Twitter / B站 等平台视频链接
- 用户已经打开某个剧集的播放页，需要提取视频源地址
- 用户拿到 m3u8 地址列表后需要批量下载
- 用户说"下载这个视频"但没指定来源 → 自动识别 URL 类型选用策略

## 下载策略优先级

1. **YouTube/B站/TikTok 等平台 → ReClip (yt-dlp)** — 直接拉取，支持 1000+ 站点，清晰度可选
2. **优先 hkys6.cc 直链 mp4** — 最快速，直接推迅雷
3. **m3u8 回退** — 无直链时提取 m3u8 播放地址
4. **磁力链/种子** — 老剧不在流媒体站时，搜索 BT 站点

### URL 自动识别

根据用户提供的链接类型，自动选择下载策略：

| URL 模式 | 策略 | 下载器 |
|----------|------|--------|
| `youtube.com/watch?v=` / `youtu.be/` | ReClip (yt-dlp) | 本地下载 |
| `tiktok.com/` / `vm.tiktok.com/` | ReClip (yt-dlp) | 本地下载 |
| `instagram.com/` | ReClip (yt-dlp) | 本地下载 |
| `bilibili.com/video/` / `b23.tv/` | ReClip (yt-dlp) | 本地下载 |
| `twitter.com/` / `x.com/` | ReClip (yt-dlp) | 本地下载 |
| `reddit.com/` / `vimeo.com/` 等 | ReClip (yt-dlp) | 本地下载 |
| `hkys*.cc/show-*/` 等 maccms 详情页 | 直链/m3u8 提取 | 迅雷 / ffmpeg |
| 用户说剧名但无 URL | maccms 搜索 → 回退磁力 | 迅雷 |

如果用户没说具体 URL 但说了"下载 YouTube 上的 X"，先用 WebSearch 搜一下找到链接。

---

## ReClip 下载流程（YouTube / TikTok / B站 / Instagram 等 1000+ 站点）

当用户提供 YouTube、TikTok、Instagram、Twitter/X、B站、Reddit、Vimeo 等平台链接时，
**跳过 maccms 流程，直接走 ReClip**。

### 步骤

1. **调用 `reclip_info(url)`** — 获取视频标题、时长、作者、可用清晰度列表
2. **展示摘要给用户** — 标题 + 清晰度选项，让用户确认（或默认最高画质）
3. **调用 `reclip_download(url, format_choice, format_id, title)`** — 启动下载，获取 `job_id`
4. **轮询 `reclip_status(job_id)`** — 每 2 秒查一次，直到 `status: "done"`
5. **交付文件** — 下载完成后，文件在 `file_path` 中，告知用户路径或用 `deliver_attachments` 交付

### 支持的格式

- **video**（默认）→ MP4 视频
- **audio** → MP3 音频

### 清晰度说明

`reclip_info` 返回的 `formats` 列表从高到低排列（如 2160p > 1080p > 720p）。
不指定 `format_id` 时自动选最高画质。

### 已知限制

- yt-dlp 可能被 YouTube 反爬，遇到 403 时换用磁力搜索方案
- 部分站点需要 cookie 认证（暂不支持）
- 下载文件保存在 `RECLIP_DIR`（默认 reclip/downloads/）

---

## Maccms 流程（hkys6.cc 等影视站点）

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

## Maccms 重要注意事项

1. **Referer 头**：m3u8 地址通常需要 `Referer` 请求头指向来源站点，否则可能被反盗链拦截
2. **播放节点质量**：不同节点清晰度不同，mkv 类节点可能提供更高清资源
3. **地址有效期**：m3u8 地址可能有时间限制，提取后尽快下载
4. **站点域名**：此类站点频繁更换域名（如 hkys6.cc → hkys7.cc），需使用当前有效域名
5. **player_aaaa 变量**：绝大多数 maccms 站点使用此变量名，若遇到其他命名可用 `--player-key` 参数指定
6. **超过 100 GiB 需确认**：推送前检查总大小，超过 100 GiB 必须先告知用户并等待确认（适用于所有下载方式）

## 磁力链/种子回退方案（含速度优选）

当 maccms 站点搜不到目标剧集时（尤其是老剧/美剧），按以下流程搜索并优选最快磁力链。

### BT 站点

| 站点 | 搜索 URL 模板 | 排序参数 |
|------|-------------|----------|
| **Nyaa** | `https://nyaa.land/?f=0&c=0_0&q=关键词` | `&s=seeders&o=desc` ← 按做种数降序 |
| **cilicili** | WebSearch `"剧名" site:cilicili.net` | 页面自带 seeder/leecher |
| **cilimao** | WebSearch `"剧名" site:cilimao.win` | 详情页有文件列表 |

### 速度优选流程（核心）

#### 第 1 步：搜索

使用 **多关键词** 同步搜索，覆盖不同发布组和格式：

```
WebSearch: "Loki S02 1080p BluRay"
WebSearch: "Loki.S02.2160p magnet site:nyaa.land"
WebSearch: "洛基 第二季 1080p 磁力"  ← 中文站点搜中文关键词
```

Nyaa 搜索 **必须加 `&s=seeders&o=desc`** 确保结果按速度排序。

#### 第 2 步：提取候选列表并对比

用 WebFetch 抓取每个搜索结果的页面，提取关键信息：

```
WebFetch → 提取: 标题/清晰度/大小/做种数(seeders)/下载数(leechers)/磁力链
```

#### 第 3 步：速度评分 & 排名

对候选磁力链按以下规则评分，选出 TOP 3：

| 因素 | 权重 | 说明 |
|------|------|------|
| **做种数 (seeders)** | ⭐⭐⭐ | 越高越快，10+ 即可高速，50+ 满速 |
| **清晰度** | ⭐⭐ | 2160p > 1080p > 720p，同名次看清晰度 |
| **文件大小** | ⭐ | 过小可能是假资源，超过 100GB 需用户确认 |
| **发布时间** | ⭐ | 优先 3 个月内发布的（做种更多） |
| **发布组信誉** | ⭐ | BlackTV > MeGusta > ELiTE > 未知来源 |

**决策逻辑：**
- 做种数 > 10 且清晰度满足的 → 直接选
- 多个做种数差不多 → 选清晰度更高的
- 全部做种 < 5 → 告知用户可能很慢，但照推

#### 第 4 步：展示对比表给用户

```
| # | 来源 | 清晰度 | 大小 | 做种 | 速度预估 |
|---|------|--------|------|------|----------|
| 1 | BlackTV DSNP | 2160p HDR | 27.7GB | 48 | 🟢 满速 |
| 2 | MeGusta | 1080p | 12.3GB | 32 | 🟢 高速 |
| 3 | ELiTE | 1080p x265 | 8.1GB | 8  | 🟡 一般 |
```

用户无明确选择时，**自动选做种最多 + 清晰度最高的**。

#### 第 5 步：验证 + 推送

```python
# 1. 验证磁力链有效
xunlei_download_check_urls(urls=[top_magnet])

# 2. 确认大小 < 100GB （超过则先问用户）

# 3. 推送到迅雷
xunlei_download_create(target=device_target, urls=[top_magnet])
```

### Nyaa 搜索示例（按做种数排序）

```
搜索：https://nyaa.land/?f=0&c=0_0&q=Loki+S02+2160p&s=seeders&o=desc
→ 找到多个结果，种子数 48/32/8 依次排列
→ 选种子数 48 的 BlackTV 2160p 版本
→ check_urls → valid → create → 推到迅雷
```

### 多站点搜索示例

```
# 同时搜 3 个方向
WebSearch: "Loki S02 2160p site:nyaa.land"
WebSearch: "洛基 第二季 DSNP 磁力 site:cilicili.net"  
WebSearch: "Loki.S02.2160p.DSNP magnet"
→ 收集所有磁力链，提取做种数
→ 对比：Nyaa 48种 / cilicili 无种数 / 其他15种
→ 自动选 Nyaa 48种的版本，直推迅雷
```
