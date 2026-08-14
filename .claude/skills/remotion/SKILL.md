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

## 素材贴图规范（照片抠形）

用真实照片当主体时，用 SVG `clipPath` 手描轮廓抠形。三条硬性检查（都踩过坑）：

1. **轮廓不能有跳变台阶**——相邻点不要出现十几像素的垂直跃迁，否则渲出来是方块凸起。沿边缘取**稀疏平滑点**（20–40px 一个），不要 5px 一个密排，密排反而产生锯齿
2. **不能裹进背景**——尤其主体与地面接触处。用像素扫描定边界（按亮度/色相判断背景起始行），再让轮廓留 3–5px 余量压在主体内侧，不要凭目测
3. **不能切掉主体**——车顶行李架、天线、尾翼、保险杠下唇这类细长部件最容易被裁掉；定稿前必须整体渲一张确认

验证方法（省 token）：用 Python/PIL 把 clip 应用到原图、合成到纯色底、按问题区域裁切成**一张**对比图查看，不要反复整帧渲染。

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

然后把 `bundle.js` 内联进 `<script>`（发布前 `grep -c "</script" bundle.js` 必须为 0）。要点：
- **图片素材必须 base64 内联**，不能用 `staticFile()`——单文件 HTML 里没有 public 目录。做法：把图片转 base64 写成 `src/photo.ts` 导出常量，组件里引用它；这样 HTML 与 MP4 两条路都能用
- 外层包装组件（场景切换 chips、说明文字）是**普通交互 React**，可以用 `useState`；只有 `<Player>` 里的 composition 必须遵守帧驱动、无事件、确定性的规则
- 切换场景时给 `<Player key={scn}>` 加 key，强制重挂载以重置播放头
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
