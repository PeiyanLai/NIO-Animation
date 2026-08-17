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

## 配色与背景（强制）

**一律用 NIO（NIOFlow）配色**，完整 token 见 `.claude/skills/feature-animation/references/nio-colors.md`；用户未指定其他品牌时不得自选配色。要点：

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

配套硬规则：

- **开口大小要克制**：挖掉的面积必须和真车的钣金分缝一致。侧视图里尾门只是车尾包边那一条，
  把后侧围和后风挡一起算进去会在车身上切出一个夸张的大洞。写成断言：开口宽度 ≤ 主体尺寸的百分比上限
- **开口内景不要画成纯黑**：整块涂黑会读成「车身被挖掉一块」而不是「看进去了」。
  用从亮到暗的渐变（上半透出远侧玻璃/顶棚，越往下越是行李厢阴影）
- **运动顺序也有习惯**：先解锁再开、先合盖再提走、先停稳再操作、先看到反馈再进行下一步。
  把顺序写进相位，不要为了省时长把两个动作并成一个
- **拿不准就去找实物照片确认铰链在哪**，不要凭感觉——这类错误自己检查不出来，只有用户能看出来
- 把上面三件事写成断言：铰链必须落在部件的指定一侧、开到位后特征点必须到达指定区域、开口尺寸不得超限

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

## 现成资产：不要重画车

`assets/nio-vehicle/` 是从已交付动画沉淀下来的资产库，**每个文件独立可用**（不 import 动画工程、贴图 base64 已内联、只依赖 react）。做新动画前先看这里，不要重画车、不要重推物理。

| 文件 | 用途 |
|---|---|
| `colors.ts` | NIO 浅色 token + 地形色 + 字体栈；**资产库唯一允许出现裸色值的地方** |
| `spec.ts` | ES9 实车规格 + mm/px 标尺换算 + 比例自检 |
| `side.ts` | 正侧视车身（照片 + 轮廓 + 轮拱 + 车轮/阴影摆位） |
| `top.ts` | 正俯视车身（照片 + 轮廓 + 包围盒 + 锚点 + 大灯灯带） |
| `Wheel.tsx` | ES9 大饼轮毂（9 孔）+ 它依赖的 `<defs>`（`WheelDefs`） |
| `Kinematics.ts` | 四轮转向运动学：解析积分 / 反推起点 / 退化自检 |
| `FollowCard.tsx` | 贴主体信息卡：卡片 + 三角 + 引导线 + 安全区 clamp |
| `terrain-props.tsx` | 环境道具：雪人/松树/仙人掌/芦苇/石堆/底纹/飘雪/扬沙 |

用法：把整个目录复制进工程（`cp -r .claude/skills/remotion/assets/nio-vehicle my-video/src/assets/`）再按相对路径 import——**交付过的动画要复制不要引用**，否则 skill 更新会改变旧动画。

配套脚本：`scripts/cutout-trace.py`（照片抠形：扫边界/找设计线/逐点内缩/渗出体检/网格读数/编码/预览）、`scripts/assert-timeline.mjs`（全时间轴断言原语：SAT 间距/单调性/终点精度/值域/出界重叠，`--selftest` 自测）。

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
- 参考实现：本仓库 `remotion-terrain/src/player-entry.tsx`

### MP4 导出（仅在用户要求时）

```bash
npx remotion render <CompId> out.mp4 \
  --browser-executable=/opt/pw-browsers/chromium --chrome-mode=chrome-for-testing
```

**本环境两个坑**（已踩）：
1. 必须指定预装的 `/opt/pw-browsers/chromium`，外网受限，别让 Remotion 自己下载浏览器
2. 新版 Chromium 移除了旧 headless 模式，**必须加 `--chrome-mode=chrome-for-testing`**；该参数需要 Remotion **4.0.5xx 及以上**，4.0.246 会报 "Old Headless mode has been removed" 且无此参数——先 `npm i remotion@latest @remotion/cli@latest`

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
- `assets/nio-vehicle/` — 现成资产：侧视/俯视车身、大饼轮毂、四轮转向运动学、贴身信息卡、环境道具、配色 token
- `scripts/validate-animation-manifest.mjs` — 校验动画决策卡（scope、mechanism、每章 claim/startState/endState）
- `scripts/assert-self-contained-html.mjs` — 交付前拦截外链依赖（`--fragment` 用于 Artifact 片段）
- `scripts/cutout-trace.py` — 照片抠形工具链（scan / bright / grid / erode / bleed / encode / preview）
- `scripts/assert-timeline.mjs` — 全时间轴断言原语（SAT 间距 / 单调 / 终点 / 值域 / 出界重叠）

> 决策卡路由、分镜模板、缺口标注（conceptualItems）、素材合规溯源、语义锚点这几套方法，
> 吸收自内部 `vehicle-feature-animation` skill；两个校验脚本在其基础上改编。
