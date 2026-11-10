#!/usr/bin/env bash
# xhs-dots 一键安装（macOS / Linux）
# 用法：curl -fsSL https://raw.githubusercontent.com/talos1899/xhs-dots/main/install.sh | bash
set -euo pipefail

REPO="talos1899/xhs-dots"
ROOT="$HOME/.xhs-dots-src"
ZIP="${TMPDIR:-/tmp}/xhs-dots-main.zip"

echo
echo "  xhs-dots · 让 AI 自己去查小红书"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "  需要 Node.js 22+：https://nodejs.org/zh-cn" >&2
  exit 1
fi
MAJOR=$(node -p 'process.versions.node.split(".")[0]')
[ "$MAJOR" -ge 22 ] || { echo "  当前 Node 主版本 $MAJOR，需要 22+" >&2; exit 1; }
echo "  [1/4] Node $(node -v) OK"

echo "  [2/4] 下载中..."
curl -fsSL "https://codeload.github.com/$REPO/zip/refs/heads/main" -o "$ZIP"
rm -rf "$ROOT" && mkdir -p "$ROOT"
unzip -q "$ZIP" -d "$ROOT"
SRC="$ROOT/xhs-dots-main"
echo "  [3/4] 解压到 $SRC"

node "$SRC/scripts/install.mjs" --autostart

echo "  [4/4] 启动浏览器，请用小红书 App 扫码登录..."
node "$SRC/scripts/ensure-browser.mjs"

echo
echo "  装好了。试试："
echo "    node \"$SRC/scripts/dots.mjs\" ask \"上海适合一个人自习的咖啡馆\""
echo
