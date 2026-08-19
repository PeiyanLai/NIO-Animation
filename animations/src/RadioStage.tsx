import React from 'react';
import {AbsoluteFill, Img, useCurrentFrame, useVideoConfig} from 'remotion';
import {
  A_CFG, B_CFG, C_CFG, D_CFG, GEO, NIO_PHOTO, OTH_WHEEL_R, OTH_WHEEL_X, RADIO_SCENES, R, S_NIO,
  TIRES, T_COLORS as C, F_DATA, F_UI, type RadioKey,
  dCarScale, dCarX, dCarY, frac, qPath, qPt, radioState, textW, win,
} from './radio-data';
import {PHOTO_URI} from './photo';
import {CAR_BODY} from './data';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/* 侧视纵向锚点（数字来源见 radio-data GEO 注释） */
const GY = GEO.groundY;        // 430 地面线（轮胎接地）
const ROOF = GEO.roofY;        // 367 蔚来车顶线
const ARC_Y = ROOF - 5;        // 362 硬件对讲弧的车端
const LINK_Y = ROOF - 7;       // 360 云端链路的车端
const HAND_Y = GY - 42;        // 388 递对讲机的起止高度（≈车窗下沿）
const CHAIN_Y = ROOF - 15;     // 352 组队连线（车顶上方一条虚线链）

/* ═══ 图标 ═══════════════════════════════════════════════════════════ */

/** 对讲机（手持机：机身 + 天线 + 喇叭格栅） */
const RadioIcon: React.FC<{x: number; y: number; k?: number; col?: string}> = ({x, y, k = 1, col = R.hw}) => (
  <g transform={`translate(${x} ${y}) scale(${k})`}>
    <path d="M4.5 -5 L8 -14" stroke={col} strokeWidth={2.2} strokeLinecap="round" />
    <circle cx={8} cy={-15} r={1.9} fill={col} />
    <rect x={-6.5} y={-5} width={13} height={16.5} rx={2.8} fill={col} />
    <rect x={-4} y={-2.6} width={8} height={4} rx={1.2} fill={C.panel} opacity={0.9} />
    <circle cx={0} cy={6.4} r={1.8} fill={C.panel} opacity={0.9} />
  </g>
);

/** 方向盘中键：车机内置的对讲能力（不占用那台手持对讲机） */
const WheelIcon: React.FC<{x: number; y: number; k?: number; col?: string; live?: boolean}> =
  ({x, y, k = 1, col = R.hw, live = false}) => (
  <g transform={`translate(${x} ${y}) scale(${k})`}>
    <circle r={9.2} fill="none" stroke={col} strokeWidth={2.1} />
    <path d="M-9 0.6 H9" stroke={col} strokeWidth={2.1} strokeLinecap="round" />
    <path d="M0 0.6 V9" stroke={col} strokeWidth={2.1} strokeLinecap="round" />
    <circle r={3.4} fill={live ? col : C.panel} stroke={col} strokeWidth={1.6} />
  </g>
);

/** 网络信号（三格）；off 时灰格 + 红叉 */
const NetIcon: React.FC<{x: number; y: number; on: boolean}> = ({x, y, on}) => (
  <g transform={`translate(${x} ${y})`}>
    <g fill={on ? C.accent : C.ink4} opacity={on ? 1 : 0.4}>
      <rect x={-9} y={2} width={4.2} height={6} rx={1.4} />
      <rect x={-2.4} y={-2.5} width={4.2} height={10.5} rx={1.4} />
      <rect x={4.2} y={-7.5} width={4.2} height={15.5} rx={1.4} />
    </g>
    {!on && (
      <path d="M-8.5 -7.5 L8.5 8 M8.5 -7.5 L-8.5 8" stroke={R.neg} strokeWidth={2.6} strokeLinecap="round" />
    )}
  </g>
);

const CLOUD_D =
  'M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z';

const Cloud: React.FC<{x: number; y: number; live: number; t: number}> = ({x, y, live, t}) => (
  <g>
    {live > 0 && [0, 0.5].map((d, i) => {
      const k = frac(t * 0.55 + d);
      return <ellipse key={i} cx={x} cy={y} rx={52 + 34 * k} ry={34 + 22 * k} fill="none"
        stroke={C.accent} strokeWidth={1.8} opacity={0.32 * (1 - k) * live} />;
    })}
    <g transform={`translate(${x} ${y}) scale(3.6) translate(-12 -12)`}>
      <path d={CLOUD_D} fill={C.panel} stroke={C.accent} strokeWidth={0.72} strokeLinejoin="round" />
    </g>
    <text x={x} y={y - 44} textAnchor="middle" fontSize={13} fill={C.ink3}>云端</text>
  </g>
);

/* ═══ 正侧视车（车队朝右）═══════════════════════════════════════════ */

/**
 * **蔚来车**用 photo.ts 那张 ES9 正侧视实拍（全工程侧视统一用同一张图，
 * 与 Stage.tsx / RampStage.tsx 同源），mask = CAR_BODY 车身抠形 + TIRES 轮胎圆
 * （CAR_BODY 下缘在轮胎中部，只用它会把轮子切掉——见 ramp-data 的教训）。
 *
 * **镜像说明**：原始照片**车头朝左**——CAR_BODY 实测前悬 144 photo-px（≈850mm）
 * < 后悬 190px（≈1118mm），前风挡从 x≈276 起坡、激光雷达平顶在 x 406~435，
 * 都在小 x 端。本片车队朝右，所以 scale(-1 1) 镜像，与 Stage/RampStage 的用法一致。
 *
 * 变换链（右侧先作用）：镜像 (px,py)→(−px,py) → 平移 (505.75, −394) 把车身
 * 中点挪到 x=0、接地线挪到 y=0 → scale(0.19) 进舞台（车长 907.5×0.19≈172.4px）。
 * 静止摆位，不需要旋转轮辋那套（skill「转轮」方案只在行驶时用）。
 */
const NioCarSide: React.FC = () => (
  <g transform={`scale(${S_NIO}) translate(${NIO_PHOTO.cx} ${-NIO_PHOTO.ground}) scale(-1 1)`}>
    <image href={PHOTO_URI} width={1020} height={460} mask="url(#radioCarMask)" />
  </g>
);

/**
 * **朋友的非蔚来车** —— 正侧视中性矢量车，**绝对不能用 ES9 那张照片**。
 * 本片叙事主线是「非蔚来车也能入队」，主体长一样这条主线就垮了（合规同理：
 * 不带品牌特征、不影射具体车型）。
 *
 * 三个维度同时拉开差距（skill 教训，单用任何一个都不够）：
 * - **尺寸**：4700×1470mm 紧凑两厢，经同一把 MM_PER_STAGE_PX 尺子换算成
 *   长 151 / 高 47.2 / 轴距 86.9 / 轮径 21.2（舞台px）——对 ES9 明显短一截矮一头；
 * - **颜色**：浅蓝灰实心（R.oth），对近黑的实拍图反差极大；
 * - **造型**：掀背轮廓 + 小矩形灯，完全不是 ES9 的三厢比例和刀锋灯带。
 *
 * 画法守 skill 侧视规则：车身**一笔闭合样条**、面内不加拼缝线；
 * 侧视要素 = 车身整块 + 舱线（玻璃带）+ 两个轮（深色圆 + 浅圈）。
 * 局部坐标：原点 = 接地线中点，+x 车头（右），y 向上为负。
 * 轮拱开口是圆心在轮心、r=13 的圆弧（轮 r=10.6，留 2.4px 机械缝隙）；
 * 弧与底边 y=−8.2 的交点 = 轮心x ± √(13²−2.4²) = ±12.78，弧顶 −23.6 盖过轮顶 −21.2。
 */
const OTH_SIDE_BODY =
  'M74.9,-10.8' +
  'Q76.2,-16.5 75.4,-21.5' +      // 前脸偏竖直（斜成楔形会像跑车影射，也丑）
  'Q74.8,-24.4 70.5,-25.8' +      // 灯眉圆角
  'L48,-28.2' +                   // 机盖（短机盖 = 两厢比例）
  'Q42.5,-29.1 39.5,-31.6' +      // cowl
  'L15,-43.8' +                   // 前风挡
  'Q8,-47.2 -4,-47.2' +           // 车顶前缘（车高 47.2 = 1470mm）
  'L-38,-47.2' +                  // 车顶
  'Q-49,-46.9 -55.5,-43.5' +      // 顶后转角
  'L-66.5,-37' +                  // 掀背斜面
  'Q-72.6,-33 -73.6,-26' +        // 尾上沿
  'L-74.6,-14' +
  'Q-74.9,-8.6 -69.5,-8.2' +      // 尾杠圆角
  'L-56.2,-8.2' +
  'A13,13 0 1 1 -30.6,-8.2' +     // 后轮拱（轮心 −43.4）
  'L30.6,-8.2' +
  'A13,13 0 1 1 56.2,-8.2' +      // 前轮拱（轮心 +43.4）
  'L69.8,-8.2' +
  'Q73.9,-8.5 74.9,-10.8Z';

const OtherCarSide: React.FC = () => (
  <g>
    {/* 车轮：深色圆 + 浅圈 + 毂心点。先画轮，车身的轮拱弧从它上方跨过 */}
    {[-OTH_WHEEL_X, OTH_WHEEL_X].map((wx) => (
      <g key={wx} transform={`translate(${wx} ${-OTH_WHEEL_R})`}>
        <circle r={OTH_WHEEL_R} fill="#23292F" />
        <circle r={5.6} fill="none" stroke="#C7D0D8" strokeWidth={2.1} />
        <circle r={1.6} fill="#C7D0D8" />
      </g>
    ))}
    {/* 车身：一笔闭合样条。描边很淡——重描边会像贴纸 */}
    <path d={OTH_SIDE_BODY} fill={R.oth} stroke={R.othLine} strokeWidth={0.9} />
    {/* 舱线（玻璃带）：沿腰线 y=−31.5 一整条，比车顶轮廓内缩 ~2.5px */}
    <path d="M34.5,-31.5 L13.5,-42.4 Q8,-44.8 -2,-44.8 L-39,-44.8 Q-47.5,-44.5 -53.3,-41.5 L-62.5,-35.8 L-63.5,-31.5 Z"
      fill={R.othRoof} opacity={0.88} />
    {/* B 柱：玻璃带上一条车身色窄条（正常侧视要素，不算拼缝线） */}
    <rect x={-14} y={-44.6} width={2.8} height={13.1} fill={R.oth} />
    {/* 车身高光：光源上方，与 ES9 实拍一致 */}
    <path d={OTH_SIDE_BODY} fill="url(#othGloss)" />
    {/* 前大灯（小四边形）+ 尾灯 —— 普通矩形灯，不画刀锋灯带 */}
    <path d="M66,-25.3 L74.8,-23 L74.5,-18.6 L64.8,-21 Z" fill="#FFF6E2" />
    <path d="M-74.4,-26.3 L-69.8,-27.4 L-69.2,-21.6 L-74.6,-21 Z" fill="#D14545" opacity={0.78} />
  </g>
);

const Car: React.FC<{x: number; y?: number; k?: number; kind: 'nio' | 'oth'; op?: number}> = ({
  x, y = GY, k = 1, kind, op = 1,
}) => (
  <g transform={`translate(${x} ${y}) scale(${k})`} opacity={op}>
    <ellipse cx={0} cy={5} rx={kind === 'nio' ? 94 : 80} ry={7} fill="#5C7070" opacity={0.13} />
    {kind === 'nio' ? <NioCarSide /> : <OtherCarSide />}
  </g>
);

/** 讲话/收到的提示环：以车身中心（groundY−30）为心的椭圆脉冲 */
const CarPulse: React.FC<{x: number; t: number; col?: string}> = ({x, t, col = R.hw}) => (
  <g>
    {[0, 0.33, 0.66].map((d, i) => {
      const k = frac(t * 0.75 + d);
      return <ellipse key={i} cx={x} cy={GY - 30} rx={100 + 42 * k} ry={46 + 24 * k}
        fill="none" stroke={col} strokeWidth={2.4} opacity={0.6 * (1 - k)} />;
    })}
  </g>
);

/* ═══ 贴车状态徽标（尖角朝下 + 虚线引导线到车顶）═══════════════════ */
const Badge: React.FC<{
  cx: number; tipX: number; label: string; radio: boolean; net: 'on' | 'off' | 'none';
  wheel?: boolean; wheelLive?: boolean; dy?: number;
  tone?: 'n' | 'hl' | 'bad' | 'ok'; t: number; pulse?: boolean;
}> = ({cx, tipX, label, radio, net, wheel = false, wheelLive = false, dy = 0, tone = 'n', t, pulse = false}) => {
  const fs = 13.5;
  const iw = (radio ? 25 : 0) + (wheel ? 26 : 0) + (net !== 'none' ? 26 : 0);
  const w = Math.max(92, textW(label, fs) + iw + 28);
  const h = GEO.badgeH;
  const y = GEO.badgeY + dy;
  const x0 = clamp(cx - w / 2, 8, 992 - w);
  const tip = clamp(tipX, x0 + 15, x0 + w - 15);
  const col = tone === 'hl' ? C.accent : tone === 'bad' ? R.neg : tone === 'ok' ? C.ok : C.line;
  const bg = tone === 'bad' ? R.negWash : C.panel;
  const ink = tone === 'bad' ? R.neg : tone === 'hl' ? C.ink : C.ink2;
  const ir = x0 + w - 14;
  const netX = ir - 13;
  const radX = ir - (net !== 'none' ? 26 : 0) - 11;
  const whlX = radX - (radio ? 25 : 0) - 1;
  return (
    <g>
      {pulse && [0, 0.5].map((d, i) => {
        const k = frac(t * 0.8 + d);
        return <rect key={i} x={x0 - 5 - 9 * k} y={y - 5 - 6 * k} width={w + 10 + 18 * k} height={h + 10 + 12 * k}
          rx={14 + 6 * k} fill="none" stroke={C.accent} strokeWidth={2} opacity={0.55 * (1 - k)} />;
      })}
      <rect x={x0} y={y} width={w} height={h} rx={10} fill={bg} stroke={col} strokeWidth={tone === 'n' ? 1.5 : 2.2} />
      <path d={`M${tip - 7} ${y + h} L${tip} ${y + h + GEO.badgeTip} L${tip + 7} ${y + h}`}
        fill={bg} stroke={col} strokeWidth={tone === 'n' ? 1.5 : 2.2} strokeLinejoin="round" />
      <path d={`M${tip - 6} ${y + h} h12`} stroke={bg} strokeWidth={3} />
      <text x={x0 + 13} y={y + 22.5} fontSize={fs} fontWeight={600} fill={ink}>{label}</text>
      {radio && <RadioIcon x={radX} y={y + 17} k={0.9} col={tone === 'bad' ? R.neg : R.hw} />}
      {wheel && <WheelIcon x={whlX} y={y + 17} k={0.86} col={wheelLive ? C.accent : C.ink3} live={wheelLive} />}
      {net !== 'none' && <NetIcon x={netX} y={y + 17} on={net === 'on'} />}
      {/* 虚线引导线：徽标尖角 → 侧视车顶上方（roofY−8=359；徽标下沉时终点跟半程） */}
      <path d={`M${tip} ${y + h + GEO.badgeTip + 2} V${ROOF - 8 + dy * 0.5}`} stroke={col}
        strokeWidth={1.4} strokeDasharray="3 4" opacity={0.55} />
    </g>
  );
};

/* ═══ 字幕气泡（贴着当前主体车，尖角朝下）═════════════════════════ */
const Callout: React.FC<{main: string; sub: string; tipX: number; ph: number; op: number}> = ({
  main, sub, tipX, ph, op,
}) => {
  const w = Math.max(textW(main, 20.5), textW(sub, 14.5) + 96) + 38;
  const h = GEO.capBot - GEO.capTop;
  const y0 = GEO.capTop;
  const cx = clamp(tipX, 16 + w / 2, 984 - w / 2);
  const x0 = cx - w / 2;
  const tip = clamp(tipX, x0 + 20, x0 + w - 20);
  const done = ph === 4;
  const col = done ? C.ok : C.accent;
  const dx = x0 + w - 24 - 60;
  return (
    <g opacity={op}>
      <rect x={x0} y={y0} width={w} height={h} rx={14} fill={C.panel} stroke={col} strokeWidth={2}
        style={{filter: 'drop-shadow(0 10px 18px rgba(0,60,70,.10))'}} />
      <path d={`M${tip - 9} ${y0 + h} L${tip} ${y0 + h + 11} L${tip + 9} ${y0 + h}`}
        fill={C.panel} stroke={col} strokeWidth={2} strokeLinejoin="round" />
      <path d={`M${tip - 8} ${y0 + h} h16`} stroke={C.panel} strokeWidth={3} />
      <text x={x0 + 19} y={y0 + 35} fontSize={20.5} fontWeight={700} fill={done ? C.ok : C.ink}>{main}</text>
      <text x={x0 + 19} y={y0 + 60} fontSize={14.5} fill={C.ink2}>{sub}</text>
      {[0, 1, 2, 3, 4].map((i) => (
        <circle key={i} cx={dx + i * 15} cy={y0 + 55} r={4.5}
          fill={i <= ph ? (done ? C.ok : C.accent) : C.line} />
      ))}
    </g>
  );
};

/* ═══ 硬件对讲弧（紫 · 实线，画出后常驻；画在车顶上方）═══════════════
   端点 y=ARC_Y(362)、控制点 −86 ⇒ 弧顶 ≈ 319，在徽标尖角(301)之下、车顶之上 */
const HwArc: React.FC<{x1: number; x2: number; p: number; t: number}> = ({x1, x2, p, t}) => {
  if (p <= 0) return null;
  const y = ARC_Y;
  const d = `M${x1} ${y} Q${(x1 + x2) / 2} ${y - 86} ${x2} ${y}`;
  return (
    <g>
      <path d={d} fill="none" stroke={R.hw2} strokeWidth={8} opacity={0.16}
        pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} strokeLinecap="round" />
      <path d={d} fill="none" stroke={R.hw} strokeWidth={3.4}
        pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} strokeLinecap="round" />
      {p >= 1 && (
        <circle r={5} fill={R.hw}
          cx={qPt([x1, y], [(x1 + x2) / 2, y - 86], [x2, y], frac(t * 0.6)).x}
          cy={qPt([x1, y], [(x1 + x2) / 2, y - 86], [x2, y], frac(t * 0.6)).y} />
      )}
    </g>
  );
};

/* ═══ 云端链路（青 · 虚线 + 数据包，必须带「信号传输」标注）═══════ */
const CloudLink: React.FC<{p0: number[]; c: number[]; p1: number[]; p: number; t: number; col?: string}> = ({
  p0, c, p1, p, t, col = C.accent,
}) => {
  if (p <= 0) return null;
  const d = qPath(p0, c, p1);
  const pt = qPt(p0, c, p1, Math.min(p, 1));
  return (
    <g>
      <path d={d} fill="none" stroke={col} strokeWidth={2.6} strokeDasharray="9 8"
        strokeDashoffset={-frac(t * 0.7) * 17} opacity={Math.min(1, p * 3) * 0.95} strokeLinecap="round" />
      {p < 1 && (
        <g>
          <circle cx={pt.x} cy={pt.y} r={12} fill={col} opacity={0.18} />
          <circle cx={pt.x} cy={pt.y} r={5.5} fill={col} />
        </g>
      )}
    </g>
  );
};

/** 虚线上的文字标注（白底药丸，压在线上） */
const LinkTag: React.FC<{x: number; y: number; text: string; col?: string; op?: number}> = ({
  x, y, text, col = C.accent, op = 1,
}) => {
  const w = textW(text, 12) + 20;
  return (
    <g opacity={op}>
      <rect x={x - w / 2} y={y - 11} width={w} height={22} rx={11} fill={C.panel} stroke={col} strokeWidth={1.4} />
      <text x={x} y={y + 4.2} textAnchor="middle" fontSize={12} fontWeight={600} fill={col}>{text}</text>
    </g>
  );
};

/* ═══ 距离标注（双向箭头 + 两行文案）═══════════════════════════════ */
const Dim: React.FC<{x1: number; x2: number; y: number; main: string; sub: string; col: string; op: number}> = ({
  x1, x2, y, main, sub, col, op,
}) => (
  <g opacity={op}>
    <path d={`M${x1} ${y - 9} V${y + 9} M${x2} ${y - 9} V${y + 9}`} stroke={col} strokeWidth={1.8} opacity={0.6} />
    <path d={`M${x1} ${y} H${x2}`} stroke={col} strokeWidth={2} />
    <path d={`M${x1} ${y} l11 -5.5 M${x1} ${y} l11 5.5 M${x2} ${y} l-11 -5.5 M${x2} ${y} l-11 5.5`}
      stroke={col} strokeWidth={2.2} strokeLinecap="round" fill="none" />
    <text x={(x1 + x2) / 2} y={y + 28} textAnchor="middle" fontSize={17} fontWeight={700} fill={col}>{main}</text>
    <text x={(x1 + x2) / 2} y={y + 48} textAnchor="middle" fontSize={12.5} fill={C.ink3}>{sub}</text>
  </g>
);

/* ═══ 贴着车的说明卡（尖角朝上）═══════════════════════════════════ */
const InfoCard: React.FC<{
  tipX: number; w: number; h: number; op: number; tone?: string; children: React.ReactNode;
}> = ({tipX, w, h, op, tone = C.accent, children}) => {
  const y0 = GEO.cardTop;
  const cx = clamp(tipX, 16 + w / 2, 984 - w / 2);
  const x0 = cx - w / 2;
  const tip = clamp(tipX, x0 + 20, x0 + w - 20);
  return (
    <g opacity={op} transform={`translate(0 ${(1 - op) * 8})`}>
      <rect x={x0} y={y0} width={w} height={h} rx={13} fill={C.panel} stroke={tone} strokeWidth={2}
        style={{filter: 'drop-shadow(0 10px 18px rgba(0,60,70,.10))'}} />
      <path d={`M${tip - 9} ${y0} L${tip} ${y0 - 11} L${tip + 9} ${y0}`}
        fill={C.panel} stroke={tone} strokeWidth={2} strokeLinejoin="round" />
      <path d={`M${tip - 8} ${y0} h16`} stroke={C.panel} strokeWidth={3} />
      <g transform={`translate(${x0} ${y0})`}>{children}</g>
    </g>
  );
};

/* ═══ 地面（侧视：地面线 + 路面带，参考 Stage.tsx 的地面画法）═══════
   车队静止摆位（轮不转），路面标线也**静止**——滚动标线配不转的轮会读成打滑 */
const Road: React.FC = () => (
  <g>
    <rect x={0} y={GY} width={1000} height={560 - GY} fill={R.road} />
    <path d={`M0 ${GY} H1000`} stroke={R.roadEdge} strokeWidth={2.5} />
    <path d="M0 447 H1000" stroke={R.lane} strokeWidth={3} strokeDasharray="30 26" opacity={0.8} />
  </g>
);

/* ═══ 场景二：无网地形 —— 侧视远山 / 山谷剪影（分界线右侧）═══════════
   两层山脊折线，底边落在地面线上（侧视里地面线即地平线）；
   峰高 330~400，在车顶(367)上下、徽标区(258~301)之下，压不到任何 UI */
const Hills: React.FC = () => (
  <g>
    <path d={`M560 ${GY} L618 374 L666 400 L742 336 L806 388 L874 330 L942 392 L1000 352 L1000 ${GY} Z`}
      fill={C.ink4} opacity={0.16} />
    <path d={`M560 ${GY} L648 394 L714 421 L792 380 L868 414 L946 378 L1000 402 L1000 ${GY} Z`}
      fill={C.ink4} opacity={0.24} />
  </g>
);

/* ═══ 舞台 ═════════════════════════════════════════════════════════ */
export const RadioStage: React.FC<{scene: RadioKey}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = RADIO_SCENES[scene];
  const t = Math.min(frame / fps, s.T - 0.001);
  const st = radioState(scene, t);
  const ph = st.ph;

  const xs = s.cars.map((c, i) => (scene === 'd' ? dCarX(i, t) : c.x));
  // 场景四换队形：超车走远道（画高+缩小）、退队走近道（画低+放大），其余场景恒在地面线
  const ys = s.cars.map((_, i) => (scene === 'd' ? dCarY(i, t) : GY));
  const ks = s.cars.map((_, i) => (scene === 'd' ? dCarScale(i, t) : 1));
  // 侧视 z 序：远（y 小）先画，近（y 大）后画
  const zOrder = [0, 1, 2, 3].sort((p, q) => ys[p] - ys[q] || p - q);
  const phStart = ph === 0 ? 0 : s.ph[ph - 1];
  const capK = win(t, phStart, phStart + 0.4);
  const tipX = scene === 'd' && ph === 1 ? xs[3] : s.capTip[ph];

  /* 场景一：讲话车 → 云 → 其余三台 */
  const aSpk = A_CFG.speaker;
  const aCloud = [A_CFG.cloud[0], A_CFG.cloud[1]] as number[];

  /* 场景二：链路几何（标注锚点推导见 B_CFG 注释） */
  const b3 = [B_CFG.divider - 95, LINK_Y];        // = [465, 360] 桥接车车顶
  const bCloudA = [356, 128];
  const bCloudB = [305, 128];
  const b4 = [160, LINK_Y];
  const bRecvT = [0, B_CFG.a12[1] + 0.15, B_CFG.a23[1] + 0.15, B_CFG.down[1] + 0.15];

  /* 场景三/四：对讲机递出的飞行弧（起止在车窗高度，弧顶飞过车顶） */
  const cHandPt = qPt([640, HAND_Y], [750, 230], [C_CFG.friend, HAND_Y], st.cHand);
  const dHandPt = qPt([D_CFG.slot[0], HAND_Y],
    [(D_CFG.slot[0] + D_CFG.slot[1]) / 2, 232], [D_CFG.slot[1], HAND_Y], st.dHand);

  return (
    <AbsoluteFill style={{background: C.stageBg, fontFamily: F_UI}}>
      {/* 预载真车照片（Img 阻塞渲染直至加载完成，确保 SVG image 同帧就绪） */}
      <Img src={PHOTO_URI} style={{position: 'absolute', width: 1, height: 1, opacity: 0}} />
      <svg viewBox="0 0 1000 560" style={{position: 'absolute', inset: 0, width: 1920, height: 1075}}>
        <defs>
          <linearGradient id="othGloss" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.30" />
            <stop offset="42%" stopColor="#FFFFFF" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#2E3D3D" stopOpacity="0.14" />
          </linearGradient>
          {/* ES9 侧视抠形：车身 + 轮胎圆（坐标都在照片系里，随镜像组一起变换） */}
          <mask id="radioCarMask">
            <path d={CAR_BODY} fill="#fff" />
            {TIRES.map((w, i) => <circle key={i} cx={w.cx} cy={w.cy} r={w.r} fill="#fff" />)}
          </mask>
        </defs>

        <Road />

        {/* ── 场景二：无网区底色 + 远山剪影 + 分界线 ── */}
        {scene === 'b' && (
          <g>
            <rect x={B_CFG.divider} y={0} width={1000 - B_CFG.divider} height={560} fill={R.nonet} opacity={0.17} />
            <Hills />
            <path d={`M${B_CFG.divider} 60 V520`} stroke={C.ink4} strokeWidth={2.2} strokeDasharray="11 9" />
            <circle cx={B_CFG.divider} cy={60} r={4} fill={C.ink4} />
            <circle cx={B_CFG.divider} cy={520} r={4} fill={C.ink4} />
            <text x={B_CFG.divider + 14} y={112} fontSize={13} fontWeight={600} fill={C.ink3}>
              信号复杂地形 · 无网区
            </text>
            <text x={B_CFG.divider - 14} y={112} textAnchor="end" fontSize={13} fontWeight={600} fill={C.accent}>
              网络覆盖区
            </text>
          </g>
        )}

        {/* ── 云端 ── */}
        {scene === 'a' && <Cloud x={aCloud[0]} y={aCloud[1]} live={st.aUp} t={t} />}
        {scene === 'b' && <Cloud x={B_CFG.cloud[0]} y={B_CFG.cloud[1]} live={st.bUp} t={t} />}
        {scene === 'c' && st.cJoined && <Cloud x={520} y={104} live={1} t={t} />}

        {/* ── 场景一：组队连线（车顶上方虚线链）+ 云端扇出 ── */}
        {scene === 'a' && (
          <g>
            <path d={`M${xs[3]} ${CHAIN_Y} H${xs[0]}`} stroke={C.accent} strokeWidth={2} strokeDasharray="7 7"
              strokeDashoffset={-frac(t * 0.6) * 14} opacity={0.55} />
            {xs.map((x, i) => <circle key={i} cx={x} cy={CHAIN_Y} r={4.5} fill={C.accent} opacity={0.75} />)}
            {st.aPress && <CarPulse x={xs[aSpk]} t={t} />}
            <CloudLink p0={[xs[aSpk], LINK_Y]} c={[600, 210]} p1={[aCloud[0] + 34, aCloud[1] + 22]} p={st.aUp} t={t} />
            {[0, 2, 3].map((i) => (
              <CloudLink key={i} p0={[aCloud[0] - 30, aCloud[1] + 24]}
                c={[(aCloud[0] + xs[i]) / 2, 250]} p1={[xs[i], LINK_Y]} p={st.aFan} t={t} />
            ))}
            {st.aFan > 0.1 && <LinkTag x={376} y={254} text="信号传输" op={Math.min(1, st.aFan * 3)} />}
          </g>
        )}

        {/* ── 场景二：硬件接力 → 桥接上云 ── */}
        {scene === 'b' && (
          <g>
            {st.bTalk && <CarPulse x={890} t={t} />}
            <HwArc x1={890} x2={700} p={st.b12} t={t} />
            <HwArc x1={700} x2={465} p={st.b23} t={t} />
            {st.b12 > 0.15 && (
              <LinkTag x={795} y={340} text="对讲机硬件直连" col={R.hw} op={Math.min(1, st.b12 * 3)} />
            )}
            <CloudLink p0={b3} c={[390, 235]} p1={bCloudA} p={st.bUp} t={t} />
            <CloudLink p0={bCloudB} c={[250, 235]} p1={b4} p={st.bDown} t={t} />
            {B_CFG.sigLabels.map((g, i) => (
              <LinkTag key={i} x={g.x} y={g.y} text="信号传输"
                op={Math.min(1, (i === 0 ? st.bUp : st.bDown) * 3)} />
            ))}
            {/* 桥接节点高亮（罩住整台侧视车：x 465±100，y 356~438） */}
            {st.bBridge && (
              <g>
                {[0, 0.5].map((d, i) => {
                  const k = frac(t * 0.6 + d);
                  return <rect key={i} x={365 - 12 * k} y={356 - 8 * k}
                    width={200 + 24 * k} height={82 + 16 * k} rx={24} fill="none"
                    stroke={C.accent} strokeWidth={2.2} opacity={0.5 * (1 - k)} />;
                })}
                <rect x={365} y={356} width={200} height={82} rx={24} fill="none"
                  stroke={C.accent} strokeWidth={2.4} strokeDasharray="8 8" opacity={0.9} />
              </g>
            )}
            {/* 收到提示环 */}
            {[1, 2, 3].map((i) => {
              const k = win(t, bRecvT[i], bRecvT[i] + 1.3);
              if (k <= 0 || k >= 1) return null;
              return (
                <ellipse key={i} cx={xs[i]} cy={GY - 30} rx={98 + 46 * k} ry={44 + 26 * k} fill="none"
                  stroke={i === 3 ? C.accent : R.hw} strokeWidth={3} opacity={0.85 * (1 - k)} />
              );
            })}
            {B_CFG.dims.map((d, i) => (
              <Dim key={i} x1={d.x1} x2={d.x2} y={d.y} main={d.main} sub={d.sub}
                col={d.tone === 'hw' ? R.hw : C.accent} op={Math.min(1, win(t, 0.6 + i * 0.35, 1.4 + i * 0.35))} />
            ))}
          </g>
        )}

        {/* ── 场景三：递对讲机 ── */}
        {scene === 'c' && st.cHand > 0 && st.cHand < 1 && (
          <g>
            <path d={qPath([640, HAND_Y], [750, 230], [C_CFG.friend, HAND_Y])} fill="none"
              stroke={R.hw} strokeWidth={2} strokeDasharray="6 7" opacity={0.5} />
            <circle cx={cHandPt.x} cy={cHandPt.y} r={17} fill={R.hwWash} stroke={R.hw} strokeWidth={2} />
            <RadioIcon x={cHandPt.x} y={cHandPt.y + 2} k={1.05} />
          </g>
        )}
        {scene === 'c' && st.cJoined && (
          <g>
            <path d={`M${xs[2]} ${CHAIN_Y} H${C_CFG.friend}`} stroke={C.accent} strokeWidth={2} strokeDasharray="7 7"
              strokeDashoffset={-frac(t * 0.6) * 14} opacity={0.6} />
            {[xs[0], xs[1], xs[2], C_CFG.friend].map((x, i) => (
              <circle key={i} cx={x} cy={CHAIN_Y} r={4.5} fill={C.accent} opacity={0.8} />
            ))}
            <CloudLink p0={[C_CFG.friend, LINK_Y]} c={[720, 220]} p1={[556, 122]} p={1} t={t} />
            <CloudLink p0={[486, 122]} c={[380, 240]} p1={[xs[2], LINK_Y]} p={1} t={t} />
            <LinkTag x={376} y={240} text="信号传输" />
          </g>
        )}

        {/* ── 场景四：队形链路 ── */}
        {scene === 'd' && (
          <g>
            {/* 全队唯一的一台对讲机，从蔚来车主递给朋友的车 */}
            {st.dHand > 0 && st.dHand < 1 && (
              <g>
                <path d={qPath([D_CFG.slot[0], HAND_Y], [(D_CFG.slot[0] + D_CFG.slot[1]) / 2, 232],
                  [D_CFG.slot[1], HAND_Y])} fill="none" stroke={R.hw} strokeWidth={2}
                  strokeDasharray="6 7" opacity={0.5} />
                <circle cx={dHandPt.x} cy={dHandPt.y} r={17} fill={R.hwWash} stroke={R.hw} strokeWidth={2} />
                <RadioIcon x={dHandPt.x} y={dHandPt.y + 2} k={1.05} />
                {/* 「全队只有这一台」不再单独挂药丸标注：递机期在相位 0 内，
                    字幕气泡（y164~240，此时正指向 x560）已原句说明且会盖住该位置 */}
              </g>
            )}
            {/* 错误队形：队尾只有 App，弱网 → 链路断开 */}
            {ph === 1 && st.dLost && (
              <g>
                <path d={qPath([xs[2], ARC_Y], [(xs[2] + xs[3]) / 2, 250], [xs[3], ARC_Y])}
                  fill="none" stroke={R.neg} strokeWidth={2.4} strokeDasharray="8 8" opacity={0.75} />
                <g transform={`translate(${(xs[2] + xs[3]) / 2} 306)`}>
                  <circle r={14} fill={C.panel} stroke={R.neg} strokeWidth={2.2} />
                  <path d="M-6 -6 L6 6 M6 -6 L-6 6" stroke={R.neg} strokeWidth={2.6} strokeLinecap="round" />
                </g>
              </g>
            )}
            {/* 推荐队形：头尾对讲机直连，罩住中间两台 */}
            {st.dLink > 0 && (
              <g>
                <HwArc x1={xs[0]} x2={xs[1]} p={st.dLink} t={t} />
                <LinkTag x={(xs[0] + xs[1]) / 2} y={318}
                  text={st.dTalk || st.dRecv ? '方向盘按键发话 → 对讲机收话' : '硬件对讲 · 覆盖全队'}
                  col={R.hw} op={Math.min(1, st.dLink * 2)} />
              </g>
            )}
          </g>
        )}

        {/* ── 车（远道先画、近道后画）── */}
        {zOrder.map((i) => (
          <Car key={i} x={xs[i]} y={ys[i]} k={ks[i]} kind={s.cars[i].kind} />
        ))}

        {/* ── 贴车徽标 ── */}
        {s.cars.map((c, i) => {
          let label = c.label;
          let radio = c.radio;
          let net = c.net;
          let tone: 'n' | 'hl' | 'bad' | 'ok' = 'n';
          let pulse = false;
          if (scene === 'a') {
            if (i === aSpk) {
              if (st.aPress) { label = '我 · 讲话中'; tone = 'hl'; pulse = true; }
              else if (st.aRecv) { label = '我 · 已发送'; tone = 'ok'; }
            } else if (st.aRecv) { label = c.label + ' · 已收到'; tone = 'ok'; }
          }
          if (scene === 'b') {
            if (i === 2) tone = st.bBridge ? 'hl' : 'n';
            if (st.bRecv[i] && i > 0) tone = i === 2 ? 'hl' : 'ok';
            if (i === 0 && st.bTalk) { tone = 'hl'; pulse = true; }
          }
          if (scene === 'c' && i === 3) {
            if (!st.cJoined && !st.cApp) { label = '朋友的车 · 无组队'; tone = 'bad'; net = 'on'; }
            else if (st.cJoined) { label = '朋友的车 · 已入队'; radio = true; tone = 'ok'; }
            else { label = '朋友的车 · 绑定中'; radio = true; tone = 'hl'; pulse = true; }
          }
          if (scene === 'c' && i === 0 && st.cHand >= 1) radio = false;
          let wheel = c.wheel === true;
          let wheelLive = false;
          if (scene === 'd') {
            // 全队只有一台手持对讲机：递出后车 0 不再有，车 1 才有
            if (i === 0) {
              radio = st.dHand < 1;
              label = st.dHand < 1 ? '蔚来车主 · 有对讲机' : '蔚来车主 · 方向盘按键发话';
              if (st.dTalk) { tone = 'hl'; pulse = true; wheelLive = true; label = '蔚来车主 · 讲话中'; }
            }
            if (i === 1) {
              radio = st.dHand >= 1;
              label = st.dHand < 1 ? '朋友的车 · 仅 App' : '朋友的车 · 拿到对讲机';
              if (st.dRecv) { tone = 'ok'; label = '朋友的车 · 对讲机已收到'; }
            }
            if (i === 3 && st.dLost) { label = '掉队 · 失联'; tone = 'bad'; net = 'off'; }
            if (st.dGood && !st.dTalk && !st.dRecv && (i === 0 || i === 1)) tone = 'hl';
          }
          // 场景四换队形：借近道（y>groundY）那台的徽标同步下沉 ×3.0（满偏 12→36px，
          // 大于徽标高 34+2），否则与超车车的徽标在同一行相遇会叠在一起
          const dy = scene === 'd' && ys[i] > GY ? (ys[i] - GY) * 3.0 : 0;
          return (
            <Badge key={i} cx={xs[i] + ((c.bx ?? c.x) - c.x)} tipX={xs[i]} label={label} dy={dy}
              radio={radio} net={net} wheel={wheel} wheelLive={wheelLive} tone={tone} t={t} pulse={pulse} />
          );
        })}

        {/* ── 场景四：队形注记 ── */}
        {scene === 'd' && (
          <g>
            {st.dGood && (
              <g opacity={Math.min(1, win(t, D_CFG.swap[1], D_CFG.swap[1] + 0.5))}>
                <text x={xs[0]} y={472} textAnchor="middle" fontSize={13.5} fontWeight={700} fill={R.hw}>
                  队首 · 车机方向盘发话
                </text>
                <text x={xs[1]} y={472} textAnchor="middle" fontSize={13.5} fontWeight={700} fill={R.hw}>
                  队尾 · 手持对讲机
                </text>
                <path d={`M${xs[2] + 78} 458 v10 H${xs[3] - 78} v-10`} fill="none" stroke={C.accent} strokeWidth={2} />
                <text x={(xs[2] + xs[3]) / 2} y={490} textAnchor="middle" fontSize={13.5} fontWeight={600} fill={C.accent}>
                  中间两台只有 App · 被头尾守在中间
                </text>
              </g>
            )}
            {ph === 1 && st.dLost && (
              <InfoCard tipX={xs[3]} w={252} h={78} op={Math.min(1, win(t, D_CFG.lost, D_CFG.lost + 0.4))} tone={R.neg}>
                <text x={18} y={30} fontSize={16} fontWeight={700} fill={R.neg}>队尾没有对讲机</text>
                <text x={18} y={54} fontSize={13} fill={C.ink2}>一进弱网就掉队，叫不回来</text>
              </InfoCard>
            )}
          </g>
        )}

        {/* ── 场景一：共享信息卡 / 对讲操作卡 ── */}
        {scene === 'a' && ph <= 1 && (
          <InfoCard tipX={565} w={440} h={92}
            op={Math.max(0, Math.min(1, win(t, 0.5, 1.0) - win(t, s.ph[1] - 0.3, s.ph[1])))}>
            <text x={20} y={28} fontSize={15.5} fontWeight={700} fill={C.ink}>小队已组建 · 4 / 50 台</text>
            {[['实时定位', 20], ['车辆信息', 160], ['导航目的地', 300]].map(([txt, x], i) => (
              <g key={i} transform={`translate(${x as number} 44)`}>
                <rect x={0} y={0} width={128} height={32} rx={8} fill={C.accentWash} />
                <circle cx={18} cy={16} r={6} fill="none" stroke={C.accent} strokeWidth={2.2} />
                <circle cx={18} cy={16} r={2} fill={C.accent} />
                <text x={32} y={21} fontSize={13} fontWeight={600} fill={C.ink2}>{txt as string}</text>
              </g>
            ))}
          </InfoCard>
        )}
        {scene === 'a' && ph >= 2 && ph <= 3 && (
          <InfoCard tipX={xs[aSpk]} w={310} h={84} op={Math.min(1, win(t, s.ph[1], s.ph[1] + 0.45))}>
            <g transform="translate(38 42)">
              <circle r={20} fill="none" stroke={C.ink3} strokeWidth={3} />
              <circle r={7} fill={st.aPress ? C.accent : C.ink3} />
              <path d="M-20 0 h13 M20 0 h-13 M0 20 v-13" stroke={C.ink3} strokeWidth={2.6} strokeLinecap="round" />
            </g>
            <text x={72} y={36} fontSize={15.5} fontWeight={700} fill={C.ink}>方向盘中键 · 按下讲话</text>
            <text x={72} y={60} fontSize={13} fill={C.ink2}>再按一次发送，全队同时播放</text>
          </InfoCard>
        )}

        {/* ── 场景三：App 绑定卡 ── */}
        {scene === 'c' && st.cApp && (
          <InfoCard tipX={C_CFG.friend} w={300} h={86}
            op={Math.min(1, win(t, C_CFG.app, C_CFG.app + 0.45))} tone={st.cJoined ? C.ok : C.accent}>
            <g transform="translate(34 43)">
              <rect x={-14} y={-24} width={28} height={48} rx={5} fill={C.panel} stroke={C.ink3} strokeWidth={2} />
              <rect x={-10} y={-19} width={20} height={32} rx={2.5} fill={C.accentWash} />
              <circle cx={0} cy={18} r={2.6} fill={C.ink3} />
              <circle cx={0} cy={-3} r={6.5} fill="none" stroke={C.accent} strokeWidth={2.2} />
            </g>
            <text x={68} y={36} fontSize={15.5} fontWeight={700} fill={C.ink}>
              {st.cJoined ? '绑定完成 · 已入队' : '蔚来 App · 绑定新账号'}
            </text>
            <text x={68} y={60} fontSize={13} fill={C.ink2}>
              {st.cJoined ? '小队 4 / 50 台 · 有网即可对讲' : '对讲机跟着账号走，绑定即入队'}
            </text>
          </InfoCard>
        )}

        {/* ── 字幕气泡（贴着当前主体车）── */}
        <Callout main={s.caps[ph][0]} sub={s.caps[ph][1]} tipX={tipX} ph={ph} op={capK} />
      </svg>

      {/* 章节标题 */}
      <div style={{
        position: 'absolute', top: 22, left: 0, right: 0, display: 'flex',
        justifyContent: 'center', opacity: Math.min(1, win(t, 0.15, 0.6)),
      }}>
        <span style={{
          fontSize: 21, color: C.ink2, background: C.panel, border: `1.5px solid ${C.line}`,
          borderRadius: 999, padding: '7px 22px', letterSpacing: '0.01em',
        }}>
          {s.chip}
          <em style={{
            fontStyle: 'normal', fontFamily: F_DATA, fontSize: 12, letterSpacing: '0.12em',
            color: C.ink3, marginLeft: 14,
          }}>概念示意</em>
        </span>
      </div>
    </AbsoluteFill>
  );
};
