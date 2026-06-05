---
name: huya-live-scraper
description: >
  虎牙直播流地址抓取工具。从虎牙「一起看」等频道获取直播间列表，提取真实可播的 HLS/FLV 流地址，
  生成 M3U 播放列表供 VLC/PotPlayer/IINA 等第三方播放器使用。
  触发词：虎牙直播、一起看、huya、抓取虎牙、虎牙流地址、huya m3u、虎牙播放列表。
  当用户需要获取虎牙直播的真实流地址（能在第三方播放器直接播放）时使用此 Skill。
agent_created: true
---

# 虎牙直播流地址抓取

从虎牙直播页面抓取真实流媒体地址，生成可直接在 VLC/PotPlayer/IINA 等第三方播放器中播放的 M3U 列表。

## 核心原理

使用虎牙移动端缓存 API：

```
GET https://mp.huya.com/cache.php?m=Live&do=profileRoom&roomid={room_id}
```

返回 JSON 中的 `data.stream.hls.multiLine` 和 `data.stream.flv.multiLine` 包含完整可播 URL。

### CDN 选择策略（重要）

| CDN | 无 Referer 可播 | 第三方播放器 |
|-----|:---:|:---:|
| **HS** | ✅ | ✅ 推荐 |
| TX | ❌ | ❌ |
| TXDIRECT | ❌ | ❌ |
| AL | ❌ | ❌ |

**必须优先选择 HS CDN**，否则 VLC/PotPlayer 等播放器会 403。

## 使用方式

### 1. 通过 Python 脚本

脚本路径：`scripts/huya_scraper.py`

```bash
# 抓取「一起看」全部直播间，输出列表
python scripts/huya_scraper.py

# 生成 M3U 播放文件
python scripts/huya_scraper.py -f m3u -o huya.m3u

# 输出 JSON
python scripts/huya_scraper.py -f json -o huya.json

# 查询单个房间
python scripts/huya_scraper.py -r 880256
```

### 2. WorkBuddy 中调用

当用户请求抓取虎牙直播流时：

1. 执行 `scripts/huya_scraper.py` 脚本
2. 如果用户需要 M3U 播放列表，使用 `-f m3u -o <文件名>` 参数
3. 将生成的 `.m3u` 文件交付给用户，提示用 VLC/PotPlayer 打开

### 3. 自定义房间列表

修改脚本中的 `SEETOGETHER_ROOMS` 列表，或使用 `get_single_room()` 函数查询指定房间。

## 短 ID 解析

部分虎牙房间使用自定义短 ID（如 `sangejieshuo`、`cxldb`），脚本会自动通过页面重定向解析为数字 roomId。

## 输出格式

- **list**（默认）：终端友好的表格输出
- **m3u**：标准 M3U 播放列表，含主播名和标题
- **json**：完整 JSON 数据，含所有字段

## 依赖

- Python 3.7+
- `requests` 库
