---
name: remotion
description: 用 Remotion（React 帧驱动框架）以代码方式制作动画，默认交付可发链接的交互 HTML（@remotion/player 单文件打包），仅在用户明确要求时才导出 MP4。当用户提到：Remotion、React 做动画/视频、代码生成动画、programmatic video、要多段落/转场/配乐合成的成片、把 React 组件变成可播放页面或 MP4，或要求比单文件 SVG 动画更工程化的产线时使用本技能。与 feature-animation 的分工：一次性单文件 SVG 动画走 feature-animation；需要 React 组件化、时间轴合成、转场、参数化多版本的产线走本技能。
allowed-tools: [Bash, Read, Write, Edit, Glob, Grep]
---

# remotion · React 代码驱动动画

> **动手前先过一遍 `references/hard-rules.md`**——所有「（强制）」条款的一页索引卡。
> 拆给 agent 的任务书必须整页附上它。
> 本文件是概览 + 工作流 + 索引；深度规则按主题放在 `references/`（见文末索引），
> **每条索引注明了什么时候必须去读那一份**。

## 交付策略：默认 HTML，不默认出 MP4（成本约束）

**默认只产出交互 HTML**（`@remotion/player`）。**不要主动渲染 MP4**——只有用户明确说
"要视频/要 MP4"时才渲，且必须在 HTML 定稿之后渲**一次**，绝不在视频上做迭代。
真正烧 token 的是「渲染 → 抽帧读图 → 修 → 重渲」的视觉验证循环，配套省钱纪律：

- 校验优先用**无图断言**（DOM/数值检查、页面零报错），而不是截图目检
- 确实要看图时，只在关键节点看 **1 张**，裁切/缩小到必要区域
- 让用户当验收人：先交付，等他指出问题再改，不要自己反复猜

---

## 工作流（按编号顺序执行）

### 步骤 0：环境与交付能力自检

```bash
bash scripts/preflight.sh     # 查 node / remotion / chromium / ffmpeg / PIL
```

同时**自检交付能力**：列一遍自己可用的工具，确认「步骤 4 交付」能走降级序列的哪一级
（附件工具 / 下载链接 / 绝对路径）。干完活才发现发不出文件 = 交付失败。
浏览器路径用环境变量 `REMOTION_BROWSER` 覆盖（默认 `/opt/pw-browsers/chromium`，
见「可移植性」一节）。

### 步骤 1：动画决策卡（先分类，再写代码）

**需求太粗时先别做**：用户只有一两句话、讲不出章节和机构动作的，
先走 `req-clarify` skill 做引导式澄清，拿到详版需求文档再回来——
带着粗需求硬做的历史返工率是三轮起步。

**最容易犯的错是把所有功能都套成「车在路上行驶」**。先把结论写成
`animation-manifest.json` 并校验：

```bash
node scripts/validate-animation-manifest.mjs animation-manifest.json
```

- **scope 决定主画面**：`vehicle-exterior` 外观特写 · `cockpit` 座舱+HMI ·
  `vehicle-environment` 车外→座舱→车外 · `vehicle-ecosystem` 外设→车→自动结果 ·
  `vehicle-system` 概念示意+状态卡 · `fleet-topology` 地图节点+链路
- **mechanism 可多选**：`user-action` / `automatic-detection` / `state-transition` /
  `device-pairing` / `data-sync` / `relay-network` / `exception-handling`
- **输出形式按复杂度选**：单路径 ≤3 状态 → 线性演示；自动触发跨场景 → 3–5 章叙事；
  有状态机 → 主叙事 + 状态探索。**复杂状态机不许硬压成线性短片**
- **每章只讲一个 claim**，叙事顺序：触发 → 判断/交互 → 执行 → 可感知结果
- 文档没写的一律**不许臆造**：登记进 `conceptualItems`，缺口要问到
  「答案变了画面要不要重画」的粒度 → 详见 `references/layout-and-story.md`

完整路由规则见 `references/animation-routing.md`。

### 步骤 2：场景与素材

- **先判车外还是座舱**：车外行为（行驶/泊车/越野/车队）→ ES9 库；
  舱内行为（座舱交互/宠物在车/储物）→ ES8 库；用户点名车型照旧优先
- **同类素材里选哪张，第一判据是「叙事主体的位置在画面里拍得到」**，
  第二判据是主体朝向贴合机位
- **视角选定后图就定死**：同一台蔚来车全仓库同视角必须同一张图；
  第三方车必须明显不是蔚来车（尺寸/颜色/造型三维同时拉开）
- 拿到俯视/侧视图**先验正投影**：`python3 scripts/assert-orthographic.py <图>
  --len-mm … --wid-mm … --wb-mm …`（两条判据都偏 = 真透视，判废）
- 新素材入库必须登记 `approved-asset-manifest.json`（来源/授权/水印/营销叠字检查）；
  只用已批准无水印原图，**不得裁水印**，所有图 base64 内联；保真度降级要如实标
  `visualFidelity`（合规全文在 `references/scene-and-assets.md` 尾节）
- 判据详情、资产库结构、中性第三方车画法 → `references/scene-and-assets.md`；
  资产硬约束与落位公式 → `references/vehicle-assets.md`（动手前必读）；
  照片抠形量测 → `references/cutout-lab.md`

### 步骤 3：实现组件与断言

**先参考成品，再动笔（强制）**：每画一个新功能动画，先从成品库里挑
**场景最接近**的一个——打开它的交付页看效果（`dist/<x>-player.html`），
读它的源码看写法（`animations/src/<x>-entry.tsx` / `<X>Stage.tsx` / `<x>-data.ts`），
照它的舞台结构、数据层模式、卡片布局、断言组织起步，**不要从空白开始发明**。
选参照的对照表：

| 新需求场景 | 参照成品 | 学它什么 |
|---|---|---|
| 座舱俯视（宠物/储物/座椅布局） | 宠物模式 `pet` · 宠物包 `bag` 一/三章 | 实拍俯视舞台、照片剪纸主体、竖带卡片 |
| 座舱侧视（岛台/机构特写） | 宠物包 `bag` 二/四章 | 透视实拍舞台、照片锚定控件、虚实结合 |
| 车外正侧视（行驶/车队/机构） | 对讲 `radio` · 全地形 `terrain` | 照片车队、中性第三方车、环境具象 |
| 车外俯视（泊车/轨迹） | 泊车 `parking` | 运动学积分轨迹、SAT 间距断言 |
| 机构联动 + 实拍分镜 | 坡道 `ramp` | 关节腿剪纸、分镜表产出 |

写组件的同时写断言，两者**共用同一个纯函数**（`poseAt(scene,t)` 模式），
各写一份必然漂移。核心原则：**动画声称什么，就断言什么**——
「够不着」就断言最高点 < 目标高，「不会走丢」就断言全时间轴绳长不被拉长。
逐 0.02s 采样整条时间轴，不要抽查关键帧；断言要能失败。

实现期必读的强制规则速览（详版见对应 references）：

| 规则 | 一句话 | 详版 |
|---|---|---|
| 配色 | NIO 浅色底 token，主色只做强调 ≤15%，背景纯色禁网格 | layout-and-story |
| 信息卡 | 贴主体像气泡 + 指向关系；**四角禁区全局强制**（下节） | layout-and-story |
| 动作常识 | 铰链在哪侧/朝哪转/开多大先定死；正侧视开口只见一条缝 | motion-and-assertions |
| 几何证据 | 「方便/够得着/放得下」全部画成可测图形并断言 | layout-and-story |
| 一把尺子 | 同屏多主体用同一 mm/px，断言实物比值 ±3% | layout-and-story |
| 生物主体 | 涉宠物一律真实照片剪纸（`assets/pets/`），矢量只兜底 | animals-and-pets |
| 环境具象 | 每种环境至少一个实体道具 + 一层运动，确定性伪随机 | layout-and-story |
| 照片舞台 | 尺子一致定缩放；透视图只锚接触线；虚实结合处理遮挡 | photo-stage |
| 状态机 | 显式枚举单向推进，跃迁必须落在用户动作相位内 | motion-and-assertions |

### 步骤 4：交付（把 HTML 文件本体交到用户手里）

交付物 = **单文件交互 HTML（右上角内嵌各章高清 GIF 一键下载）**。
构建与校验链，每一环都不许跳：

```bash
python3 scripts/make-gif.py <Comp> --out out/ch1.gif        # 每章一条,1440×810/6fps
python3 scripts/build-player.py src/<x>-entry.tsx dist/<x>-player.html \
  --gif "章1·标题=out/ch1.gif" --gif-name <功能名>           # GIF 内嵌 + 下载入口
node scripts/assert-self-contained-html.mjs dist/<x>-player.html --fragment
# 再过一遍无头浏览器零报错,然后交付
```

**必须让用户拿到文件本身**，降级序列（走到哪级就明说哪级）：

1. **有文件发送/附件工具**（如 Claude Code 的 `SendUserFile`）→ 文件直接发进对话，
   附使用说明：点击画面暂停/继续、顶部 chips 切章节、右上角下载各章 GIF
2. **有下载链接能力**（工作区文件服务/制品导出）→ 给下载链接 + 同句说明
3. **都没有** → 给出绝对路径和取用方法，明说「这个 HTML 是唯一交付物」

只贴代码块、只报「已生成」= 交付失败。**不默认生成飞书文档**（用户点名才做，
流程在 `references/feishu-delivery.md`）；**不默认渲 MP4**。
HTML 打包细节、交付页版式、GIF 下载入口设计与坑、MP4 导出
→ `references/delivery.md`（交付前必读一遍「已踩坑」小节）。

### 步骤 5：复盘沉淀（强制）

每完成一次制作、每处理完一轮人工反馈，回答四个问题，有产出就提交进仓库：

1. **踩了什么新坑/新方法？** → 写进对应 references 专题文件，必须带本轮真实案例
2. **是不是长期规则？**（用户说「以后都…」或同类错误第二次出现）→ 升级进
   `references/hard-rules.md` 清单
3. **产生了新素材/新标定？** → photos/ + manifest 登记，可复用的进 assets/ 并跑同步校验
4. **返工根因是需求描述不清？** → 教训补进需求描述指南

沉淀本身也走版本闭环：提交推送到工作分支，里程碑随代码推平 main——
消费方（联网环境 update.py / zip 导入环境换新包）下一版就学到了。
防膨胀纪律：只收可执行可检查的条目；一次性参数留在动画数据层不进 skill；
同一条规则不写两遍——hard-rules 放一行索引，详细版在对应 references 专题文件里只此一份。

---

## 信息卡四角禁区（全局强制,所有动画所有图层）

信息卡/字幕块/步骤块**整体不得贴靠画面四角**（bag-data.CORNERS 的四块 190×105），
SVG 层和 HTML 层都算；只有「视角标签」这类非信息装饰允许留角上。
每个新动画要么复用 CORNERS 断言，要么在布局注释里写明已避开。
**拆给 agent 的任务书必须附上布局硬禁区清单（四角/SAFE/贴主体带宽）**——
宠物模式的步骤块曾因任务书漏了这条被放到左下角，用户点名返工。

## 拆给多个 agent 并行做时的分工

- **几何标定留在主线**（照片抠形、映射常量、尺寸换算），产出只读 `*-geo.ts` 给下游
- 组件与舞台分给不同 agent，用明确接口契约对接；任务书写死**可改/禁改文件清单**
- 交付打包、artifact 发布、git commit 一律留在主线；agent 做到「本地验证通过」为止

---

## 常见问题 / 故障排除

| 症状 | 原因 | 修法 |
|---|---|---|
| 渲染报 "Old Headless mode has been removed" | Remotion < 4.0.5xx 不支持新 Chromium | `npm i remotion@latest @remotion/cli@latest`，加 `--chrome-mode=chrome-for-testing` |
| 渲染时尝试下载浏览器/超时 | 未指定预装浏览器且外网受限 | 传 `--browser-executable=$REMOTION_BROWSER`（默认 /opt/pw-browsers/chromium） |
| 报「找不到 ffmpeg」但文件明明存在 | npm 装了 gnu+musl 两个 compositor，非本机那个 rc=127 | 唯一判据是真的跑一次 `ffmpeg -version`，别信路径和 +x |
| 渲染进程被杀（exit 137） | 1080p30 直渲 OOM | `--concurrency=2`（make-gif.py 已内置） |
| 页面白屏且控制台无报错 | bundle 里有字面量 `</script` 提前断开脚本块 | build-player.py 已统一转义为 `<\/script`，别绕过它手工打包 |
| 本地打开全页中文/zip 文件名乱码 | fragment 无外层 head，浏览器猜错编码 | build-player.py 已内置 `<meta charset>`，同上别手工打包 |
| Artifact 发布被拒（"pr-review machinery / too large"） | base64 素材流随机撞分类器指纹 | 可疑素材换压缩参数重编码（像素不变字节流全变）再打包 |
| Artifact 里点 GIF 下载没反应 | 查看器沙箱拦截页面自发下载 | 不是 bug；验收必须下载 HTML 到本地打开做 |
| 带 GIF 页面超 Artifact 16MB | 章节 GIF 单条 2–10MB | 预览版可不带 `--gif` 重打；附件版必须完整；超长章节 `--every 8` 控体积 |
| GIF 被反馈「糊」 | 分辨率低于显示宽度 2 倍 | 1440×810 是及格线，省体积降帧率不降分辨率 |
| npm 装不上 | 公司沙箱无外网 | 如实报告只能做代码修改不能渲染，HTML 由能渲染的一方产出（分工见步骤 0） |
| 断言与画面对不上 | 组件和断言各写了一份逻辑 | 回到「共用纯函数」结构，别打补丁 |

## 耗时预期（超时阈值按 2× 预估设）

| 操作 | 典型输入 | 预估耗时 |
|---|---|---|
| `remotion still` 单帧 | 1920×1080 | 15–40s（含打包） |
| `make-gif.py` 单章 | 10s 动画 · 1440×810 · 6fps | 1–2 min |
| `remotion render` MP4 | 40s 成片 · 1080p30 · concurrency 2 | 8–20 min |
| `build-player.py` | 单入口 + 4 条 GIF 内嵌 | 5–15s |
| 断言全时间轴 | 4 章 × 每 0.02s 采样 | <5s |
| `npm install`（首次） | remotion 全家桶 | 2–5 min |

超过预估 2 倍：先查是不是在下载浏览器（见故障排除第 2 行）或 OOM 重试，
不要盲目加大超时反复重跑。

## CLI 速查（完整参数以 `--help` 输出为准）

| 脚本 | 用途 | 关键参数（默认值） |
|---|---|---|
| `make-gif.py <Comp>` | 合成 → 高清 GIF | `--out`(必填) `--project`(animations) `--scale`(0.75) `--every`(5) `--max-mb`(12) `--colors`(128) `--concurrency`(2) |
| `build-player.py <entry> <out>` | 打包单文件交互 HTML | `--project`(animations) `--title`('') `--gif 标签=路径`(可重复,选填) `--gif-name`(动画) |
| `assert-self-contained-html.mjs <html>` | 拦外链依赖 | `--fragment`(Artifact 片段模式) |
| `assert-orthographic.py <图>` | 正投影判定 | `--len-mm --wid-mm --wb-mm`(必填,实车三围) |
| `assert-assets-in-sync.py` | 资产库↔工程 md5 同步 | 无参数,改素材必跑 |
| `cutout-trace.py <子命令>` | 抠形工具链 | `scan/bright/erode/bleed/grid/encode/preview`,各子命令 `--help` |
| `extract-rim.py` / `extract-broll.py` / `analyze-reference-video.py` | 轮辋抠取 / B-roll 判定 / 参考片量化 | 见各自 `--help` |
| `validate-animation-manifest.mjs` / `make-shotlist.mjs` | 决策卡校验 / 分镜表 | 位置参数 = manifest 路径 |
| `preflight.sh` | 环境自检 | 读 `REMOTION_BROWSER` 环境变量 |
| `update.py` | tarball 副本自更新 | 仅联网环境;git 工作区自动拒绝;zip 导入环境不要跑 |

## 可移植性说明

- **浏览器路径**：统一用环境变量 `REMOTION_BROWSER`（默认 `/opt/pw-browsers/chromium`），
  preflight.sh 与 make-gif.py 都读它；换环境 `export REMOTION_BROWSER=/path/to/chrome` 即可
- **Claude Code 特有机制**（`SendUserFile`、Artifact 发布）不是本 skill 的依赖——
  其他执行器按步骤 4 的降级序列交付即可；Artifact 相关坑只在 Claude Code 环境生效
- **平台差异**：Chromium headless 相关修法在 Linux 实测；macOS/Windows 未验证，
  首次跑先过 preflight；无外网环境 npm 装不了 → 按步骤 0 的分工模式处理
- **接入新平台前**：按 `references/environment.md` 的问题清单与平台方对表，
  按其降级表确定能力边界
- **产物零依赖**：交付 HTML 全内联单文件，任何现代浏览器离线可开，与执行环境无关

## 资源索引

**规则（何时读哪份）**

- `references/hard-rules.md` — 全部强制规则一页清单。**每次动手前 + 交付前**
- `references/delivery.md` — 交付详版（agent 交付形态/宣传片路径/HTML 打包/MP4）。**步骤 4 前**
- `references/layout-and-story.md` — 配色/信息卡/几何证据/环境/缺口标注。**画 UI 层前**
- `references/motion-and-assertions.md` — 动作常识/断言方法论/状态机。**画可动件前**
- `references/photo-stage.md` — 照片当舞台的全部方法与坑。**用实拍图前**
- `references/animals-and-pets.md` — 生物主体画法与照片剪纸路线。**画动物前**
- `references/scene-and-assets.md` — 选材判据/资产库/正投影/中性车。**选素材前**
- `references/cutout-lab.md` — 抠图量测的全部实测经验。**抠新图前**
- `references/remotion-basics.md` — Remotion 官方基础规则（英文原文）。**不熟 Remotion 时**
- `references/animation-routing.md` — 决策卡完整路由。**步骤 1**
- `references/vehicle-assets.md` — 车辆资产硬约束与落位公式。**用车辆资产前**
- `references/environment.md` — 完整环境需求/降级表/平台方问题清单。**接入新平台前**
- `references/nio-colors.md` — NIO 配色 token 全表
- `references/live-action-path.md` — 实拍宣传片三条路径。**用户问宣传片时**
- `references/feishu-delivery.md` — 飞书文档流程（仅用户点名时）

**脚本**：见上方 CLI 速查表；**资产**：`assets/vehicles/`（按车型分目录）、
`assets/pets/`（真实宠物剪纸，README 是调用规则）。

> 决策卡路由、分镜模板、缺口标注、素材合规溯源、语义锚点这几套方法，
> 吸收自内部 `vehicle-feature-animation` skill；两个校验脚本在其基础上改编。
> Remotion 官方规则原文安装自 gist.github.com/ThariqS/3d446e7c7aa9eb94f468194deb73028f。
