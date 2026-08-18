# NIO 功能演示动画

> **内部资料，请勿外传。** 含未发布功能的演示设计与 ES9 实拍素材。

用 Claude Code 的 **remotion skill** 把车辆功能做成用户教育动画，
交付可发链接的单文件交互 HTML，并能导出飞书文档里自动播放的 GIF。

## 仓库结构

| 路径 | 内容 |
|---|---|
| **`.claude/skills/remotion/`** | **★ skill 本体**：SKILL.md + 车辆资产库 + 工具脚本 + 参考文档 |
| `animations/` | 动画工程（Remotion）。六个功能动画共用一个工程，`src/*-entry.tsx` 各是一个交付页入口 |
| `photos/` | 素材原图 + `approved-asset-manifest.json`（授权/水印/营销文案审核记录） |
| `dist/` | 交付产物：交互 HTML、MP4、分镜表 |
| `archive/` | 早期单文件 SVG 动画（feature-animation 时代）与 skill 变体，已被 `dist/` 里的版本取代 |
| `scripts/` | 仓库级脚本 |

⚠️ **skill 必须留在 `.claude/skills/remotion/`** —— Claude Code 按这个路径发现 skill，
挪走就不生效了。所以「把 skill 相关的东西放一起」是**在这个目录里放齐**，
而不是把它挪到别处。

## 装到别的项目 / 给团队用

```bash
# 项目级
mkdir -p <目标项目>/.claude/skills && cp -r .claude/skills/remotion <目标项目>/.claude/skills/

# 用户级（所有项目可用）
mkdir -p ~/.claude/skills && cp -r .claude/skills/remotion ~/.claude/skills/
```

装完先跑环境自检：

```bash
bash .claude/skills/remotion/scripts/preflight.sh
```

查 node / remotion / chromium / ffmpeg / PIL。**HTML 和 GIF 出自同一条流水线**
（都靠 remotion render + 无头浏览器），不存在「能出 HTML 但出不了 GIF」的中间态。
全绿 = 这台机器能跑完整链路；有红 = 只能做飞书插入那一段，产物由别处提供。

## 常用命令

```bash
# 打包某个功能的交互 HTML（改完组件必须重跑，否则发出去的还是旧快照）
python3 .claude/skills/remotion/scripts/build-player.py src/radio-entry.tsx dist/radio-player.html
node .claude/skills/remotion/scripts/assert-self-contained-html.mjs dist/radio-player.html --fragment

# 导飞书文档用的高清 GIF（默认 1440×810 / 6fps）
python3 .claude/skills/remotion/scripts/make-gif.py SceneA --out dist/gif/terrain-ch1.gif

# 校验资产库与工程里的素材没走样（改完素材必跑）
python3 .claude/skills/remotion/scripts/assert-assets-in-sync.py
```

脚本默认 `--project animations`，在仓库根目录跑即可。

## 车辆素材的硬规矩

**视角定了，图就定死了。** ES9 正侧视用 `<ES9SideView />`，正俯视用 `ES9_TOP`——
不要另找图、不要画矢量车。同一台车在不同动画里长得不一样，团队一眼看出是拼的。

这条**只管蔚来车**：画面里的第三方车必须明显不是同一台（尺寸/颜色/造型三个维度同时拉开）。

细则见 `.claude/skills/remotion/assets/vehicles/README.md`，
每份素材的标定来历和踩过的坑写在各自文件头部——**改之前先读**。
