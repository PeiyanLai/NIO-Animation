# 车辆资产库使用说明（`assets/nio-vehicle/`）

**这份资产库存在的意义只有一句话：做新功能动画时不要重画车、不要重推物理。**
四个已交付动画（全地形 / 平移泊入 / 宠物模式 / 车队电台）里所有可复用的部分都沉淀在这里，
每个文件都**独立可用**——不 import 任何动画工程的东西，需要的常量已经复制进来，
base64 贴图直接内联，只依赖 `react`。

---

## 清单

| 文件 | 是什么 | 出处 | 大小 |
|---|---|---|---|
| `colors.ts` | NIO 浅色系 token（`NIO`）+ 地形色（`TERRA`）+ 字体栈 | 四个动画公用 | 2.7 KB |
| `spec.ts` | ES9 实车规格 + mm/px 标尺换算 + 比例自检 | 全地形 `data.ts` | 5.6 KB |
| `side.ts` | **正侧视**车身（照片 base64 + 轮廓 + 轮拱 + 车轮摆位） | 全地形 `photo.ts` / `data.ts` / `Stage.tsx` | 118 KB |
| `top.ts` | **正俯视**车身（照片 base64 + 轮廓 + 包围盒 + 锚点 + 大灯） | 泊车 `es9-top-photo.ts` / `parking-data.ts` | 36 KB |
| `Wheel.tsx` | ES9 大饼轮毂矢量组件 + 它依赖的 `<defs>` | 全地形 `Stage.tsx` | 8.8 KB |
| `Kinematics.ts` | 四轮转向运动学（解析积分、反推起点、退化自检） | 泊车 `parking-data.ts` | 9.8 KB |
| `FollowCard.tsx` | 贴主体信息卡（卡片 + 三角 + 引导线 + clamp） | `ParkingStage.tsx` / `PetStage.tsx` | 9.0 KB |
| `terrain-props.tsx` | 环境道具库（雪人/松树/仙人掌/芦苇/石头/底纹/飘雪/扬沙） | 全地形 `Stage.tsx` | 24 KB |

配套脚本（`../scripts/`）：

- `cutout-trace.py` — 照片抠形工具链（扫边界 / 找设计线 / 内缩 / 渗出体检 / 网格 / 编码 / 预览）
- `assert-timeline.mjs` — 全时间轴断言原语（SAT 间距 / 单调性 / 终点精度 / 值域 / 出界重叠）

## 怎么 import

**推荐：整个目录复制进工程**，动画自带资产、互不影响：

```bash
cp -r .claude/skills/remotion/assets/nio-vehicle my-video/src/assets/
```

```tsx
import {NIO, F_UI} from './assets/nio-vehicle/colors';
import {ES9_SIDE, ES9_SIDE_BODY, sideWheelDeg} from './assets/nio-vehicle/side';
import {WheelDefs, ES9Wheel} from './assets/nio-vehicle/Wheel';
```

也可以直接按相对路径引用 skill 目录（esbuild / Remotion 都能解析），但一旦 skill 更新，
已交付动画的渲染结果会跟着变——**交付过的动画请复制，不要引用**。

---

## 1. `colors.ts` — 唯一允许出现裸色值的地方

其余资产文件全部从这里取色。硬规则：大面积背景仅 `#FFFFFF / #F0FAFA / #E8FAFA`；
主色只做强调（单块 ≤15%、每屏 ≤3 处）；中性色用青调灰，**禁止纯灰 `#888/#666`**；
浅底上的主体必须有接地投影。深色值（`tireBlack` / `cavity` / `lampHousing`）属于「实物本色」，
不是品牌色，不受面积限制。

## 2. `spec.ts` — 一把尺子量到底

```ts
import {ES9_SPEC, mmPerPx, toPx, vehicleMetrics, checkProportions} from './spec';

const CAR_LEN_PX = 236;                       // 舞台上想要多长的车
const m = vehicleMetrics(CAR_LEN_PX);         // → width 89.25 / wheelbase 142.96 / tireOD 35.37
const slotW = toPx(2546, CAR_LEN_PX);         // 车位宽度按 mm 算，不要拍脑袋
```

- `ES9_SPEC` 是官方数据；`ES9_DERIVED`（前悬 1000 / 后悬 1115 / 轮距 1730）是**推算值**，
  已标 `isEstimate: true`——拿到官方数据就替换，并同步 `top.ts` 的锚点。
- `checkProportions()` 用来在断言里核对贴图有没有被非等比拉伸：
  长/高 2.869、长/宽 2.644、轮辋/轮胎 0.727，三个比值对不上就说明图有问题。
- **场景尺寸也要用同一把尺子**：车位宽、车距、障碍间隙全部换算成 mm 写进断言，
  否则「车位太宽」这类问题只能靠眼睛发现。

## 3. `side.ts` — 正侧视车身

```tsx
<defs>
  <WheelDefs />
  <mask id="carMask">
    <path d={ES9_SIDE_BODY} fill="#fff" />
    {ES9_SIDE.arches.map((a, i) => <circle key={i} {...a} fill="#000" />)}
  </mask>
</defs>

{/* ① 接地阴影 */}
{ES9_SIDE.wheels.map((w) => <ellipse key={w.id} {...w.contactShadow} />)}
<ellipse {...ES9_SIDE.softShadow} />
{/* ② 轮腔暗圆（填满轮拱开口，留出机械缝隙） */}
{ES9_SIDE.wheels.map((w) => <circle key={w.id} cx={w.cx} cy={w.cy} r={w.cavityR} fill={NIO.cavity} />)}
{/* ③ 矢量车轮（画在照片下层！） */}
{ES9_SIDE.wheels.map((w) => (
  <ES9Wheel key={w.id} cx={w.cx} cy={w.cy} scale={w.scale} deg={sideWheelDeg(dx)} />
))}
{/* ④ 车身照片：translate → scale → 镜像 */}
<g transform={`translate(${ES9_SIDE.place.x} ${ES9_SIDE.place.y + bob})`}>
  <g transform={`scale(${ES9_SIDE.place.scale})`}>
    <g transform={`translate(${ES9_SIDE.place.mirrorWidth} 0) scale(-1 1)`}>
      <image href={ES9_SIDE.photo} width={ES9_SIDE.src.w} height={ES9_SIDE.src.h} mask="url(#carMask)" />
    </g>
  </g>
</g>
```

硬性约束：

1. **车头朝右**：原图车头朝左，靠最内层的镜像组翻过来。`ES9_SIDE_BODY` / `arches` 的坐标是
   **镜像前**的照片坐标（1020×460），因为 mask 作用在镜像组内部的 `<image>` 上。
2. **抠形必须用 `<mask>`，不能改成 `clipPath` + `clipRule="evenodd"`**：轮拱圆超出车身底边的
   那部分会被 even-odd 判成「在裁剪区内」，照片里的原车轮下半截会漏出来——表现为一条水平
   分界线上下两个轮子。mask 没有这个问题（轮廓外一律为黑）。
3. **图层顺序不能换**：阴影 → 轮腔 → 车轮 → 车身照片。车轮在照片**下层**，车身才能遮住
   轮胎上沿；画在上层就是「贴上去」的观感。
4. **地面线 `SIDE_GROUND_Y = 420`**（舞台 1000×560），与 `terrain-props` 的 `GROUND_Y` 必须一致。
5. 照片是**轻微透视**（前胎圈 74px、后胎圈 76px），前后轮的 `scale` 与 `cavityR` 本来就不同，
   不要「统一」成一个数。舞台标尺 `carLenPx = 507` ⇒ 10.58 mm/px。

## 4. `top.ts` — 正俯视车身（含修好的大灯）

```tsx
<defs><mask id="carTopMask"><path d={ES9_TOP.body} fill="#fff" /></mask></defs>

<g transform={`translate(${x} ${y}) rotate(${th})`}>       {/* 以车身中心为原点 */}
  <ellipse cy={CAR_LEN/2 - 6} rx={carW * 0.42} ry={8} fill={NIO.ink3} opacity={0.14} />
  <g transform={topBodyTransform(CAR_LEN)}>
    <image href={ES9_TOP.photo} width={ES9_TOP.src.w} height={ES9_TOP.src.h} mask="url(#carTopMask)" />
    {ES9_TOP.headlights.map((d) =>
      ES9_TOP.headlightLayers.map((l, j) => <path key={j} d={d} fill="none" strokeLinecap="round" {...l} />))}
  </g>
</g>
```

硬性约束：

1. **车头朝上**（−y）。SVG 呈现角 θ=0 即车头朝上，与 `Kinematics.psiToTheta()` 配套。
2. 贴图 **342 × 704**；车体外廓（**不含后视镜**）包围盒 **256 × 676 ↔ 2029 × 5365 mm**。
   归一化锚点、接地投影、目标虚影框一律以包围盒为准，后视镜超出包围盒是对的。
3. **车头轮廓 = 两侧斜置灯带的外缘**：ES9 车头没有圆角，照亮度边界描会描成圆角。
4. **车头段内缩仅 0.5px**（其余 2px），否则整条灯带被切掉。
5. **大灯必须叠矢量灯罩 + 灯芯**（`HEADLIGHT_LAYERS` 三层：暗灯罩 → 暖灯芯 → 白高光）。
   照片里灯条只有几像素宽，在 `#E8FAFA` 浅底上直接贴会糊成一条灰线，读者认不出车头朝向。
   **这一条是修车灯那一轮的结论，不要"简化"掉。**
6. 俯视看不到车轮，需要表现转角时用 HMI 示意层（12 × 35px 圆角矩形 + 主色描边）叠在
   `ES9_TOP_ANCHORS` 的四个轮位上，不要试图从照片里抠轮子。

## 5. `Wheel.tsx` — ES9 大饼轮毂

```tsx
<defs><WheelDefs /></defs>
<ES9Wheel cx={573.2} cy={376.6} scale={0.407} deg={deg} />
// 等价写法（要插别的层时用）：
<g transform={`translate(${cx} ${cy}) scale(${k})`}>
  <WheelTire />
  <g transform={`rotate(${deg})`}><WheelSpokes /></g>
  <WheelGloss />
</g>
```

硬性约束：

1. **必须先把 `<WheelDefs />` 塞进自己的 `<defs>`**，它提供 `rimFace` / `rimDome` / `rimHoles`
   三个固定 ID；同页面不要再定义同名 ID。
2. **9 个孔、等分 40°**——这是「行内人一眼认出是这台车」的特征，`HOLE_COUNT` 不许随手改。
   孔形是四边形（外缘长弧 + 内缘短弧 + 两条近直边 + 极小倒角），不是水滴、不是圆头。
3. **自身坐标系固定**：胎面 r=100、轮辋 r=73（比值 0.727）。要多大在外面套 `scale`，
   改半径会破坏胎壁比例，一眼假。`scale = 舞台胎半径 / 100`。
4. **高光 `WheelGloss` 必须在 rotate 组之外**：光源固定不跟着转，否则像贴纸在转。
5. 孔是 `<mask>` 真镂空，透出下层轮腔/制动盘/卡钳，转起来才看得出在转。

## 6. `Kinematics.ts` — 四轮转向运动学

```ts
const L = vehicleMetrics(CAR_LEN).wheelbasePx;
// 场景一：前后不等 ⇒ 有横摆，把翘出的车头摆正
const segs = stepsToSegments(yawSteps({L, df: 40, dr: 8, yawDeg: 22, nSegs: 6}), 40, 8);
// 场景二：前后同角 ⇒ 横摆恒零，纯平移横移
const segs2 = stepsToSegments(crabSteps({deg: 8, lateral: 56, pairs: 8}), 8, 8);

const plan = planToTarget({L, rearOffset: REAR_OFF, segs, thStart: -22, target: {x: 600, y: 280}});
const pts  = sampleTrack(plan.start, segs, L);       // 规划路径 polyline
```

- 模型：`dψ/ds = cos δr·(tan δf − tan δr)/L`，参考点 = **后轴中心**，s 带符号（<0 = 倒车）。
- 每段转角恒定 ⇒ 轨迹是恒曲率圆弧，用**闭式解**求值，渲染与断言共用同一份函数。
- **终点精度的做法**：不要从起点摸索着走到终点。先正向积分求累计位移，再把起点反推成
  「目标位姿 − 累计位移」，终点天然精确落位（实测偏差 0.0000）。这就是 `planToTarget()`。
- `stepsToSegments()` 会在倒车段自动**反打**前后轮——不反打车会摆回去，横摆不再同号。
- **改了公式必须跑 `selfCheck()`**：δr=0 退化为经典自行车模型、δf=δr 横摆恒零、
  闭式解与 2 万步数值积分一致、反推起点后终点精确落位。

## 7. `FollowCard.tsx` — 贴主体信息卡

```tsx
const geom = followCardLayout({
  subject: {x, y, th, w: CAR_W, h: CAR_H},
  card: {w: 274, h: 176}, side: 'left', gap: 26,
  safe: {x0: 16, y0: 12, x1: 984, y1: 548},
  forbid: {maxRight: SLOT_L - 8},        // 不许越过车位开口虚线
});
<CardConnector geom={geom} color={accent} />          {/* SVG：虚线 + 端点圆点 + 三角 */}
<FollowCard geom={geom} scale={{kx: 1.92, ky: 1075/560}}>…</FollowCard>   {/* HTML 卡片 */}
```

- `followCardLayout()` 是**纯几何函数**，渲染与断言共用同一份，避免「画对了但断言算的是另一套」。
- 落位顺序：贴主体（按旋转后包围盒算间距）→ clamp 安全区 → 卡关键禁越线 → 求三角尖与引导线落点。
- 引导线落点用主体**局部归一化坐标**（`lead: {u, v}`），随主体旋转，永远落在该描述的部位上。
- 想把卡片也画进 SVG 用 `CardFrame`；HTML 版排版更好控中文字重/行高，两者可混搭。
- 断言必配：卡片与主体外接矩形**不重叠**、四边不出界、不越关键线（见 `assert-timeline.mjs`）。

## 8. `terrain-props.tsx` — 环境道具库

```tsx
const behind = makeBehindCar({left: ES9_SIDE.bodySpan.left, right: ES9_SIDE.bodySpan.right});
<defs><TerrainPatterns /></defs>
<g transform={`translate(${-dx} 0)`}>
  {bands.map((b, i) => <rect key={i} x={b.x} y={GROUND_Y} width={b.w} height={140}
     fill={TERRA[b.terr].base} />)}
  {bands.map((b, i) => <BandDecor key={i} bd={b} sd={i * 97 + 13} t={t} dx={dx} behind={behind} />)}
</g>
<Snowfall t={t} op={snowOp} n={26} sd={91} big />
<SandWind t={t} op={sandOp} />
```

硬性约束：

1. 位置一律用 `rnd(i)` 确定性伪随机，**绝不能用 `Math.random()`**——每帧重算会让道具满屏乱跳。
2. **立式道具经过主体时要淡出**（`makeBehindCar`）：侧视图里主体底部与地面之间有缝，
   背景的树/仙人掌会从主体底下「长」出来，两侧各留 40–50 单位渐变带。
3. 每种环境 = 至少一个立体道具 + 地面细节 + 一层运动（雪：雪人/松树 + 雪痕 + 飘雪；
   沙：仙人掌/枯木 + 风纹 + 扬沙；湿地：芦苇 + 水洼 + 涟漪；碎石：石堆 + 散石）。
4. 环境切换要淡入淡出 0.5–0.7s（在调用方用 opacity 包一层），不要硬切。
5. 所有道具的 `gy` 默认 `GROUND_Y = 420`，与 `side.ts` 的 `SIDE_GROUND_Y` 一致。

---

## 换车型 / 换主体时要改什么

按依赖顺序，从下往上改：

| 步骤 | 改哪儿 | 怎么改 |
|---|---|---|
| 1 | `spec.ts` | 换 `ES9_SPEC` 的三围/轴距/轮胎规格；`ES9_DERIVED` 的前后悬与轮距重新推算（三者之和必须等于车长）；`CROSS_RATIOS` 自动跟着变 |
| 2 | 拍/裁新照片 | 用 `cutout-trace.py encode` 裁切 + 纵向归正（`--ky` 由「实测长宽比 ÷ 实车长宽比」反推）+ 提亮，输出 data URI |
| 3 | 描新轮廓 | `cutout-trace.py scan` 扫边界 → `bright` 找灯带/棱线 → `grid` 目视读数 → `erode --segment` 逐段内缩 → `bleed` 体检（<1.5%）→ `preview` 看一张 |
| 4 | `side.ts` / `top.ts` | 替换 base64、`body` path、`src`、`bbox`；重算 `place` / `wheels` 的落位（公式写在文件注释里）；重设 `carLenPx` |
| 5 | `top.ts` 锚点 | 用 `spec.wheelAnchors()` 重新生成四个轮位，别手填 |
| 6 | `Wheel.tsx` | **先数清楚新车轮毂有几个孔**改 `HOLE_COUNT`；孔形半径/半角按实拍量；`rimToTireRatio` 变了要同步 |
| 7 | `colors.ts` | 换品牌才改；只改这一份，其余文件不动 |
| 8 | 断言 | 用 `spec.checkProportions()` + `assert-timeline.mjs` 把新尺寸跑一遍，别靠目测验收 |

**不需要改**的：`Kinematics.ts`（只吃轴距，与车型无关）、`FollowCard.tsx`（只吃主体包围盒）、
`terrain-props.tsx`（与主体无关，只需重设 `makeBehindCar` 的横向占位）。

## 主体不是车的时候

`Kinematics` / `FollowCard` / `terrain-props` / `colors` / `assert-timeline` 全都与「车」无关：

- 讲**座舱内**功能（宠物模式/空调/座椅）：只用 `colors` + `FollowCard` + 断言脚手架，
  座舱平面图另画（概念示意，登记 `conceptualItems`）。
- 讲**设备配合**（换电站/充电桩/随车硬件）：用 `FollowCard` 做设备状态卡 + 引导线指向设备。
- 讲**拓扑关系**（组队/无网通信）：`colors` 的分类色 + `assert-timeline` 的间距/出界断言。
