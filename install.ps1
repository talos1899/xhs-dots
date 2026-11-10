# xhs-dots 一键安装（Windows PowerShell）
# 用法：irm https://raw.githubusercontent.com/talos1899/xhs-dots/main/install.ps1 | iex
$ErrorActionPreference = 'Stop'

$repo = 'talos1899/xhs-dots'
$root = Join-Path $env:USERPROFILE '.xhs-dots-src'
$zip = Join-Path $env:TEMP 'xhs-dots-main.zip'

Write-Host ''
Write-Host '  xhs-dots · 让 AI 自己去查小红书' -ForegroundColor Magenta
Write-Host ''

# 1) Node 检查
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Host '  需要 Node.js 22 或更高版本：https://nodejs.org/zh-cn' -ForegroundColor Yellow
  Write-Host '  装好后重新运行这条命令即可。' -ForegroundColor Yellow
  exit 1
}
$ver = [int]((node --version).TrimStart('v').Split('.')[0])
if ($ver -lt 22) {
  Write-Host "  当前 Node 主版本是 $ver，需要 22+：https://nodejs.org/zh-cn" -ForegroundColor Yellow
  exit 1
}
Write-Host "  [1/4] Node $(node --version) OK"

# 2) 下载
Write-Host '  [2/4] 下载中...'
$ProgressPreference = 'SilentlyContinue'
Invoke-WebRequest "https://codeload.github.com/$repo/zip/refs/heads/main" -OutFile $zip -UseBasicParsing
if (Test-Path $root) { Remove-Item $root -Recurse -Force }
New-Item -ItemType Directory -Path $root -Force | Out-Null
Expand-Archive $zip -DestinationPath $root -Force
$src = Join-Path $root 'xhs-dots-main'
Write-Host "  [3/4] 解压到 $src"

# 3) 装成技能 + 注册开机自启
node (Join-Path $src 'scripts\install.mjs') --autostart

# 4) 启动浏览器（首次会要求扫码登录）
Write-Host '  [4/4] 启动浏览器，请用小红书 App 扫码登录...' -ForegroundColor Cyan
node (Join-Path $src 'scripts\ensure-browser.mjs')

Write-Host ''
Write-Host '  装好了。试试：' -ForegroundColor Green
Write-Host "    node `"$src\scripts\dots.mjs`" ask `"上海适合一个人自习的咖啡馆`"" -ForegroundColor Green
Write-Host ''
