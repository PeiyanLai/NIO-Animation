---
name: remotion
description: 用 Remotion（React 帧驱动框架）以代码方式制作动画，默认交付可发链接的交互 HTML（@remotion/player 单文件打包），仅在用户明确要求时才导出 MP4。当用户提到：Remotion、React 做动画/视频、代码生成动画、programmatic video、要多段落/转场/配乐合成的成片、把 React 组件变成可播放页面或 MP4，或要求比单文件 SVG 动画更工程化的产线时使用本技能。与 feature-animation 的分工：一次性单文件 SVG 动画走 feature-animation；需要 React 组件化、时间轴合成、转场、参数化多版本的产线走本技能。
---

# remotion · React 代码驱动动画

> 来源：Remotion 官方推荐的 AI 编码规则（安装自 gist.github.com/ThariqS/3d446e7c7aa9eb94f468194deb73028f）。以下技术规则保持原文（英文）。

## 交付策略：默认 HTML，不默认出 MP4（成本约束）

**默认只产出交互 HTML**（`@remotion/player`），发 Artifact 链接给用户自己看。**不要主动渲染 MP4**——只有用户明确说"要视频/要 MP4/要发微信飞书"时才渲，且必须在 HTML 定稿之后渲**一次**，绝不在视频上做迭代。

原因（真实成本来源）：渲染命令本身只输出几行日志，不贵；贵的是**"渲染 → 抽帧读图 → 修 → 重渲"的视觉验证循环**——每张 1080p 截图都是实打实的图像 token，来回十几张就很可观。交互 HTML 把这个验证环节交还给用户（他打开链接就能看、能暂停、能拖拽逐帧），成本直接归零。

配套的省钱纪律：
- 校验优先用**无图断言**（DOM/数值检查、页面零报错），而不是截图目检
- 确实要看图时，只在关键节点看 **1 张**，并裁切/缩小到必要区域，不要整帧 1080p 连看多张
- 让用户当验收人：先发链接，等他指出问题再改，不要自己反复猜

## 交付闭环（强制）：对话框发 HTML → 生成飞书文档 → 动画平铺在文档里

动画定稿后**每次都要走完这两步**，不要只丢一个链接就结束。

**换一台 agent 跑本 skill 时，先自检一次分工：**

```bash
bash scripts/preflight.sh          # 查 node / remotion / chromium / ffmpeg / PIL
```

**HTML 和 GIF 出自同一条流水线**（都靠 `remotion render` + 无头浏览器），
不存在「能出 HTML 但出不了 GIF」的中间态。全绿 = 这台 agent 自己跑完整链路；
有红 = 它只做飞书那一段，HTML 和 GIF 由能跑渲染的一方产出后交给它——这个分工完全可行。

⚠️ **不要用「它已经把 HTML 插进飞书了」来推断它能跑渲染**——那份 HTML 很可能是
别人产好递给它的，它只做了插入。要判定就跑一次真的渲染，别看结果看过程。

**第一步：对话框里先给 HTML 文件**，让人能预览、能点下载（本环境用 `SendUserFile`，
`display: 'render'` 可直接在侧栏打开）。同时给一句使用说明：**点击画面暂停/继续、
顶部 chips 切章节**——不说没人会去点。

**第二步：生成飞书文档，把动画平铺进正文。**

⚠️ **飞书文档没有能运行 HTML 的块**，交互 HTML 在文档里跑不起来。文档里唯一能自己动的是
**GIF 图片块——插进去就自动循环播放，零点击**。所以正文平铺 GIF，HTML 作为附件跟在旁边，
给需要暂停逐帧的人用。这是能力边界，先说清楚比让人反复试省时间。

```bash
python3 scripts/make-gif.py SceneA --out out/terrain-ch1.gif   # 默认 0.75 / every 5
```

**两个已经被投诉过的坑，默认值就是照着它们定的：**

1. **GIF 糊。** 飞书正文宽 700–900px 且 Retina 按 2 倍渲染，所以 GIF 横向像素要给到
   显示宽度的 1.5–2 倍。`--scale 0.75`（→1440×810）是及格线，**不要为省体积往下调**——
   实测 576px 和 730px 宽都被判定为「糊」。要省体积就降帧率、缩短单条时长。
   （1080p30 直接渲会 OOM，实测 exit 137，`--concurrency=2`。）
2. **HTML 只插链接 → 别人点开 403。** agent 上传后拿到的是签名 URL（`?sign=…&t=…`），
   签名绑在签发会话上，自己点得开、**团队成员从文档点开就是「您未获授权」**。
   必须把 **HTML 文件本体传成飞书 file 块**，权限跟着文档走；本 skill 的 HTML 是全内联
   单文件，下载后离线也能完整播放——这句话要写进文档里告诉大家。

**多章动画一定按章拆成多个 GIF**，每章插在自己的小节下——拼成一条长的会同时踩
体积超标和「不知道讲到哪章」两个坑。

文档结构、块类型能力边界、OpenAPI 三步走（建空块 → upload_all → PATCH 回填）、
交付闭环见 `references/feishu-delivery.md`。**GIF 必须走 image 块**才会自动播放，
走 file 块就只是个要点开的附件。

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

## 第 0 步：先做动画决策卡，再写代码

**最容易犯的错是把所有功能都套成「车在路上行驶」**。动手前先分类，把结论写成 `animation-manifest.json`：

```json
{ "title": "功能名", "vehicle": "ES9", "scope": "vehicle-environment",
  "mechanism": ["automatic-detection", "state-transition"],
  "conceptualItems": ["尚未定义的方向盘快捷键"],
  "chapters": [{"id":"c1","claim":"驶入雪地会被自动识别","scene":"车外侧视","startState":"柏油/标准模式","endState":"雪地/待确认"}],
  "assets": [], "acceptance": [] }
```

用 `node scripts/validate-animation-manifest.mjs animation-manifest.json` 校验。完整路由规则见 `references/animation-routing.md`，要点：

**演示空间（scope）决定主画面**：`vehicle-exterior` 外观特写 · `cockpit` 座舱+HMI 覆盖层 · `vehicle-environment` 车外→座舱→车外 · `vehicle-ecosystem` 外设→车→自动结果 · `vehicle-system`（热管理等不可见系统）概念示意+状态卡 · `fleet-topology`（组队/无网通信）地图节点+链路。

**机制（mechanism）可多选**：`user-action` / `automatic-detection` / `state-transition` / `device-pairing` / `data-sync` / `relay-network` / `exception-handling`。

**输出形式按复杂度选**：单条路径且状态 ≤3 → 一段线性演示；自动触发且切换座舱/外观 → 3–5 章叙事；有状态机/多端同步/冲突规则 → 主叙事 + 可点击状态探索；多节点关系 → 拓扑动画 + 场景切换。**有复杂状态机时不要硬压成一条线性短片**。

**每一章的叙事顺序**：触发 → 判断/交互 → 执行 → 可感知结果。**一章只讲一个用户能听懂的结论（claim）**，并写明 startState/endState。

## 需求缺口：标注概念化，不要臆造

文档没写的东西一律不许当成既定设计：缺车型 → 追问，只用中性概念车；缺物理键位 → 显示「方向盘确认」这类概念交互，不绑定具体按键；缺正式 UI → 画品牌视觉一致的概念状态卡；缺硬件外观 → 中性图标 + 中性命名；异常分支太多 → 主动画只走代表性 happy path，其余进状态探索。

所有这类内容登记进 `conceptualItems`，并在页面的「演示说明」里列为待确认——但**不要在主画面上贴「非真实 UI」水印**破坏观感。

**缺口要问到「能改变画面」的粒度**，不要写成「外观待定」这种没法回答的话。判断标准是：
这个答案变了，画面要不要重画？

- 斜坡架**长度** → 直接决定坡度（2.0m 给 23°，1.5m 就是 32°，对老年犬是两回事）
- 栓绳**长度** → 决定「活动范围」那段弧画多大，也决定宠物能不能转身
- 包**高度** vs 宠物**坐高** → 差 3% 头就只露一点点，「伸手摸摸」的画面直接站不住
- 物理键**位置** → 侧面键只有同侧乘员顺手，放顶面才是两边都能按

反过来，「材质用什么布」这类不改变画面的，不必进清单。

## 配色与背景（强制）

**一律用 NIO（NIOFlow）配色**，完整 token 见 `references/nio-colors.md`；用户未指定其他品牌时不得自选配色。要点：

- **默认浅色底**：大面积背景**仅限 #FFFFFF / #F0FAFA / #E8FAFA**。⚠️ 不要自作主张做成黑底/深色底——NIO 规范的底色是浅青调，深色版只在用户明确要求时才做
- 主色 **#00bebe（文本/描边）、#00D4D4（高亮/渐变顶）只做强调**，单块面积 ≤15%，每屏 ≤3 处
- 中性色用青调灰（ink #1A1F1F 标题 / #2E3D3D 正文 / #5C7070 辅助 / #8AABAB 说明），**禁止纯灰 #888/#666**，正文不浅于 #5C7070
- 分割线 #D8EEEE / #B8DEDE；卡片浅底 #D0F5F5
- 语义色：Good/完成 #00AAAA、警示琥珀 #D49922、Negative #D14545（极少用）
- 分类色（多类别区分）：青 #00D4D4 / 紫 #5D4DD4 / 琥珀 #D49922
- 浅色底上的主体（照片/矢量）要给**接地投影**（如 `#5C7070` opacity .16 的扁椭圆），否则像浮在空中

**背景必须纯色**——`AbsoluteFill` 直接填一个背景 token。**禁止任何网格线、格纹、参考线、纹理底**（`linear-gradient` 网格、`backgroundSize` 棋盘、坐标网格一律不要）。舞台上只允许出现内容本身：主体、地面/环境色块、UI 层。

## 信息展示的位置（强制）

**信息必须贴着主体，像从主体弹出的气泡，禁止丢到画面边角。**

用户教育动画里最常见的失败不是画得不好看，而是**看的人不知道该往哪儿看**：字幕在最下面通栏、状态 pill 在左下角、读数在右上角，主体在正中间——眼睛要在四个角之间来回跳。规则：

- 字幕、状态卡、读数、进度点、模式徽标，一律放在**主体的上／下／左／右侧、紧邻主体**（间距 24–40 个舞台单位），不许放进画面四角，不许做底部通栏字幕条
- 每块信息都要有**指向关系**：卡片朝主体方向的实心小三角，或一条 4–6px dash 的引导线 + 端点圆点，落在它描述的那个部位上（讲宠物就指向宠物所在座椅，讲桥接就指向那台车）
- 主体会动时，卡片**跟着主体走**，并 `clamp` 在安全区内；跟不动了就让引导线拉长，卡片本身不要跑出画面
- 同一屏最多两块贴身信息（一块叙事字幕 + 一块状态读数），其余合并进卡片，不要在主体四周糊一圈标签
- 只有「视角标签」这种非信息内容（`俯视图 · TOP VIEW`）可以留在角上
- 断言里加一条：卡片矩形与主体外接矩形**不重叠**、四边不出界、不越过场景关键线（车位线/分界线）

## 动作必须符合常识（强制）

**演示的是真东西怎么动，不是「怎么实现方便怎么动」。** 反常识的开合方向、旋转轴、运动顺序，
看的人第一眼就会觉得不对，而且说不出哪里不对——这比画得糙杀伤力大得多。

动手画任何**可动件**之前，先把这三件事一起定死，缺一个就会出错：

1. **铰链/转轴在哪一侧**——尾门铰链在车顶后缘（下缘向上翻起），不是在保险杠；车门铰链在前缘（向外开），不是向车内开；抽屉是水平抽出，不是向上翻
2. **朝哪个方向转**——把「开到位」的位姿手算一遍：取部件上离转轴最远的那个点，算出它旋转后的坐标，确认它去了**符合直觉的那一侧**（尾门下缘必须抬到铰链高度附近，而不是往下甩到车外）
3. **开到多大**——电动尾门全开后门板大致水平地向车后伸出（约 72–80°），不是翻过头贴到车顶

### 正侧视看「开口」：只应该看到一条缝

这一条单独拎出来，因为它连着改了三轮才改对。

**正侧视是侧对着开口看的——开口平面几乎和视线平行，本来就只应该看到边缘那一条缝**（门板厚度 + 门洞内侧那么一点点）。按「门板 footprint 整块挖」得到的是**从后方看**才会有的观感，所以只要方向错了，怎么调小都还是一块面。

- 判断方法：问「这个开口的法线朝哪儿？」法线指向镜头 → 看到一个面；法线垂直于视线 → 只看到一条缝
- 尾门/后备箱在正侧视里：缝宽 ≈ 车长的 2–3%，从腰线附近一直到门槛
- 开口的**外侧边界必须直接取自主体轮廓**（同一组常量）。两条边都画在主体内部，渲出来是「车身上的一块补丁」，不是开口
- 「抬起的门板」和「车身上挖开的口」是**两个独立轮廓**：门板整块绕铰链抬起，车身上只挖那条缝，不要用同一条 path 兼职
- 断言：开口宽度 ≤ 主体尺寸的百分比上限，且外侧边界点与主体轮廓的距离为 0

配套硬规则：

- **开口大小要克制**：挖掉的面积必须和真车的钣金分缝一致。侧视图里尾门只是车尾包边那一条，
  把后侧围和后风挡一起算进去会在车身上切出一个夸张的大洞。写成断言：开口宽度 ≤ 主体尺寸的百分比上限
- **开口内景不要画成纯黑**：整块涂黑会读成「车身被挖掉一块」而不是「看进去了」。
  用从亮到暗的渐变（上半透出远侧玻璃/顶棚，越往下越是行李厢阴影）
- **运动顺序也有习惯**：先解锁再开、先合盖再提走、先停稳再操作、先看到反馈再进行下一步。
  把顺序写进相位，不要为了省时长把两个动作并成一个
- **拿不准就去找实物照片确认铰链在哪**，不要凭感觉——这类错误自己检查不出来，只有用户能看出来
- 把上面三件事写成断言：铰链必须落在部件的指定一侧、开到位后特征点必须到达指定区域、开口尺寸不得超限

## 断言：把叙事结论写成可失败的检查（强制）

六个动画做下来，**断言抓到的问题全部是肉眼看不出来的**：泊车碎步时车角啃进邻车 10px、
犬掌陷进坡面、起跳最高点其实够得到装载口（整章叙事作废）、栓绳被悄悄拉长、信息卡压住主体。
截图目检抓不到这些，也不该用截图去抓——那是最贵的验证方式。

**核心原则：动画声称什么，就断言什么。** 叙事结论本身就是最重要的断言：

| 画面在说 | 必须断言 |
|---|---|
| 「大狗跳不上去」 | 起跳最高点 < 装载口高度（够到了这一章就废了） |
| 「能活动但出不去」 | 栓绳长度全时间轴 ≤ 绳长，一次都不许被拉长 |
| 「主副驾都够得着」 | 两个可及扇形都与目标矩形相交 |
| 「车身始终摆正」 | 全程 \|ψ\| < 0.5°，不是「看起来挺正」 |
| 「前后已停满，只能碎步」 | 车身旋转矩形与邻车 SAT 间距 ≥ 10px |
| 「头露在包外才能摸」 | 宠物坐高 / 包高 > 1 |

写法要点：

- **渲染端与断言端必须共用同一个纯函数**。把位姿、状态、时间轴抽成 `poseAt(scene,t)` /
  `radioState(k,t)` 这类纯函数，组件和断言都从它取值——各写一份必然漂移，断言就成了摆设
- **逐 0.02s 采样整条时间轴**，不要抽查关键帧。上面几个 bug 都只在某个中间帧成立
- **断言要能失败**：「应该发生」和「绝不能发生」都要写。只写前者的断言一般是自我安慰
- 几何量优先断言**关系**而不是数值：`sin(坡度)·坡长 = 装载口高`、`内缘弦/外缘弦 = 0.50`、
  `肩高/车高 = 570/1870 ±3%`——数值会随布局调整，关系不会
- 模型有解析解时加**退化自检**：四轮转向在 δr=0 时必须退化为经典自行车模型、δf=δr 时横摆恒零。
  自检过不了说明公式本身错了，后面所有断言都没意义

常用断言清单（原语见 `scripts/assert-timeline.mjs`）：值域上限 · 单调性 · 终点精度 ·
矩形 SAT 间距/不重叠 · 出界 · 禁越线（车位线/分界线/主体轮廓）· 状态机单向 ·
相位覆盖完整且边界严格递增 · 尺寸比例自检 · 模型退化自检。

### 状态机要显式，跃迁必须由用户动作触发

功能里出现「开/关」「锁/解锁」「绑定/解绑」「入队/掉队」时，**不要用一堆布尔量拼**，
写成显式枚举 + 单向推进：

```ts
type LatchState = 'free' | 'placed' | 'locked' | 'released';
```

断言两条：**严格单向、每步 +1**；**每次跃迁都落在一个用户动作相位内**——自动跳变的状态机
会让人以为「它自己会锁」，而实际产品需要人按一下。

### 正交的两个状态不许绑成一个动作

宠物包的「敞篷开合」和「固定/解锁」是两件独立的事。如果做成一个动作同时干两件，
看的人会以为「解锁就会自动合盖」。检验方法很简单——**断言四个组合里该存在的都存在**：

```
存在「敞篷开 + 已锁」的时刻，也存在「敞篷关 + 已锁」的时刻
```

两个都成立，才证明它们真的正交。这条同样适用于「组队状态 × 网络状态」「模式 × 路面」等等。

## 主张要有几何证据（强制）

需求文案里的「方便 / 够得着 / 不费力 / 放得下 / 不会走丢」都是**可以量出来的主张**，
不要用一句文案带过——在画面上给一个可测量的几何图形，并断言它成立：

| 主张 | 画什么 |
|---|---|
| 主副驾都能摸到 | 以两个肩点为心、单臂可及半径为径的两个扇形，与目标相交 |
| 宠物能活动但跑不掉 | 以栓扣锚点为心、绳长为径的虚线弧，被容器边界裁剪 |
| 坡越长越省力 | 直角三角形三条边全标出来，`sin(坡度) = 高 / 坡长` 看得见 |
| 跳上去很吃力 | 地面到装载口的双向高度标尺 + 起跳最高点的对比线 |
| 中间的车不会走丢 | 头尾两端的通信链路弧，明确罩住中间节点 |

这些图形的参数必须来自实车尺寸标尺（同一个 mm/px），不能为了好看随手画一个圈。

## 同屏多个主体：一把尺子量到底

画面里同时出现车和犬、包和猫时，**必须用同一个 mm/px 把两者都换算一遍，并断言比值**。
「犬肩高 570mm、车高 1870mm ⇒ 比值 0.305 ±3%」这条断言直接拦下过「把狗画成半个车高」。
比值优先用**实物规格之比**，不要用「看起来差不多」。

## 多视角动画：每个视角各自标定，切换要有过渡

一个功能需要两个视角讲清楚时（例：座舱俯视平面讲「包在哪、谁够得着」，岛台侧视剖面讲
「怎么固定、按键在哪」）：

- **每个视角各自标定一把尺子**并写进常量（`PLAN.mmPerPx` / `SIDE.mmPerPx`），不要共用
- 同一个物体要在两套坐标里**都登记一份**（`BAG` 与 `BAG_PLAN`），改尺寸时两边一起改
- 视角切换**必须有过渡**：先在旧视角高亮目标区域 → 推近 → 淡出到新视角。硬切会让人丢失位置感
- 视角的朝向约定写进文件头注释并**全工程只此一处**；常量与注释一旦矛盾，以常量为准并回头改注释

## 画生物体（犬 / 猫这类）

- **所有几何按一个尺寸参数归一化**（肩高 `h` / 坐高），内部全写成 `h` 的倍数，最外层统一
  `scale(h)`。写死像素的组件换个场景就得重画
- 四肢用**两骨 IK**：给根、关节、末端三个点算出骨长后固定，姿态由 IK 解——直接摆角度会
  画成直棍，一眼假
- 步态用**对角相位**（左前+右后同相）：周期 0.6s 上下，老年个体放慢约 30%；
  抬掌高度用 `sin(πu)`，两端恰好为 0，掌才不会穿地
- **导出 `pawY(leg,t,h)` 这类纯函数供断言用**：任一时刻 ≥2 掌支撑、掌不穿地、躯干起伏 ≤2%
- 近侧肢体调浅、远侧调深做出前后景深；主色只从环境色 token 里取，不要为了「像真的」引入品牌外的颜色

## 画动物：机械感的三个来源

给「机械狗」返工总结的，画任何生物侧视矢量形象都适用：

1. **身体内部不许出现线。** 肩线/髋线/肋线这类「结构描边」读作装甲拼缝——
   真实动物是软的块面，肌群用**无描边的填色块**表达，不用线。
2. **反荫蔽方向不能反。** 动物是背深腹浅（countershading）。把腹部画成一条深带，
   方向反了，立刻像喷了迷彩的机器。远侧肢体压暗要克制——压得太黑像金属肢。
3. **末端细节一笔就够。** 爪子加一条极短趾缝、尾下缘两笔羽毛、颊边两根短毛、
   耳内一道褶——每处一两笔就能把「零件」读成「身体」，画多了变噪点。

配套两条脸部规则：**垂耳前缘必须在眼睛之后**（耳根 x + 耳宽 < 眼 x，否则耳把眼盖住
整张脸读不出来）；**眼睛别画大**——大眼睛是「玩偶感」主源，猫眼画杏仁形加上睑线。

## 座舱照片换底图：缩放系数由「尺子一致」定，不是看着合适

把实拍座舱照垫进俯视/侧视舞台时，s 的判据是**照片的 mm/px 和舞台的 mm/px 尺子一致**
（例：photo 内宽 600px × s ≈ 舞台座舱内宽 245.5px ⇒ s=0.41）。这样 700mm 可及半径这类
几何主张在照片上**直接成立**，不用重标。tx/ty 由两个锚点解出（岛台中线、前排 H 点），
标完写数值断言逐项对到 ±1px。

## 透视照片当「实拍舞台」：只锚定一条接触线

透视照片（前排侧视这类）不能按上一节做全尺子标定——但**可以直接当舞台**，
把机构（宠物包/锁舌/按键）画在照片里的真实台面上，比「白纱氛围背景 + 矢量剖面盒子」
可信得多（宠物包动画就是被用户点名从剖面盒子改成实拍舞台的）。做法：

1. **只锚定一条几何：台面接触线。** 放大网格量出照片里可用台面段
   （被方向盘/座椅遮挡的两端要量出来），换算到舞台坐标；
2. 解相机 `screen = world·s + (tx,ty)`：让世界基准线（如 ISLAND_TOP）落在台面线上、
   机构落在台面段内。**s 不再由尺子定**，由「机构在台面段里摆得下 + 场内极值在画面内」定——
   敞篷开到最高点、包提起 + 手的顶点这些**场内最高点必须代回去验证在画面内**，写进断言；
3. 毫米级主张（绳长/行程/可及半径）全部留在矢量机构层，照片不背这些数；
4. 深度冲突手工排：机构不许压在比它更靠近相机的照片物体上（方向盘轮缘、座椅前缘），
   量出它们的舞台 x 范围、把机构挪进空当；小面积压不可避免时选视觉最轻的一侧。

两个已踩过的坑：**照片语义在缩小图上会误读**（把车外开门视角认成车内特写、把座椅
认成扶手），量之前先全尺寸放大 + 画探针合成图目检；**换照片必须整套重测**——
台面线是量出来的，不是常量。

三条同场景的强规则（都来自用户终审）：

1. **车内物件的配色必须适配座舱内饰**。概念件不要用主题色画——米白内饰里的
   teal 盒子一眼假。物件本体取内饰同族色（照片上取色），
   主题色只留给指引线/状态标注这类 UI 层。
2. **概念控件先在照片里找实车控件**。你标成「概念键位」的假想按键，用户会直接
   点名换成实车已有的物理控件（例：宠物包解锁键 → 岛台储物开关共用）。画之前先
   放大照片找现成的开关/把手，把机构锚到它上面，标注也不用再写「概念」二字。
3. **遮挡关系要「虚实结合」,不许生硬叠画**。机构件和照片里的实物(座椅)互相挡时,
   把实物前缘逐点实测成折线,同一份机构内容画两层:亮度遮罩剔除遮挡区的「实」层 +
   裁进遮挡区、~34% 透明度的「虚」层——被挡的部分读作「在后面透出来」。
   遮挡折线放数据层(SEAT_EDGE 模式),画和断言共用。
4. **主体朝向是产品语义,不是画面构图**。猫要朝车头——朝向一改,连锁改一串：
   绳锚点必须移到反方向侧壁(否则「走出去拉直绳」的物理不成立)、包壳舀口跟着开向
   头的那侧、限位从 x 上限变 x 下限。用一个 `DIR` 常量统一镜像
   （catClip/catBox/限位共用一个符号），别在各处各翻各的。

## 生物主体：有真实照片就用「照片剪纸」，矢量只做兜底

用户对矢量动物的终审是「换成真实的」。有可用照片素材时**直接抠图当剪纸偶**，
比继续修矢量快且可信：

- **抠图**：软羽化（颜色距离 smoothstep + 最大连通域 + 膨胀许可区）保毛边。
  ⚠️ **影棚灰底的投影和地面-背景过渡带颜色距背景很远，软抠会当成前景保留**——
  渲出来像一根跟着动物旋转的「棍子」。按「低饱和中灰 + 限定区域」清除
  （黑毛 v<85、白毛 v>208 都不动），清完**地线要重量**（可能不再是图底）；
- **标定**：狗 = 掌距中点 × 地线做原点、鬐甲高对齐世界肩高；猫 = 前掌对齐矢量猫
  fPaw 锚点、图高对齐坐高——这样绳长/限位这些几何契约不用重标；
- **动效**：整体剪纸偶——蹲伏/卧下 = 以地线为轴 scaleY 压缩，抬头/坐下 = 绕后掌枢轴旋转，
  常驻呼吸 = sy 微正弦。位姿切换在数据层做 0.5s 平滑（catPhotoXf 模式），别让照片瞬跳；
- **走路要真实迈腿（用户会点名要求）**：升级成**关节腿剪纸**——
  把两组可见腿从照片裁成独立贴图，身体图在「腿根线」以下清掉 alpha；
  走路时四条腿（近腿原色、远腿压暗 ~26%）绕各自腿根枢轴按**对角步态**反相摆动
  （近前+远后同相 ±11°，远前+近后反相），身体盖在腿根之上——长毛缘天然盖住接缝。
  腿根线用逐行 alpha 覆盖率找（覆盖率从「躯干级」跌到「腿级」的那一行）；
  身体只留步频 bob + ≤1.2° 摇摆，摆多了像船。senior 版摆幅 7°、周期放慢；
- **朝向**：镜像要在组件里做并写明理由（照片头朝左、世界约定头朝 +x）；
  老年个体用 SVG `feColorMatrix saturate` 压饱和表现，别再换一张图；
- 暗腔里的深毛色主体会隐形（黑背边牧在后备箱洞里）——给洞内实例加提亮滤镜。

矢量版本（Dog.tsx/Cat.tsx）保留做兜底：拿不到可用照片、或要画俯视小图标
（CatTop）时仍用它。「画动物：机械感的三个来源」那节的规则只在兜底路径生效。

## 拆给多个 agent 并行做时的分工

一个动画拆开并行做，冲突几乎全在「谁改哪个文件」上。可行的切法：

- **几何标定留在主线自己做**（照片抠形、映射常量、实车尺寸换算），产出一个只读的 `*-geo.ts`
  交给下游——这一步最容易出错，也最需要来回看图，不适合并行
- **组件与舞台分给不同 agent**，用**明确的接口契约**对接（`<Dog t pose h senior op>`、
  局部坐标原点与朝向写死在契约里），下游按契约先写调用方，组件没到位就用最小占位
- 每个 agent 的任务书里写死**可改文件清单 + 禁改文件清单**，并说明「别的 agent 正在改它们」
- 交付页打包、artifact 发布、git commit **一律留在主线**，agent 只做到「本地验证通过」为止

## 环境要具象到「一眼可辨」（强制）

环境不是背景色块。只把地面涂成白色，看的人不会认为那是雪地；只涂成黄色，也不会认为那是沙地。**每种环境至少要有一个「一眼就认出来」的实体道具 + 一层运动**：

| 环境 | 立体道具（地面线以上） | 地面细节 | 运动层 |
|---|---|---|---|
| 雪地 | 雪人、带雪冠的松树、雪堆小丘 | 连绵雪丘轮廓、雪痕虚线 | 飘雪粒子（大颗粒画六角雪花并自转） |
| 泥地 | 泥埂隆起 | 双道车辙（虚线做胎纹）、不规则泥坑、飞溅泥点 | 轮下溅泥 |
| 沙地 | 仙人掌、枯木、干草簇、远近两层沙丘轮廓 | 风纹波浪线 | 扬沙短划从右向左 |
| 湿地 | 芦苇（弯茎 + 蒲棒） | 水洼倒影 + 水平高光 | 涟漪圈持续扩散 |
| 碎石 | 路肩碎石堆 | 大小不一的多边形石块 + 高光面 | — |
| 柏油/常规 | — | 边线 + 虚线车道标线 | — |

配套硬规则：

- 道具位置用**确定性伪随机**：`rnd(i) = frac(sin(i * 127.1 + 311.7) * 43758.5453)`。**绝不能用 `Math.random()`**——每帧重算会导致道具满屏乱跳，MP4 也无法复现
- 道具颜色只从既有 token 取（环境色的 base/dk + 中性色），不要为了「像真的」引入品牌外的颜色
- **立式道具经过主体时要淡出**：侧视图里主体底部与地面之间有缝，背景的树/仙人掌会从主体底下「长」出来。做一个 `behindCar(x, dx)` 之类的函数，道具屏幕坐标进入主体横向范围时 opacity → 0，两侧各留 40–50 单位的渐变带
- 环境切换时道具跟着**淡入淡出**（0.5–0.7s），不要硬切

## 关键识别特征必须画出来

主体如果有「行内人一眼认出是这台车/这个产品」的标志性特征（轮毂造型、灯带走向、格栅纹样），**必须画准，且不能被简化掉**——这是可信度的来源。

- 找到用户/官方提供的特写参考图，**数清楚数量再画**（例：ES9 大饼轮毂是 9 个孔、等分 40°，不是「一圈孔」）
- 结构性特征优先于装饰：先把「实心抛光盘 + 9 孔 + 中心盖」的层次画对，再谈渐变高光
- 旋转件的高光要画在**旋转组之外**（光源固定不跟着转），孔用 `<mask>` 做成真镂空并透出下层轮腔/卡钳，转起来才看得出在转
- 登记进 `approved-asset-manifest.json`，`visualFidelity: "reference-only"`——参考图只用来定型，不直接贴图

## 现成资产：不要重画车（**资产库按车型分目录**）

```
assets/vehicles/
  _shared/     与车型无关：colors / NioLogo / Kinematics / FollowCard / terrain-props
  es9/         ES9 专属：spec / side / side-rim / SideView / top / Wheel
```

**加新车型就加一个平级目录**（`et9/`、`es6/`…），照 `es9/` 的文件名与导出结构照抄。
不要把新车型的贴图塞进 `es9/`，也不要退回不分车型的扁平目录——两个车型一混，
下一个人分不清哪张图是哪台车，动画里就会出现「前后不是同一台车」。

每个文件独立可用（不 import 动画工程、贴图 base64 已内联、只依赖 react）。
做新动画前先看这里，不要重画车、不要重推物理。目录清单见 `assets/vehicles/README.md`。

### 拿到「俯视图/侧视图」先验是不是正投影（强制）

别人给的「正俯视图」很可能是**从车斜上方拍的**。这个必须先验，因为代价很大：
**透视图不能在平面内旋转**——泊车这类动画车要转角，一转，画面上那些本不该看见的
垂直面（尾门、前脸）就跟着甩，物理上不可能；而且**拉伸校正救不回来**，拉了只是把
透视图拉变形。

```bash
python3 scripts/assert-orthographic.py <图> --len-mm 5280 --wid-mm 2010 --wb-mm 3130
```

**两条判据必须都过：**

1. 量得 **L/W** 对实车 L/W
2. 量得 **轴距/车长** 对实车轴距/车长 ← **这条才是关键**

只有第一条偏 → 是**非均匀缩放**（视频截帧常见），按比例归正即可救。
两条都偏 → **真透视，判废**：均匀缩放时长度和轴距同比缩，第二条不该变。

实测：ES8 那张 −12.5% / −16.3%，两条都偏 → 判废，只能 reference-only。
对照 ES9 现用的那张归正后 −0.1% / +0.0%，两条全过。

不用算也能判的情况：**放大看车头车尾，正投影看不到任何垂直面**。
能看见完整的尾门立面就已经判定了。

⚠️ 自动量只在**干净背景**上可信。深色背景 + 深色车时脚本会拒绝自动量并要求手工传入
像素值——这是对的，别去改成"尽力猜一个"，那会给出一组看着像模像样的假数。

### 怎么选素材：先看需求说没说车型（强制）

**绝大多数功能演示不涉及具体车型**——讲的是功能本身。不要在车型上纠结：

- **需求没点名车型** → 只按「**需要哪个视角**」取素材，用资产库里该视角**齐全的那一套**
  （当前是 `es9/`）。这是默认路径，不用问、不用犹豫
- **需求明确点了车型** → 调那个车型的目录；该车型素材不全就**如实说做不了、缺什么**，
  不要拿别的车型顶上。两台车三围就不同（ES9 5365×2029 / ES8 5280×2010），
  换个标签糊弄过去，看的人一眼认出不是自己那台车

### 视角选定后，图就定死了（强制）

| 车型 | 视角 | **唯一入口** | 说明 |
|---|---|---|---|
| ES9 | **正侧视** | `es9/SideView.tsx` → `<ES9SideView deg bob />` | **开箱即用**，已含遮罩/镜像/旋转轮辋/静态高光/接地投影 |
| ES9 | **正俯视** | `es9/top.ts` → `ES9_TOP` | 泊车动画那张实拍图 |
| ES9 | 轮毂（矢量） | `es9/Wheel.tsx` | **兜底**，只在拿不到可用照片时用 |

判断流程就一句话：**功能演示要用 ES9 正侧视 → 直接 `<ES9SideView />`**。
不要另找图、不要画矢量车、不要沿用别的车型的轮廓、不要「照着调一下参数」。

同一个车型在不同动画里长得不一样，团队一眼就会看出是「拼的」，可信度直接归零。
**换视角可以，换车不行。**

⚠️ `es9/side.ts` 顶部记着这条轮廓是**怎么逐像素测出来的**，以及五个已经踩过的坑。
那是多轮返工的结果，**改之前先读那一段**——凭感觉调参数只会退回到已经修好的老问题上。

已经踩过的教训：对讲机动画原先自己画了一套矢量俯视简图（112×52，比例 2.15），
和泊车的实拍图（5365:2029 = **2.64**）根本不是一台车。换图时**尺寸要按实车比例重算**，
不能沿用简图的宽高。

### 「统一用同一张图」只管**我们自己的车**

这条规则是为了保证 ES9 在各动画里长一样。**第三方车必须明显不是同一台。**

对讲机动画在这里返工过两轮：一开始四台车全用 ES9 实拍图，只靠**轮廓描边色**
区分「蔚来 / 非蔚来」——被一眼看穿，画面上就是同一台车，标签写「朋友的车」也没用。
本片叙事主线正是「非蔚来车也能入队」，主体长一样这条主线就垮了。
（中间还试过给非蔚来车加去色滤镜，**对黑车等于没做**。）

正解是画一台**中性矢量车**，三个维度同时拉开差距，任意一个单独用都不够：

- **尺寸**：按常见中型车 4700×1850mm，对 ES9 的 5365×2029 明显短一截窄一圈。
  两者共用同一把 mm/px 尺子换算，不是随手缩小
- **颜色**：浅蓝灰实心，对近黑的实拍图反差极大
- **造型**：普通三厢轮廓 + 矩形前后灯，**不画 ES9 的刀锋灯带**

中性车不带任何品牌特征、不影射具体车型——这是合规要求。

**中性俯视车怎么画才不丑**——这一版返工了三次，教训按顺序记下来：

1. 「圆角矩形车身 + 六边形玻璃 + 矩形车顶」三层套 → **盒子套盒子**
2. 座舱画成中间一小块椭圆 → **像肥皂上印个「O」**
3. 深色座舱**围着**车身色的车顶画一圈 → 还是「O」，车顶被读成一个洞

关键认知：**俯视时侧窗是侧立面，几乎看不见**。玻璃只出现在车顶的**前后两端**
（前风挡、后风挡）。所以画法是「**车顶一整块 + 前后各一块玻璃**」，
不是「玻璃一整块 + 中间挖个车顶」——后者必然出现环形。

其余几条：

- **座舱要占车长一半左右**（实测 49% 观感自然）。画成中间一小块就不像车了
- **车身两端要钝圆**，收成尖就成了纺锤/药丸。轮廓用「(x, 半宽) 取样点 + Catmull-Rom
  样条」生成，不要拿圆角矩形凑
- **风挡是「接车顶那端窄、接机盖那端宽」**。画反会变成两个朝内的箭头
- **后视镜画小椭圆并把起点压进车身边缘之内**。画成尖角四边形会像两个飘在车旁边的箭头
- **描边要淡**（0.9px 级别）。重描边会让整台车像贴纸

### 多个主体同屏移动：必须断言它们不会互相穿过

对讲机场景四的「换队形」是两台车沿同一条线对穿——**全时间轴断言实测最小间距 −101.6px**，
等于两台车几乎完全重叠，而肉眼在缩略图上完全看不出来（车是深色的，叠在一起像一台）。

判定用**分离轴**：两轴任一分开即不相交，`max(dx − (La+Lb)/2, dy − (Wa+Wb)/2) > 0`。

修法是让超车的一方变道。注意**只让一方避让往往不够**：这里两车半宽和 41.4，
单侧拉 36 仍判定相交（残留 −7.4px），而单侧拉到 50 又会开出路面边界。
最后是**超车的拉上去 36、被超的避下来 14**，合计 50，两台都还在路面内。
所以这类修复要**同时断言「不相交」和「不出界」**，只看一个会来回打转。

### 车轮优先用照片抠出来的轮辋，不要手画矢量轮

有可用正侧视照片时，**别画矢量轮**——手画的在孔形、质感、中心盖 Logo 上永远差一档，
团队一眼就挑出来。照片车轮的唯一问题是贴死在图里，车一开成了滑行。解法：

1. 车身遮罩**不挖轮拱洞**，让照片自己的轮胎露出来
2. 只把**轮辋圆盘**单独抠成带 alpha 的图（`scripts/extract-rim.py`），叠在车身之上按滚动距离旋转
3. 轮胎是黑橡胶，转不转看不出来；圆盘边界落在轮辋与胎圈的交界，**暗对暗，接缝看不见**

两个必须配套做的：**圆盘 y 要带上车身的 bob**（不然轮子在车身里上下窜）；
**叠一层不旋转的穹面高光**（opacity 0.5）压住照片自带的、会跟着转的高光，否则高速时有频闪感。

矢量轮（`assets/vehicles/es9/Wheel.tsx`）降级为**拿不到可用照片时的兜底**——
`<ES9SideView />` 里已经把「照片车身 + 旋转轮辋 + 静态高光」这套装好了，直接用就行。

### 品牌标不跟着轮子转（画矢量中心盖时）

中心盖必须画在 `rotate` 组**之外**（和高光同层）。真车的盖是跟着转的，
但标一转起来，整帧里十几像素的图形就是一团噪点，认不出是哪家的车。
**这是有意偏离物理事实**：轮辐照转，标保持正立。
（用照片轮辋时不适用——那时候 Logo 是烘进照片的，尺寸上本来就读不出来，
不必再叠一个矢量盖上去；轮毂的辨识度这时来自轮辐造型，不来自标。）
中心盖占盘面的比例也从实拍的 0.13 放大到 0.19，同理——**教学动画里「一眼可辨」优先于比例严格**，
但每一处这样的偏离都要在代码注释里写清楚为什么。

用法：把 `_shared/` 和需要的车型目录复制进工程（`cp -r .claude/skills/remotion/assets/vehicles/{_shared,es9} my-video/src/assets/`）再按相对路径 import——**交付过的动画要复制不要引用**，否则 skill 更新会改变旧动画。

### 抠图体检：`bleed` 对白 / 银 / 灰主体是失效的

`bleed` 的判据是「mask 内高亮 + 低饱和像素占比」——它假设**主体是有颜色的**。
换白车之后这个数字冲到 **48.7%**，但那不是渗出，是**白车身本来就高亮低饱和**。
拿这个数去调轮廓，只会把车越削越小。

白 / 银 / 灰主体一律换两个判据：

1. **合成到强饱和底色上目视**（`preview --bg '#d0007a'`）——裹进来的背景灰会立刻跳出来，
   这是最可靠的一条，头、尾、底边各看一眼
2. **轮廓内侧带 vs 外侧背景同色比**——取轮廓内 4px 的带和轮廓外 4px 的带，逐行比中位亮度。
   这个判据与主体颜色无关，但低对比主体（白车 vs 浅灰底只差 25 级）会被抗锯齿过渡带抬高，
   只能横向比较（改动前 vs 改动后），不能看绝对值

低对比抠图**必须内缩**：白车这一版沿内法线整体缩 3px 才干净。

### 同一台车换配色：先对齐轮心，但轮廓必须重测

拿到同车型的另一张同视角照片时，第一步是把新图**重采样进旧图的画幅**：

1. 在两张图上各量前后**轮心**（`cutout-trace.py grid` 放大读数，比亮度质心可靠——
   背景亮的照片会把质心拽偏）
2. 尺度 = 旧图轴距 / 新图轴距（**用轴距这条长基线，不要用轮辋直径**，后者误差放大 5 倍）
3. 各自图内先验一次轮辋是不是正圆，确认两张都没有非均匀拉伸
4. 按逆仿射把新图采样进旧画幅 → 轮心、锚点、下游运动学常量全部沿用

⚠️ **但旧的 `CAR_BODY` 不能跟着一起沿用**。对齐的只是轮心，两张照片的**机位不一样**，
车的外形投影就不一样。实测把旧金车轮廓套到白车上，处处差 5–12px：机盖上沿削掉 8–12px、
尾部斜面裹进 10px 背景（正侧视里看成扰流板里嵌了一块灰三角）、前脸走成近乎直线
（实车是有起伏的曲线）。**看整车缩略图完全看不出来，一放大全是问题。**
轮廓要照新图重测一遍，这一步省不掉。

### 扫边界：方向要跟边界走向垂直

同一条轮廓的不同段要用不同扫法，**弄反了得到的数完全没有意义**：

| 边界走向 | 扫法 | 典型段 |
|---|---|---|
| 陡（接近竖直） | **逐行**扫，找 x | 前脸、尾缘 |
| 平（接近水平） | **逐列**扫，找 y | 机盖、车顶、底边 |

判据要**双向**：偏离该行/列**背景基线** 亮 +8 或暗 −25。白车对浅灰底只差 10–15 级，
`lum < 固定值` 这类单侧绝对阈值直接失效；双向是因为车身既有比背景亮的白漆高光，
也有比背景暗的黑唇、黑格栅、棱线阴影。
背景基线的取样窗要确认**没被主体污染**（扫机盖时窗口开在 y=110–140，开在 150–170 就会
在车头高的那几列取到车身本身，结果一路乱跳）。

**关键：单像素就触发，不要用「连续 N 像素」当噪点过滤。**
车身最外缘往往是一道**只有 1–2px 宽的高光镶边**，外侧还常伴一条 1px 的阴影线。
要求连续两像素会**整条把它滤掉**，扫描越过真边界落进车身内部——实测因此比真边界
内缩 5–7px，前脸外表面整层被削掉，竖直导流口被切成两半。**整车缩略图上完全看不出来**，
放大才发现。噪点靠事后**中值滤波**去掉（不是移动平均：中值能干掉孤立离群点，
移动平均会被离群点拖偏）。

去完离群点再做移动平均然后抽样，否则 ±1px 抖动会在轮廓上留下肉眼可见的锯齿——
这是「曲线不够完美」的另一个来源。

### 量「发亮的东西」有多宽：阈值要跟局部底值比，不是跟峰值按比例

大灯、灯带、屏幕这类自发光元素**周围有辉光**，底值被抬得很高。实测 ES9 俯视大灯：
灯芯峰值 255，而它两侧 6–8px 处仍有 **155**。这时用「峰值 × 45%」当边界阈值
（=115）永远够不到，量出来的宽度会一路撞到搜索上限（实测全是 7.0 这个上限值，
一眼就能看出是假数据）。**要用「峰值与该点局部底值的中点」**——这里是 (254+155)/2 ≈ 205，
量出的半宽 3.5px，和目视一致。

顺带一条画法：**发光件不要画成「粗暗描边 + 细亮芯」**。早先大灯用 11px 暗色描边
包一条 5px 亮线，渲出来是「一根黑杠里嵌条细亮线」，而实车是**发亮的灯带**，
暗色只是极窄的一圈灯壳。正确做法是**逐点变宽的实心刀锋**：沿中心线按实测半宽向两侧
偏移闭合，两端收成尖，再叠 暗壳(+1.25px) → 暖白灯体 → 高亮灯芯 三层实心。
等宽描边画不出「由内向外收窄」这个特征，而那正是这条灯最像它自己的地方。

### 采样密度要跟特征尺度匹配，不能全程等距

小而硬的特征会被等距采样直接抹平。实测 ES9 车顶两个特征：

- **激光雷达**：x 406–435 平顶，前脸从 y=90 陡升到 y=70
- **鲨鱼鳍**：x 784 起坡 → x 810–828 顶 → **x=830 一道 12px 的垂直后缘**

12–15px 的等距采样把鲨鱼鳍的垂直后缘摊成 16px 斜坡、把雷达的陡前脸抹成一条斜线，
看上去就是「轮廓不对」。这两段要**2px 密采样且不做平滑**（平滑会再抹一次），
其余段 12px + 平滑。**先找出画面里所有 30–50px 尺度的硬特征，再决定采样密度。**

内缩距离也要分段：低对比的白车身段 2px，深色高对比的车顶/尾缘 1.5px
（`cutout-trace.py erode --segment i0:i1:d`）。全程一个值会在高对比段白削掉真车。

### 量不出来的边界：说清楚哪一段是推的

影棚照片的地面常是**深色反光**的，轮胎下缘和地面反光连成一片，**照片里根本没有边界可量**。
这时按已知胎圈半径补圆弧（本车 r=75 照片 px），并在代码注释里写明
**这一段是推的不是测的**——别让下一个人以为整条轮廓都有实测依据。

### 不挖轮拱洞时，遮罩底边必须包住轮胎

改用照片车轮后有个连带问题：原来的 `CAR_BODY` 底边只走到**门槛线**（轮胎在遮罩之外，
靠矢量轮补上）。直接去掉轮拱洞的话，轮胎下三分之一会被整齐切掉。
整车缩略图上看不出来（接地阴影正好盖住），放大一眼就露馅。

配套脚本：`scripts/assert-assets-in-sync.py`（**改完素材必跑**：逐项比 md5，防止资产库与已交付动画各自往前走，这种漂移肉眼发现不了）、`scripts/extract-rim.py`（从侧视照片抠可旋转轮辋圆盘）、`scripts/build-player.py`（打包单文件交互 HTML，**改完组件必须重跑**，否则发出去的还是旧快照）、`scripts/cutout-trace.py`（照片抠形：扫边界/找设计线/逐点内缩/渗出体检/网格读数/编码/预览）、`scripts/assert-timeline.mjs`（全时间轴断言原语：SAT 间距/单调性/终点精度/值域/出界重叠，`--selftest` 自测）。

**每个资产的硬性约束、落位公式、换车型改动清单一律见 `references/vehicle-assets.md`，动手前必读那一份。**

## 素材合规与溯源（用真实照片必读）

- 只用**已批准、无水印、无营销叠字**的原图；**不得靠裁切/修图去掉第三方水印**，不得把网络截图直接嵌进交付页
- 图源索引只用于挑选溯源，**绝不能成为最终 HTML 的外链依赖**——所有图片必须 base64 内联
- 每张进入资产库的图登记 `approved-asset-manifest.json`：来源、授权状态、水印检查、营销文案检查、审核人、日期
- 保真度降级要如实标注：用比例化插画代替照片时写 `visualFidelity: "proportional-concept"`，**不得暗示是实拍或 CAD**；隐藏结构（电池包/热管理/通信链路）一律概念示意，不宣称是实车结构图

## 语义锚点：位置只测一次

功能只绑定**语义锚点**（`wheel.front` / `screen.center` / `battery.pack` / `charge.port` / `roof.sensor`），不要每次生成时临时猜像素位置——反复重测是返工的主要来源。

锚点存 `anchors.json`，用**归一化 0–1 坐标**（随资产缩放自动生效），并登记该视角的 `renderTransform`（如侧视原图车头朝左，统一镜像为「车头向右」的叙事方向）与 `renderWidthCapPx`（避免放大糊掉）。换资产时保持 key 语义不变，只更新坐标。

## 素材贴图规范（照片抠形）

用真实照片当主体时，用 SVG `<mask>` 手描轮廓抠形。四条硬性检查（都踩过坑）：

1. **轮廓不能有跳变台阶**——相邻点不要出现十几像素的垂直跃迁，否则渲出来是方块凸起。沿边缘取**稀疏平滑点**（20–40px 一个），不要 5px 一个密排，密排反而产生锯齿
2. **不能裹进背景**——尤其主体与地面接触处。用像素扫描定边界（按亮度/色相判断背景起始行），再让轮廓留 3–5px 余量压在主体内侧，不要凭目测
3. **不能切掉主体**——车顶行李架、天线、尾翼、保险杠下唇这类细长部件最容易被裁掉；定稿前必须整体渲一张确认
4. **描完统一内缩 2–3px**——沿多边形内法线整体偏移（不是按质心缩放，形状不规则会歪），这一步能一次性消掉整圈的背景渗出，比逐点调轮廓省事得多

**主体自身的硬特征优先于亮度边界**——灯带、棱线、切边、格栅边框这些「设计线」就是轮廓本身。照片上的光晕、反射、地面辉光会在硬边外面糊出一圈亮边，照着亮度边界描就会把本来没有圆角的车头描成圆角。看到主体上有一条明确的斜置灯带/棱线，就沿着它的**外缘**走直线或缓弧，不要绕到它外面去。

**颜色启发式在明暗混合区一定会骗你**（车头亮车灯 + 暗格栅、车尾灯光晕 + 地面反光），只靠 `lum < 阈值` 扫描会把亮车灯判成背景、把地面光晕判成车身，然后你会「修好一处、改坏三处」。可靠做法：

- 先用**逐列/逐行自适应阈值**（拿该行两侧背景的中位亮度 × 0.42 当阈值）扫出边界并打印出来，看数列是否平滑单调
- 数据可疑的区段（前脸、尾灯、后视镜）改用 **4–5 倍放大 + 20px 网格叠图目视读数**，一格一格读坐标
- 修正前先判断误差是**均匀**还是**渐进**的：渐进误差（车头 0px、车尾 16px）要按位置分段修，整体平移会把好的地方改坏

验证方法（省 token）：用 Python/PIL 把 mask 应用到原图、合成到纯色底、按问题区域裁切成**一张**对比图查看，不要反复整帧渲染。同时跑一个**无图渗出体检**——统计 mask 内「高亮度 + 低饱和」（即背景灰）的像素占比，正常应 < 1.5%，超了说明还在裹背景。

### 挖孔要用 `<mask>`，不要用 clipPath + evenodd（重要坑）

要挖掉照片里的某个区域（如替换车轮）时：

```tsx
<mask id="carMask">
  <path d={CAR_BODY} fill="#fff" />              {/* 主体轮廓，不含挖孔 */}
  {ARCHES.map((a,i) => <circle key={i} cx={a.cx} cy={a.cy} r={a.r} fill="#000" />)}
</mask>
<image href={PHOTO} mask="url(#carMask)" />
```

**不要**把挖孔圆并进同一条 path 用 `clipRule="evenodd"` 裁剪：挖孔形状**超出主体轮廓之外**的那部分会被 even-odd 判为"奇数次穿越 = 在裁剪区内"，于是本该隐藏的照片内容（原车轮下半截）反而漏出来，表现为一条水平分界线上下两个轮子。mask 没有这个问题——主体轮廓之外一律为黑（隐藏）。

### 按实车尺寸核对比例（有官方数据时必做）

拿到官方三围就把它写成常量并核对，别凭手感缩放。方法：

1. **用轴距或车长当标尺**算出 mm/px：`舞台车长(px) ÷ 车长(mm)`，其余部件都用这把尺子换算
2. **交叉验证两个比值**（不依赖标尺，最能暴露问题）：长/高、轴距/车长。例：ES9 长 5365 / 高 1870 = 2.87，照片实测 2.89 ⇒ 比例可信
3. **轮辋与胎圈的比值必须对**：`轮辋直径 ÷ 轮胎外径`。例 23" 轮辋 = 584mm，配 275/45R23 外径 ≈ 832mm ⇒ 比值 0.70。矢量轮就按这个比例画（胎圈 r=100 时轮辋 r=70），否则胎壁太薄一眼假
4. 照片若是**轻微透视**（近端轮子比远端大），做不到严格正投影等比——此时以照片自身为准让贴图与矢量轮吻合，并在文档里说明，不要假装是正投影
5. **视频截帧要先归正再用**：手机/车机视频常有非等比拉伸。用实车比值反推缩放系数——实测长宽比 ÷ 实车长宽比 = 需要压缩的倍数，把这个系数烘进裁切重采样（例：俯视截帧实测 L/W = 2.78，实车 5365/2029 = 2.644 ⇒ 纵向 ×0.946），之后渲染端只留一个 `SCALE`，不要在组件里写两个不同的缩放
6. **包围盒取「不含外凸件」的主体外廓**（车就是不含后视镜的车体），这样归一化锚点、地面投影、目标虚影框才都是实车尺寸；外凸件自然超出包围盒，是对的

把尺寸写进 `data.ts` 常量（如 `ES9_SPEC`）并附上换算注释，后续改动有据可依。舞台上的场景尺寸也要按同一把尺子核对——车位宽度、车距、障碍间隙全部换算成 mm 写进断言，否则「车位太宽」这类问题只能靠眼睛发现。

### 机械结构的图层顺序（车轮为例）

真实的轮子是**被包裹在轮拱里**的：上沿被翼子板遮住，与轮眉之间有一圈缝隙（暗色轮腔）。要做对必须满足三点：

1. **矢量轮画在照片下层**（先画轮、后画车身），车身才能遮住轮胎上沿——画在上层就是"贴上去"的观感
2. **轮拱开口半径 > 胎圈半径**（照片实测：胎 R≈88，轮眉 R≈104，即约 16px 缝隙），缝隙里垫一块暗色圆（轮腔），不能露出页面背景
3. 挖孔半径取"刚好盖住照片原轮"即可（比胎圈大几像素），剩下的缝隙让**照片自己的轮腔**露出来最自然

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

---

This is a remotion based video app that uses React to render videos.

Full remotion docs can be found here: https://www.remotion.dev/docs/. Consult these docs often if you're uncertain.

# Project structure

The Root file is usually named "src/Root.tsx" and looks like this:

```tsx
import {Composition} from 'remotion';
import {MyComp} from './MyComp';

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="MyComp"
        component={MyComp}
        durationInFrames={120}
        width={1920}
        height={1080}
        fps={30}
        defaultProps={{}}
      />
    </>
  );
};
```

A `<Composition>` defines a video that can be rendered. It consists of a React "component", an "id", a "durationInFrames", a "width", a "height" and a frame rate "fps". The default frame rate should be 30. The default height should be 1080 and the default width should be 1920. The default "id" should be "MyComp". The "defaultProps" must be in the shape of the React props the "component" expects.

Inside a React "component", one can use the "useCurrentFrame()" hook to get the current frame number. Frame numbers start at 0.

```tsx
export const MyComp: React.FC = () => {
  const frame = useCurrentFrame();
  return <div>Frame {frame}</div>;
};
```

# Component Rules

Inside a component, regular HTML and SVG tags can be returned. There are special tags for video and audio. Those special tags accept regular CSS styles.

If a video is included in the component it should use the `<OffthreadVideo>` tag.

```tsx
import {OffthreadVideo} from 'remotion';

export const MyComp: React.FC = () => {
  return (
    <div>
      <OffthreadVideo
        src="https://remotion.dev/bbb.mp4"
        style={{width: '100%'}}
      />
    </div>
  );
};
```

OffthreadVideo has a "startFrom" prop that trims the left side of a video by a number of frames. OffthreadVideo has a "endAt" prop that limits how long a video is shown. OffthreadVideo has a "volume" prop that sets the volume of the video. It accepts values between 0 and 1.

If a non-animated image is included in the component it should use the `<Img>` tag.

```tsx
import {Img} from 'remotion';

export const MyComp: React.FC = () => {
  return <Img src="https://remotion.dev/logo.png" style={{width: '100%'}} />;
};
```

If an animated GIF is included, the "@remotion/gif" package should be installed and the `<Gif>` tag should be used.

```tsx
import {Gif} from '@remotion/gif';

export const MyComp: React.FC = () => {
  return (
    <Gif
      src="https://media.giphy.com/media/l0MYd5y8e1t0m/giphy.gif"
      style={{width: '100%'}}
    />
  );
};
```

If audio is included, the `<Audio>` tag should be used.

```tsx
import {Audio} from 'remotion';

export const MyComp: React.FC = () => {
  return <Audio src="https://remotion.dev/audio.mp3" />;
};
```

Asset sources can be specified as either a Remote URL or an asset that is referenced from the "public/" folder of the project. If an asset is referenced from the "public/" folder, it should be specified using the "staticFile" API from Remotion

```tsx
import {Audio, staticFile} from 'remotion';

export const MyComp: React.FC = () => {
  return <Audio src={staticFile('audio.mp3')} />;
};
```

Audio has a "startFrom" prop that trims the left side of a audio by a number of frames. Audio has a "endAt" prop that limits how long a audio is shown. Audio has a "volume" prop that sets the volume of the audio. It accepts values between 0 and 1.

If two elements should be rendered on top of each other, they should be layered using the "AbsoluteFill" component from "remotion".

```tsx
import {AbsoluteFill} from 'remotion';

export const MyComp: React.FC = () => {
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{background: 'blue'}}>
        <div>This is in the back</div>
      </AbsoluteFill>
      <AbsoluteFill style={{background: 'blue'}}>
        <div>This is in front</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
```

Any Element can be wrapped in a "Sequence" component from "remotion" to place the element later in the video.

```tsx
import {Sequence} from 'remotion';

export const MyComp: React.FC = () => {
  return (
    <Sequence from={10} durationInFrames={20}>
      <div>This only appears after 10 frames</div>
    </Sequence>
  );
};
```

A Sequence has a "from" prop that specifies the frame number where the element should appear. The "from" prop can be negative, in which case the Sequence will start immediately but cut off the first "from" frames.

A Sequence has a "durationInFrames" prop that specifies how long the element should appear.

For displaying multiple elements after another, the "Series" component from "remotion" can be used.

```tsx
import {Series} from 'remotion';

export const MyComp: React.FC = () => {
  return (
    <Series>
      <Series.Sequence durationInFrames={20}>
        <div>This only appears immediately</div>
      </Series.Sequence>
      <Series.Sequence durationInFrames={30}>
        <div>This only appears after 20 frames</div>
      </Series.Sequence>
    </Series>
  );
};
```

For displaying multiple elements after another and having a transition inbetween, the "TransitionSeries" component from "@remotion/transitions" can be used.

```tsx
import {linearTiming, springTiming, TransitionSeries} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {wipe} from '@remotion/transitions/wipe';

export const MyComp: React.FC = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={60}>
        <Fill color="blue" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        timing={springTiming({config: {damping: 200}})}
        presentation={fade()}
      />
      <TransitionSeries.Sequence durationInFrames={60}>
        <Fill color="black" />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
```

Remotion needs all of the React code to be deterministic. Therefore, it is forbidden to use the Math.random() API. If randomness is requested, the "random()" function from "remotion" should be used and a static seed should be passed to it.

```tsx
import {random} from 'remotion';

export const MyComp: React.FC = () => {
  return <div>Random number: {random('my-seed')}</div>;
};
```

# Animating with interpolate() and spring()

Remotion includes an interpolate() helper that can animate values over time.

```tsx
import {interpolate} from 'remotion';

export const MyComp: React.FC = () => {
  const frame = useCurrentFrame();
  const value = interpolate(frame, [0, 100], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div>
      Frame {frame}: {value}
    </div>
  );
};
```

The "interpolate()" function accepts a number and two arrays of numbers. The first argument is the value to animate. The first array is the input range, the second array is the output range. The fourth argument is optional but code should add "extrapolateLeft: 'clamp'" and "extrapolateRight: 'clamp'" by default.

Remotion includes a "spring()" helper that can animate values over time. Below is the suggested default usage.

```tsx
import {spring} from 'remotion';

export const MyComp: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const value = spring({
    fps,
    frame,
    config: {
      damping: 200,
    },
  });
  return (
    <div>
      Frame {frame}: {value}
    </div>
  );
};
```

# Making UI components

Remotion components are rendered frame-by-frame to create videos and cannot have user interactions. Normal React components handle real-time interactivity. Key differences in implementation:

- **State management**: Remotion uses `useCurrentFrame()` to drive animation; interactive React uses `useState()`.
- **Animation approach**: Remotion relies on frame-based calculations via `interpolate()` or `spring()`; interactive React animates via CSS transitions or effect hooks.
- **User input**: Remotion components have none — remove all event handlers; interactive React handles clicks and forms.

## Example Comparison

Button in Normal React:

```tsx
const Button = () => {
  const [clicked, setClicked] = useState(false);

  return (
    <button
      onClick={() => setClicked(true)}
      style={{ background: clicked ? 'blue' : 'gray' }}
    >
      Click me!
    </button>
  );
};
```

Animated Button in Remotion:

```tsx
import { useCurrentFrame, interpolate } from 'remotion';

const AnimatedButton = () => {
  const frame = useCurrentFrame();

  // Animate scale over 30 frames
  const scale = interpolate(frame, [0, 30], [1, 1.2], {
    extrapolateRight: 'clamp'
  });

  return (
    <div style={{
      transform: `scale(${scale})`,
      background: 'blue',
      padding: '10px 20px',
      display: 'inline-block'
    }}>
      Click me!
    </div>
  );
};
```

## Best Practices for Remotion Components

1. Always use frame-based animations — never rely on time-based effects
2. Keep components pure — no side effects or external data fetching
3. Use Remotion's hooks (useCurrentFrame(), useVideoConfig(), etc.)
4. Leverage Sequences for timing different elements
5. No interactive elements — remove all event handlers from UI components
6. Deterministic rendering — ensure consistent output for video rendering

---

## 资源

- `references/animation-routing.md` — 演示空间/机制/输出形式/分镜模板的完整选择规则
- `references/vehicle-assets.md` — 车辆资产库使用说明（硬性约束、落位公式、换车型改动清单）
- `assets/vehicles/` — **按车型分目录**的资产库；`README.md` 是索引与调用规则，`_shared/` 放与车型无关的件，`es9/` 是 ES9 的侧视/俯视/轮毂
- `scripts/validate-animation-manifest.mjs` — 校验动画决策卡（scope、mechanism、每章 claim/startState/endState）
- `scripts/assert-self-contained-html.mjs` — 交付前拦截外链依赖（`--fragment` 用于 Artifact 片段）
- `scripts/make-shotlist.mjs` — 决策卡 → 实拍分镜表（含开拍前必须归零的项、可量化验收清单、合规清单）
- `scripts/make-gif.py` — Remotion 合成 → 飞书文档能自动播放的 GIF（自动控体积，防 OOM 参数已内置）
- `references/feishu-delivery.md` — 对话框发 HTML + 生成飞书文档的标准两步、块能力边界、OpenAPI 备查
- `scripts/extract-broll.py` — 参考片 → 逐镜可用性判定（有效分辨率/水印/明暗）+ 切好的片段，判断它能当素材还是只能当参考
- `scripts/analyze-reference-video.py` — 参考片 → `style-spec.json`（镜头时长分布/切点密度/色板/明暗 + 每镜代表帧），把「像某某片子」变成可对齐的参数
- `references/live-action-path.md` — 走到实拍宣传片的三条路径、对内 vs 对外、参考片风格对齐、带 alpha 叠加层导出
- `scripts/cutout-trace.py` — 照片抠形工具链（scan / bright / grid / erode / bleed / encode / preview）
- `scripts/assert-timeline.mjs` — 全时间轴断言原语（SAT 间距 / 单调 / 终点 / 值域 / 出界重叠）

> 决策卡路由、分镜模板、缺口标注（conceptualItems）、素材合规溯源、语义锚点这几套方法，
> 吸收自内部 `vehicle-feature-animation` skill；两个校验脚本在其基础上改编。
