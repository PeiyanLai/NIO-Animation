#!/usr/bin/env bash
# 把 .claude/skills/remotion/ 镜像到独立仓库并推送。
#
#   bash scripts/sync-skill-repo.sh [git@github.com:PeiyanLai/nio-remotion-skill.git]
#
# 为什么要独立仓库：团队成员装 skill 时只需要 skill 本体，不需要几个动画工程和素材照片。
# 为什么要脚本：skill 的真源在本仓库（改动和动画工程同批提交、能跑同步校验），
# 独立仓库是**镜像**。手工复制迟早漏文件，尤其是新增的 scripts/ 和 assets/ 子目录。
#
# ⚠️ 目标仓库**必须是 private**：SKILL.md 里拿未发布功能（宠物包 / 斜坡架 / 对讲机）
# 当例子，assets 里是 ES9 实拍贴图。这两样都不能公开。
#
# 幂等：每次跑都是「清空 → 复制 → 提交 → 推送」，本仓库里删掉的文件镜像里也会消失。

set -euo pipefail
REMOTE="${1:-}"
SRC="$(cd "$(dirname "$0")/.." && pwd)/.claude/skills/remotion"
WORK="${TMPDIR:-/tmp}/nio-remotion-skill-mirror"

[ -n "$REMOTE" ] || { echo "用法: bash scripts/sync-skill-repo.sh <仓库地址>"; exit 1; }
[ -d "$SRC" ] || { echo "找不到 $SRC"; exit 1; }

echo "源: $SRC"
echo "目标: $REMOTE"

rm -rf "$WORK"
git clone --depth 1 "$REMOTE" "$WORK" 2>/dev/null || { mkdir -p "$WORK"; git -C "$WORK" init -q; git -C "$WORK" remote add origin "$REMOTE"; }

# 清空（保留 .git），再整份复制
find "$WORK" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
mkdir -p "$WORK/skills/remotion"
# 用 cp 而不是 rsync —— 部分运行环境（含本项目的容器）没有 rsync
cp -r "$SRC/." "$WORK/skills/remotion/"
find "$WORK/skills/remotion" -name '__pycache__' -type d -exec rm -rf {} + 2>/dev/null || true
find "$WORK/skills/remotion" -name '*.pyc' -delete 2>/dev/null || true

cat > "$WORK/README.md" <<'EOF'
# NIO 功能演示动画 · Claude Code Skill

> **内部资料，请勿外传。** 本仓库含未发布功能的演示设计与 ES9 实拍贴图。

用 Remotion 以代码方式制作车辆功能演示动画，交付可发链接的单文件交互 HTML，
并可导出飞书文档里能自动播放的 GIF。

## 安装

```bash
# 装到当前项目
git clone <本仓库地址> /tmp/nio-skill && mkdir -p .claude/skills \
  && cp -r /tmp/nio-skill/skills/remotion .claude/skills/

# 或装到用户级（所有项目可用）
git clone <本仓库地址> /tmp/nio-skill && mkdir -p ~/.claude/skills \
  && cp -r /tmp/nio-skill/skills/remotion ~/.claude/skills/
```

装完在 Claude Code 里说「做个 XX 功能的演示动画」即可触发。

## 先跑环境自检

```bash
bash .claude/skills/remotion/scripts/preflight.sh
```

查 node / remotion / chromium / ffmpeg / PIL。**HTML 和 GIF 出自同一条流水线**
（都靠 remotion render + 无头浏览器），不存在「能出 HTML 但出不了 GIF」的中间态。
全绿 = 这台机器能跑完整链路；有红 = 只能做飞书插入那一段，产物由别处提供。

## 目录

| 路径 | 内容 |
|---|---|
| `skills/remotion/SKILL.md` | 主文档：决策卡 → 断言 → 抠图 → 打包 → 交付闭环 |
| `skills/remotion/assets/vehicles/` | **按车型分目录**的车辆资产库（`_shared/` + `es9/`） |
| `skills/remotion/scripts/` | 抠形、断言、打包 HTML、导 GIF、环境自检等工具 |
| `skills/remotion/references/` | 车辆资产说明、飞书交付、实拍路径、动画路由 |

ES9 正侧视直接用 `<ES9SideView deg bob />`，正俯视用 `ES9_TOP`——
**视角定了图就定死了**，不要另找图或画矢量车。

## 这个仓库是镜像

真源在动画工程仓库的 `.claude/skills/remotion/`，那边改完跑
`bash scripts/sync-skill-repo.sh <本仓库地址>` 推过来。
**不要直接在这个仓库里改**，改了会被下一次同步覆盖。
EOF

cd "$WORK"
git add -A
if git diff --cached --quiet; then
  echo "无改动，跳过推送。"
  exit 0
fi
git -c user.name="Claude" -c user.email="noreply@anthropic.com" \
  commit -q -m "sync: 从动画工程仓库镜像 skill

真源：.claude/skills/remotion/
不要直接在本仓库改，会被下一次同步覆盖。"
git push -u origin HEAD:main
echo "✅ 已推送到 $REMOTE"
