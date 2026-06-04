#!/usr/bin/env python3
"""
电视剧 m3u8 地址提取工具
从 maccms 类影视站点（如 hkys6.cc）的播放页中提取真实视频 m3u8 地址。

使用方法:
  python extract_m3u8.py "https://hkys6.cc/paly-331400-5-{ep}/" 1 32 [--output 输出文件.txt]

参数:
  url_pattern  : 播放页 URL 模板，用 {ep} 占位集数
  start_ep     : 起始集数
  end_ep       : 结束集数
  --output     : 输出文件路径（可选，默认输出到 stdout）
  --delay      : 请求间隔秒数（默认 0.5）
  --player-key : player_aaaa 配置变量名（默认 player_aaaa）
"""

import urllib.request
import urllib.parse
import re
import sys
import time
import argparse


def extract_episode_m3u8(url, player_key="player_aaaa"):
    """从单个播放页提取 m3u8 地址"""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    }
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode("utf-8", errors="ignore")

        # 匹配 player_aaaa={"url":"%68%74%74..."}
        pattern = rf'"{player_key}"\s*[:=]\s*{{[^}}]*"url"\s*:\s*"%([^"%]+)%"'
        match = re.search(pattern, html)

        if not match:
            # 尝试匹配不带百分号编码的
            pattern2 = rf'"{player_key}"\s*[:=]\s*{{[^}}]*"url"\s*:\s*"([^"]+)"'
            match = re.search(pattern2, html)

        if match:
            encoded_url = match.group(1)
            decoded = urllib.parse.unquote(encoded_url) if "%" in encoded_url else encoded_url
            # 去掉播放器附加参数（&dyvip, &next= 等）
            m3u8_url = decoded.split("&")[0] if "&" in decoded else decoded
            return m3u8_url

        return None

    except Exception as e:
        return f"ERROR: {e}"


def main():
    parser = argparse.ArgumentParser(description="提取电视剧 m3u8 播放地址")
    parser.add_argument("url_pattern", help="播放页 URL 模板，{ep} 占位集数")
    parser.add_argument("start_ep", type=int, help="起始集数")
    parser.add_argument("end_ep", type=int, help="结束集数")
    parser.add_argument("--output", "-o", help="输出文件路径")
    parser.add_argument("--delay", "-d", type=float, default=0.5, help="请求间隔秒数")
    parser.add_argument("--player-key", default="player_aaaa",
                        help="JS 配置变量名 (默认: player_aaaa)")

    args = parser.parse_args()

    results = []
    total = args.end_ep - args.start_ep + 1
    print(f"开始提取 {total} 集的 m3u8 地址...", file=sys.stderr)

    for ep in range(args.start_ep, args.end_ep + 1):
        url = args.url_pattern.format(ep=ep)
        result = extract_episode_m3u8(url, args.player_key)

        if result and not result.startswith("ERROR"):
            print(f"[{ep:03d}/{args.end_ep}] ✅ {result}", file=sys.stderr)
            results.append((ep, result))
        else:
            msg = result if result else "未找到视频 URL"
            print(f"[{ep:03d}/{args.end_ep}] ❌ {msg}", file=sys.stderr)
            results.append((ep, f"# FAILED: {msg}"))

        if ep < args.end_ep:
            time.sleep(args.delay)

    # 输出
    out = sys.stdout
    if args.output:
        out = open(args.output, "w", encoding="utf-8")

    out.write("# 电视剧 m3u8 播放地址\n")
    out.write(f"# 来源: {args.url_pattern}\n")
    out.write(f"# 集数: {args.start_ep}-{args.end_ep}\n")
    out.write("#" + "=" * 59 + "\n\n")

    for ep, url in results:
        out.write(f"第{ep:02d}集|{url}\n")

    ok_count = sum(1 for _, u in results if not u.startswith("#"))
    out.write(f"\n# 成功: {ok_count}/{len(results)} 集\n")

    if args.output:
        out.close()
        print(f"\n已保存到: {args.output}", file=sys.stderr)

    print(f"完成! 成功 {ok_count}/{len(results)} 集", file=sys.stderr)


if __name__ == "__main__":
    main()
