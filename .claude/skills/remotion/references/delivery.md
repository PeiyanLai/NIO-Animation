# delivery

> 交付详版 —— 公司/外部 agent 交付形态、实拍宣传片路径、HTML 打包做法、MP4 导出。
> 本文件由 SKILL.md 按公司 skill 规范(≤500 行)拆分而来,内容为原文平移;
> SKILL.md 保留概览与索引。

## 在公司/外部 agent 里交付时的形态（强制）

本 skill 被公司内部 agent（或任何非 Claude Code 环境）消费时，交付方式有两条硬要求：

1. **HTML 文件本体必须交到用户手里**——按「交付闭环」一节的降级序列执行：
   附件工具 → 下载链接 → 绝对路径+取用方法，三级都写明了，没有借口。
   **开工前先自检自己有哪一级的能力**；不许只把产物留在工作目录、只贴代码块、
   或只报一句「已生成」。
2. **交付页右上角必须带「高清 GIF 一键下载」入口**：每个场景一个按钮 + 一个
   「全部场景打包 (zip)」。做法是 GIF 先用 `make-gif.py` 预渲染，再由
   `build-player.py --gif 标签=path.gif --gif-name 功能名` 内嵌（可重复传 `--gif`）。
   **不要**尝试在浏览器里现场截帧转 GIF——Player 是 DOM/SVG 渲染，客户端转
   GIF 又重又不稳。

   为什么这么设计：第一版动画往往不是终稿，用户会跟 agent 对话迭代；每一版
   HTML 都自带 GIF 下载，用户满意的那一刻就能立刻拿走高清 GIF 贴进飞书，
   不用再回来向 agent 要一轮。

   两个已踩过的坑：
   - fragment 必须自带 `<meta charset="utf-8">`（build-player.py 已内置）——
     下载到本地直接打开时没有外层 head，浏览器猜错编码会让全页中文和
     zip 文件名变乱码。
   - claude.ai Artifact 查看器的沙箱会拦截页面自身发起的下载，**GIF 下载入口
     的验收必须把 HTML 下载到本地打开来做**，在 Artifact 里点了没反应不是 bug。
   - 带 GIF 的页面可能超过 Artifact 16MB 上限（实拍舞台的章节 GIF 单条 2–4MB，
     长章节地形类可到 10MB+）。线上预览版可以不带 `--gif` 重打一份去发布——
     反正沙箱里下载入口也不可用；**对话框附件版必须是带 GIF 的完整版**。
     超长章节的内嵌 GIF 允许把 `--every` 提到 8（≈3.75fps）控体积，
     分辨率保持 1440×810 不降。

## 交付形态：从网页演示到实拍宣传片

决策卡可以带 `deliverable` 字段，默认 `["explainer-html"]`。可选：
`explainer-html`（交互网页，默认）· `explainer-mp4`（成片，用户明确要求时）·
`shot-list`（给拍摄用的分镜表）· `overlay-plates`（给后期用的带 alpha 叠加层）。

**先问受众**：决策卡可带 `audience: "internal" | "external"`（默认 external）。
「宣传级」里贵的是**对外**，不是**实拍**——对内宣讲不追求电影质感、样件可用 3D 打印/纸板/
市售平替（标注即可）、`conceptualItems` **不要求归零**、合规只需知悉范围 + 保密 + 知情同意 +
片头标识，一个下午就能拍。对外传播才需要审批、肖像权、广告法、场地空域许可。

对内场景里**动画和实拍各干各的，混剪最强**：机构类内容（锁舌咬合、信号接力、坡度推算、
可及范围）用动画——实拍反而看不清；体感类内容（狗肯不肯走、猫闹不闹、手顺不顺）用实拍——
动画永远证明不了，**画出来的狗当然会乖乖走上坡，那是我画的**。

对内实拍最大的价值是**验证动画回答不了的产品风险**：买个市售平替拍一下午，就能知道
「多陡开始犹豫」，这比在会上讨论三轮有用，而且拍回来的实测值能反向填掉 `conceptualItems`。

**关于「对外的宣传级视频」**：本环境**不能生成实拍画面**——没有可用的视频生成模型，
Remotion 只渲染你画的东西，也没有 3D 管线。而且即使有生成模型也不该用在主体上：宣传级要求
车型细节准确（大饼轮毂 9 个孔）、尺寸真实（787mm）、动作合规，生成模型对这些没有约束能力。
**宣传级实拍是拍摄工程，不是渲染工程。**

但我们做的东西正好是拍摄前最缺的技术底稿：

- `chapters[].claim` → 每个镜头要证明什么
- `acceptance[]` 里的数字 → 镜头必须拍到的可量化事实（验收拿它对素材）
- `*-geo.ts` 的实测标定 → 构图与机位参数
- **`conceptualItems[]` → 开拍前必须归零的清单**

最后一条是实拍与插画的分水岭：**概念件可以画，但拍不出来。** 一个还有 10 项未定义的功能
今天不具备开拍条件，因为那 10 件东西还不存在。所以

```
liveActionReadiness.blockers === conceptualItems.length
```

归零之前实拍这条路走不通；归零那天，分镜表一条命令就能生成：

```bash
node scripts/make-shotlist.mjs <manifest.json> > shotlist.md
```

同一份组件也能产出**给后期用的叠加层**（去掉背景，导出带 alpha 的 PNG 序列或 ProRes 4444），
让实拍空镜配上我们算好的坡度标注、可及范围、信号链路——这是这类科技宣传片的通行做法。

**用户给参考片要求「做成宣传级」时**：先把「宣传级」拆两半——**动效语言（节奏、缓动、
字幕、转场、配色）能学且能量化**，**实拍画面不能生成**。用
`python3 scripts/analyze-reference-video.py <参考片.mp4> --out style-ref` 把参考片量成
`style-spec.json`（镜头时长分布、每分钟切点数、色板、明暗分布 + 每镜代表帧），
动画照这组参数编排，而不是凭感觉「做得高级一点」。

对内宣讲最实际的形态是**官方已发布 B-roll + 我们的动画 + 手机实拍的三段混剪**：
车辆美学用官方素材（那个质感我们拍不出也没必要拍）、功能机构用动画（实拍反而看不清）、
产品验证用手机实拍（动画证明不了）。片子里一半画面本来就是蔚来拍的，
「像蔚来的片子」这件事天然成立。

**用户只能提供 mp4 时**：先用 `python3 scripts/extract-broll.py <参考片.mp4>` 判定它是
**原片还是录屏**——脚本按有效画面区分辨率、静态叠加物（水印/台标）、镜头时长明暗三项判定，
输出每个镜头能不能当 B-roll。带第三方水印的一律只能作参考，**不许裁掉水印后使用**。
能拿到原片的话，混剪**不需要 Premiere**：Remotion 的 `<OffthreadVideo>` 打底 + 我们的动效叠加，
直接渲一条 MP4。但带视频的混剪**只能是 MP4，不能是单文件 HTML**（视频无法 base64 内联），
所以交付变成 HTML（纯矢量）+ MP4（混剪）两份。

完整路径分析、参考片分析用法、导出命令、合规清单见 `references/live-action-path.md`。
**用户问到实拍/宣传片时先读那一份**，不要凭感觉承诺能力。

### HTML 交付做法（已验证）

`<Player>` 把 composition 直接嵌进网页播放，不需要渲染：

```tsx
import {Player} from '@remotion/player';

<Player
  component={Stage}
  inputProps={{scene: 'a'}}
  durationInFrames={408}
  fps={30}
  compositionWidth={1920}
  compositionHeight={1080}
  style={{width: '100%'}}
  controls loop autoPlay clickToPlay={false}
/>
```

打包成**单文件 HTML**（Artifact 要求自包含、禁外链）：

```bash
npm i @remotion/player esbuild
npx esbuild src/player-entry.tsx --bundle --minify --format=iife --target=es2020 \
  --define:process.env.NODE_ENV='"production"' --outfile=bundle.js
```

然后把 `bundle.js` 内联进 `<script>`，并跑自包含硬校验：

```bash
node scripts/assert-self-contained-html.mjs page.html --fragment   # Artifact 片段加 --fragment
```

要点：
- **图片素材必须 base64 内联**，不能用 `staticFile()`——单文件 HTML 里没有 public 目录。做法：把图片转 base64 写成 `src/photo.ts` 导出常量，组件里引用它；这样 HTML 与 MP4 两条路都能用
- 外层包装组件（场景切换 chips、说明文字）是**普通交互 React**，可以用 `useState`；只有 `<Player>` 里的 composition 必须遵守帧驱动、无事件、确定性的规则
- 切换场景时给 `<Player key={scn}>` 加 key，强制重挂载以重置播放头
- **主画面必须能点击暂停/继续**（`clickToPlay`），暂停时时间轴、车辆位移、地面纹理、CSS 动画要一起冻结，并给一个简短的「已暂停 · 点击继续」反馈。只在页面底部放播放条是不够的——评审时需要停在某一帧细看
- 讲「行驶中地形/场景切换」时，**不要用静态换图代替过程**：车辆要有可感知的横向位移、路面纹理反向流动，再在识别时刻过渡背景，最后给提醒
- 参考实现：本仓库 `animations/src/player-entry.tsx`

交付页版式已经稳定，直接照抄（六个动画都是这一套）：**标题 + 一段导语（把功能一句话讲完，
并点出关键数字）→ 章节 chips（每个带标题与一行副标题）→ Player → 3–4 段实现注记
（讲清楚「这个数是怎么算出来的」，建立可信度）→「演示说明（待确认）」列出全部
`conceptualItems`**。导语和注记里要出现具体数字（787mm、23°、5–8km、700mm），
它们是这份文档区别于 PPT 的地方。

### MP4 导出（仅在用户要求时）

```bash
npx remotion render <CompId> out.mp4 \
  --browser-executable=/opt/pw-browsers/chromium --chrome-mode=chrome-for-testing
```

**本环境三个坑**（已踩）：
1. 必须指定预装的 `/opt/pw-browsers/chromium`，外网受限，别让 Remotion 自己下载浏览器
2. 新版 Chromium 移除了旧 headless 模式，**必须加 `--chrome-mode=chrome-for-testing`**；该参数需要 Remotion **4.0.5xx 及以上**，4.0.246 会报 "Old Headless mode has been removed" 且无此参数——先 `npm i remotion@latest @remotion/cli@latest`
3. **找 Remotion 自带的 ffmpeg 不能靠路径和 `-x` 判断。** npm 会把 `compositor-linux-x64-gnu`
   和 `compositor-linux-x64-musl` 两个目录都装下来，两个 ffmpeg 都存在、都是 +x，
   但非本机那个执行时 rc=127（缺动态加载器），Python 还会把它报成
   「FileNotFoundError：找不到 ffmpeg」——完全误导。**唯一判据是真的跑一次 `-version`**。

npm registry 可用，`npm create video` / 安装 `remotion` 与 `@remotion/*` 均正常。
