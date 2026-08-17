#!/usr/bin/env bash
# 环境自检：这台 agent 能不能跑本 skill 的生产链路？
#
#   bash scripts/preflight.sh [项目目录，默认 remotion-terrain]
#
# 为什么需要它：**HTML 和 GIF 出自同一条流水线**（都靠 remotion render + 无头浏览器）。
# 所以不存在「能出 HTML 但出不了 GIF」这种中间态——一次自检就能定死分工。
#
# 全绿  → agent 自己跑完整链路：写代码 → 断言 → HTML → GIF → 飞书文档
# 有红  → agent 只做飞书那一段，HTML 和 GIF 由能跑渲染的一方产出后交给它
#
# 注意：**不要用「飞书文档里已经有 HTML 了」来推断 agent 能跑渲染**——
# 那份 HTML 很可能是别人产好递给它的，它只做了插入。

set -uo pipefail
PROJ="${1:-remotion-terrain}"
fail=0
ok()   { printf '  ✅ %s\n' "$1"; }
bad()  { printf '  ❌ %s\n' "$1"; fail=1; }

echo "== 1. 能不能执行命令 =="
command -v node >/dev/null && ok "node $(node -v)" || bad "没有 node —— 整条链路都跑不了"
command -v npx  >/dev/null && ok "npx"             || bad "没有 npx"

echo "== 2. 项目依赖 =="
if [ -d "$PROJ/node_modules/remotion" ]; then
  ok "remotion 已安装"
else
  bad "$PROJ/node_modules/remotion 不存在 —— 先跑 npm install（需要 npm 源可达）"
fi

echo "== 3. 无头浏览器（渲染必需，HTML 和 GIF 都靠它）=="
BROWSER="${REMOTION_BROWSER:-/opt/pw-browsers/chromium}"
if [ -x "$BROWSER" ]; then
  ok "chromium: $BROWSER"
else
  bad "找不到 chromium。设 REMOTION_BROWSER 指向已有的，或让 remotion 自己下载（要能出网）"
fi

echo "== 4. ffmpeg（GIF 重调色板用，随 remotion 附带）=="
FF="$PROJ/node_modules/@remotion/compositor-linux-x64-gnu/ffmpeg"
if [ -x "$FF" ] || command -v ffmpeg >/dev/null; then
  ok "ffmpeg 可用"
else
  bad "没有 ffmpeg —— GIF 还能出，但压不下体积，容易超飞书 20MB 上限"
fi

echo "== 5. PIL（读 GIF 尺寸/帧数做交付前自检）=="
python3 -c "import PIL" 2>/dev/null && ok "PIL $(python3 -c 'import PIL;print(PIL.__version__)')" \
  || bad "没有 PIL —— pip install pillow"

echo
if [ "$fail" = 0 ]; then
  echo "全绿：这台 agent 可以自己跑完整链路（写代码 → 断言 → HTML → GIF → 飞书文档）。"
  echo "跑一次真的渲染再下结论：python3 scripts/make-gif.py <CompId> --out /tmp/t.gif"
else
  echo "有红项：这台 agent 只做飞书那一段。HTML 和 GIF 由能跑渲染的一方产出后交给它，"
  echo "它负责建文档 + image 块插 GIF + file 块传 HTML。这个分工完全可行，不影响交付。"
fi
exit "$fail"
