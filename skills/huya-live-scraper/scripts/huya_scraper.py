#!/usr/bin/env python3
"""
虎牙直播流地址抓取工具
通过虎牙移动端 API 获取实时流媒体地址，优先使用 HS CDN（无需 Referer，兼容第三方播放器）。

API: https://mp.huya.com/cache.php?m=Live&do=profileRoom&roomid={room_id}

CDN 连通性:
  HS  → 无需 Referer，VLC/PotPlayer 可直播 ✓
  AL  → 403 拒绝
  TX  → 需要 Referer（第三方播放器不友好）
"""

import requests
import json
import re
import sys
import time
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Referer": "https://www.huya.com/",
}

API_URL = "https://mp.huya.com/cache.php?m=Live&do=profileRoom&roomid={room_id}"

# seeTogether 页面所有直播间 ID
SEETOGETHER_ROOMS = [
    "11336726", "31215877", "31199435", "31194377", "11336579", "880256",
    "11342412", "30611864", "31196942", "30590779", "31223843", "31109333",
    "31246031", "sangejieshuo", "11342396", "31248609", "11352944", "30219264",
    "30241641", "30682679", "11342433", "30080238", "29465875", "31087618",
    "adgll", "31091630", "30951757", "31091335", "30951533", "30080148",
    "31185035", "30968485", "30951578", "23740156", "31283988", "mit26649",
    "30649359", "31107167", "30627334", "30867383", "30830295", "31212603",
    "30439645", "30523326", "30376663", "31081313", "29982632", "30692708",
    "30065341", "30156310", "30613314", "29805872", "30970882", "30415827",
    "30362138", "30837912", "31269567", "11336572", "30515137", "30860538",
    "30527430", "30769485", "30653672", "30440855", "29835225", "31192789",
    "29687270", "30526426", "31247276", "31261631", "31014063", "30653660",
    "30080247", "31273637", "29808803", "31275822", "31248781", "30692769",
    "29807256", "30882696", "31027196", "30762073", "31106626", "29862625",
    "30986994", "23650774", "30080227", "20985796", "11352958", "11352874",
    "11352960", "cxldb", "11352919", "30631741", "29835716", "30829078",
    "11342421", "30832594", "30311494", "11342384", "26355840", "11352970",
    "11342426", "11352871", "31169570", "bdcmovie", "30145009", "29465870",
    "11342439", "11601986", "31125322", "30569910", "30277823", "17269326",
    "31067747", "26355864", "30311525", "11336592", "11342402", "30296971",
]

CDN_PREFERENCE = ["HS", "TX", "TXDIRECT", "AL"]  # HS 优先（无需 Referer）


def resolve_short_id(short_id):
    """解析自定义短ID（如 sangejieshuo）为数字 roomId"""
    try:
        url = f"https://www.huya.com/{short_id}"
        resp = requests.get(url, headers=HEADERS, timeout=10, allow_redirects=True)
        if resp.status_code == 200:
            match = re.search(r'"roomId":(\d+)', resp.text)
            if match:
                return match.group(1)
            match = re.search(r'"profileRoom":(\d+)', resp.text)
            if match:
                return match.group(1)
    except Exception:
        pass
    return None


def get_stream_info(room_id):
    """获取单个直播间的流地址信息"""
    try:
        resp = requests.get(API_URL.format(room_id=room_id), headers=HEADERS, timeout=10)
        if resp.status_code != 200:
            return None

        data = resp.json()
        if data.get("status") != 200:
            return None

        d = data.get("data", {})
        if d.get("liveStatus") != "ON":
            return None

        profile = d.get("profileInfo", {})
        live_data = d.get("liveData", {})
        stream = d.get("stream", {})

        nick = profile.get("nick", "未知")
        title = live_data.get("introduction", "") or live_data.get("roomName", "")

        rate_array = stream.get("hls", {}).get("rateArray", [])
        quality = rate_array[0].get("sDisplayName", "未知") if rate_array else "未知"

        # 按 HS > TX > TXDirect > AL 优先级挑选 CDN
        hls_lines = stream.get("hls", {}).get("multiLine", [])
        flv_lines = stream.get("flv", {}).get("multiLine", [])

        best_hls = None
        best_flv = None

        for preferred_cdn in CDN_PREFERENCE:
            if not best_hls:
                for line in hls_lines:
                    if line.get("cdnType") == preferred_cdn:
                        best_hls = line["url"]
                        break
            if not best_flv:
                for line in flv_lines:
                    if line.get("cdnType") == preferred_cdn:
                        best_flv = line["url"]
                        break

        return {
            "room_id": room_id,
            "nick": nick,
            "title": title,
            "quality": quality,
            "room_url": f"https://www.huya.com/{room_id}",
            "hls_url": best_hls,
            "flv_url": best_flv,
        }
    except Exception:
        return None


def scrape_see_together(output_format="m3u", output_file=None):
    """
    抓取虎牙「一起看」页面所有正在直播的流地址。

    Args:
        output_format: "m3u" | "json" | "list"
        output_file: 输出文件路径（None 则输出到当前目录）
    """
    # 解析短ID
    room_ids = []
    for rid in SEETOGETHER_ROOMS:
        if rid.isdigit():
            room_ids.append(rid)
        else:
            resolved = resolve_short_id(rid)
            if resolved:
                room_ids.append(resolved)

    # 并发查询
    live_rooms = []
    with ThreadPoolExecutor(max_workers=15) as executor:
        futures = {executor.submit(get_stream_info, rid): rid for rid in room_ids}
        for future in as_completed(futures):
            result = future.result()
            if result:
                live_rooms.append(result)

    if output_format == "json":
        data = json.dumps(live_rooms, ensure_ascii=False, indent=2)
        if output_file:
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(data)
        else:
            print(data)
        return live_rooms

    elif output_format == "m3u":
        lines = ["#EXTM3U", "#PLAYLIST: 虎牙一起看直播\n"]
        for room in live_rooms:
            lines.append(f'#EXTINF:-1 group-title="虎牙一起看",{room["nick"]} - {room["title"]}')
            lines.append(room["hls_url"] or room["flv_url"] or "")
            lines.append("")
        content = "\n".join(lines)
        if output_file:
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(content)
        else:
            print(content)
        print(f"\n共 {len(live_rooms)} 个直播间，M3U 已生成", file=sys.stderr)
        return live_rooms

    else:  # list
        for i, room in enumerate(live_rooms, 1):
            print(f"[{i}] {room['nick']} | {room['title']} | {room['quality']}")
            print(f"    HLS: {room['hls_url']}")
            if room['flv_url']:
                print(f"    FLV: {room['flv_url']}")
            print()
        print(f"\n共 {len(live_rooms)} 个直播间", file=sys.stderr)
        return live_rooms


def get_single_room(room_id):
    """获取单个房间的流地址"""
    return get_stream_info(room_id)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="虎牙直播流地址抓取")
    parser.add_argument("--room", "-r", help="单个房间ID")
    parser.add_argument("--format", "-f", choices=["m3u", "json", "list"], default="list",
                        help="输出格式 (default: list)")
    parser.add_argument("--output", "-o", help="输出文件路径")

    args = parser.parse_args()

    if args.room:
        info = get_single_room(args.room)
        if info:
            print(json.dumps(info, ensure_ascii=False, indent=2))
        else:
            print(f"房间 {args.room} 未开播或不存在", file=sys.stderr)
            sys.exit(1)
    else:
        scrape_see_together(output_format=args.format, output_file=args.output)
