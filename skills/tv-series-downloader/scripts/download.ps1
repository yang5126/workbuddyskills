# 电视剧批量下载脚本 (PowerShell + ffmpeg)
# 配合 extract_m3u8.py 输出的地址文件使用
#
# 用法:
#   powershell -ExecutionPolicy Bypass -File download.ps1 -M3u8File 地址文件.txt [-OutputDir 下载目录] [-ShowName 剧名]
#
# 前置: 需要安装 ffmpeg (https://ffmpeg.org/download.html) 并加入 PATH

param(
    [Parameter(Mandatory=$true)]
    [string]$M3u8File,

    [string]$OutputDir = ".",

    [string]$ShowName = ""
)

# 从文件名推断剧名
if (-not $ShowName) {
    $ShowName = [System.IO.Path]::GetFileNameWithoutExtension($M3u8File) -replace '_m3u8_地址', '' -replace '_地址', ''
}

# 创建下载目录
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  下载剧集: $ShowName" -ForegroundColor Yellow
Write-Host "  保存目录: $OutputDir" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 解析 m3u8 地址文件
$episodes = @()
Get-Content $M3u8File -Encoding UTF8 | ForEach-Object {
    if ($_ -match '^第(\d+)集\|(https?://.*\.m3u8)') {
        $episodes += @{ Ep = [int]$Matches[1]; Url = $Matches[2] }
    }
}

if ($episodes.Count -eq 0) {
    Write-Host "错误: 未在文件中找到有效的 m3u8 地址" -ForegroundColor Red
    exit 1
}

Write-Host "共发现 $($episodes.Count) 集`n" -ForegroundColor Green

$total = $episodes.Count
$success = 0
$skipped = 0
$failed = 0

foreach ($ep in $episodes) {
    $name = "${ShowName}_第$($ep.Ep.ToString('00'))集.mp4"
    $outPath = Join-Path $OutputDir $name

    if (Test-Path $outPath) {
        Write-Host "[$($ep.Ep)/$total] $name - 已存在，跳过" -ForegroundColor Gray
        $skipped++
        continue
    }

    Write-Host "[$($ep.Ep)/$total] 下载 $name ..." -ForegroundColor Green

    $result = & ffmpeg -user_agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" `
                       -headers "Referer: https://hkys6.cc/" `
                       -i $ep.Url `
                       -c copy `
                       -bsf:a aac_adtstoasc `
                       -y `
                       $outPath 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host "        [完成] $name" -ForegroundColor Green
        $success++
    } else {
        Write-Host "        [失败] $name (ExitCode: $LASTEXITCODE)" -ForegroundColor Red
        $failed++
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  下载完成!" -ForegroundColor Yellow
Write-Host "  成功: $success | 跳过: $skipped | 失败: $failed" -ForegroundColor Yellow
Write-Host "  文件位置: $(Resolve-Path $OutputDir)" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
