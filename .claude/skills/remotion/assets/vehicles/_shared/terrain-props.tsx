// 环境道具库（来自全地形动画 remotion-terrain/src/Stage.tsx）
//
// 为什么需要：环境不是背景色块。只把地面涂白，看的人不会认为那是雪地；只涂黄，也不会
// 认为那是沙地。**每种环境至少要有一个「一眼就认出来」的实体道具 + 一层运动**。
//
// ─── 硬性约束 ─────────────────────────────────────────────────────────────
// 1. 位置一律用**确定性伪随机** `rnd(i)`，**绝不能用 Math.random()**——每帧重算会让
//    道具满屏乱跳，MP4 也无法复现。Remotion 的 random('seed') 同理，但这里用纯函数更省。
// 2. **立式道具经过主体时要淡出**（makeBehindCar）：侧视图里主体底部与地面之间有缝，
//    背景的树/仙人掌会从主体底下「长」出来。两侧各留 40–50 单位渐变带。
// 3. 道具颜色只从 colors.ts 的 TERRA + NIO 中性色取，不要为了「像真的」引进品牌外颜色。
// 4. 地面线默认 GROUND_Y = 420（舞台 1000×560），与 side.ts 的 SIDE_GROUND_Y 一致；
//    所有道具都以它为基准，改了要一起改。每个组件都接受 gy 覆盖。
// 5. 环境切换要**淡入淡出** 0.5–0.7s，不要硬切（淡入淡出在调用方做，用 opacity 包一层）。

import React from 'react';
import {NIO, SNOWFLAKE_STROKE, SNOW_STROKE, TERRA, type TerrKey} from './colors';

/** 默认地面线（地形带上沿 = 轮胎接地线） */
export const GROUND_Y = 420;

export const frac = (x: number) => x - Math.floor(x);
/** 确定性伪随机（纯函数，无 Math.random） */
export const rnd = (i: number) => frac(Math.sin(i * 127.1 + 311.7) * 43758.5453);
const f1 = (n: number) => n.toFixed(1);

/** 地形带：terr = 地形，x/w = 舞台横向区间（可为负、可超出画面） */
export interface Band {
  terr: TerrKey;
  x: number;
  w: number;
}

/**
 * 主体遮挡淡出：返回 0–1 的 opacity。
 * left/right = 主体在舞台上的横向占位，fade = 渐变带宽度。
 * 用法：`const behindCar = makeBehindCar({left:190, right:640});`
 *       `<g opacity={behindCar(propX, scrollDx)}>…</g>`
 */
export const makeBehindCar =
  ({left, right, fade = 46}: {left: number; right: number; fade?: number}) =>
  (x: number, dx: number) => {
    const sx = x - dx;
    if (sx <= left - fade || sx >= right + fade) return 1;
    if (sx >= left && sx <= right) return 0;
    return sx < left ? (left - sx) / fade : (sx - right) / fade;
  };

export type Spot = {x: number; a: number; b: number; c: number; i: number};

/** 沿地形带均匀撒点（带确定性抖动）；a/b/c 是三个可复用的 0–1 随机量 */
export const spots = (bd: Band, step: number, sd: number): Spot[] => {
  const n = Math.max(1, Math.round(bd.w / step));
  const out: Spot[] = [];
  for (let i = 0; i < n; i++) {
    const a = rnd(sd + i * 3.13);
    const b = rnd(sd + i * 7.77 + 1.7);
    const c = rnd(sd + i * 5.31 + 4.3);
    out.push({x: bd.x + step * (i + 0.5) + (a - 0.5) * step * 0.5, a, b, c, i});
  }
  return out;
};

/** 沿地面线起伏的轮廓（雪丘 / 沙丘 / 石堆边缘）；返回闭合 path */
export const crest = (
  bd: Band, amp: number, sd: number, step: number, depth: number, gy = GROUND_Y,
) => {
  const n = Math.max(2, Math.ceil(bd.w / step));
  let py = gy - 2 - rnd(sd) * amp;
  let d = `M${f1(bd.x)} ${gy + depth} L${f1(bd.x)} ${f1(py)}`;
  for (let i = 1; i <= n; i++) {
    const x = bd.x + (bd.w * i) / n;
    const px = bd.x + (bd.w * (i - 1)) / n;
    const y = gy - 2 - rnd(sd + i * 2.93) * amp;
    d += ` Q${f1((px + x) / 2)} ${f1(Math.min(py, y) - amp * 0.5)} ${f1(x)} ${f1(y)}`;
    py = y;
  }
  return `${d} L${f1(bd.x + bd.w)} ${gy + depth} Z`;
};

/** 缓起伏的横向线（车辙 / 沙纹 / 水线）；返回开放 path */
export const wavy = (bd: Band, y: number, amp: number, sd: number, step = 150) => {
  const n = Math.max(2, Math.ceil(bd.w / step));
  let d = `M${f1(bd.x)} ${f1(y)}`;
  for (let i = 1; i <= n; i++) {
    const x = bd.x + (bd.w * i) / n;
    const px = bd.x + (bd.w * (i - 1)) / n;
    const yy = y + (rnd(sd + i * 1.7) - 0.5) * amp;
    d += ` Q${f1((px + x) / 2)} ${f1(yy + (rnd(sd + i * 3.1) - 0.5) * amp)} ${f1(x)} ${f1(yy)}`;
  }
  return d;
};

// ─── 立式道具 ────────────────────────────────────────────────────────────

/** 雪人（雪地的「一眼可辨」道具）：三球 + 树枝手臂 + 围巾 + 胡萝卜鼻 + 礼帽 */
export const Snowman: React.FC<{x: number; s: number; gy?: number}> = ({x, s, gy = GROUND_Y}) => (
  <g transform={`translate(${f1(x)} ${gy}) scale(${s.toFixed(2)})`}>
    <ellipse cy={1.5} rx={21} ry={4} fill={TERRA.snow.dk} opacity={0.55} />
    <circle cy={-15} r={16} fill={NIO.white} stroke={TERRA.snow.dk} strokeWidth={1.5} />
    <circle cy={-38} r={11.5} fill={NIO.white} stroke={TERRA.snow.dk} strokeWidth={1.5} />
    <circle cy={-56} r={8.6} fill={NIO.white} stroke={TERRA.snow.dk} strokeWidth={1.5} />
    <path d="M-11 -40 L-26 -50 M-19.5 -45.5 L-27 -44.5 M-21.5 -46.8 L-24.5 -53"
      stroke={TERRA.mud.dk} strokeWidth={1.8} fill="none" strokeLinecap="round" />
    <path d="M11 -40 L27 -49 M20 -44.5 L28 -43.5 M22 -45.8 L25.5 -52"
      stroke={TERRA.mud.dk} strokeWidth={1.8} fill="none" strokeLinecap="round" />
    <path d="M-9.5 -47.5 q9.5 4.5 19 0 l0 4.6 q-9.5 4.5 -19 0 Z" fill={NIO.accentDim} />
    <path d="M6.5 -44 l4.6 12.5 l-4.2 1.2 l-3.4 -12.6 Z" fill={NIO.accentDim} />
    <path d="M2 -56.5 L14.5 -54.6 L2 -52.6 Z" fill={NIO.warn} />
    <circle cx={-2.6} cy={-58.6} r={1.5} fill={NIO.ink2} />
    <circle cx={3.4} cy={-58.9} r={1.5} fill={NIO.ink2} />
    <path d="M-3.4 -50.6 q4.2 2.6 8 -0.4" stroke={NIO.ink2} strokeWidth={1.1}
      fill="none" strokeLinecap="round" />
    <circle cy={-19} r={1.7} fill={NIO.ink3} />
    <circle cy={-12} r={1.7} fill={NIO.ink3} />
    <path d="M-10.5 -63 L10.5 -63 L9 -65.6 L-9 -65.6 Z" fill={NIO.ink2} />
    <rect x={-6.4} y={-74} width={12.8} height={9} rx={1.6} fill={NIO.ink2} />
  </g>
);

/** 带雪冠的松树（雪地）：三层树冠，每层顶部压一块白色雪盖 */
export const Pine: React.FC<{x: number; h: number; gy?: number}> = ({x, h, gy = GROUND_Y}) => {
  const w = h * 0.44;
  return (
    <g transform={`translate(${f1(x)} ${gy})`}>
      <ellipse cy={1.5} rx={w * 0.5} ry={3.5} fill={TERRA.snow.dk} opacity={0.5} />
      <rect x={-w * 0.06} y={-h * 0.13} width={w * 0.12} height={h * 0.13} fill={TERRA.mud.dk} />
      {[0, 1, 2].map((k) => {
        const yb = -h * (0.1 + k * 0.26);
        const ww = (w / 2) * (1 - k * 0.25);
        const ht = h * 0.38;
        return (
          <g key={k}>
            <path d={`M0 ${f1(yb - ht)} L${f1(ww)} ${f1(yb)} L${f1(-ww)} ${f1(yb)} Z`} fill={NIO.ink3} />
            <path
              d={`M0 ${f1(yb - ht)} L${f1(ww * 0.52)} ${f1(yb - ht * 0.46)} q${f1(-ww * 0.52)} ${f1(ht * 0.2)} ${f1(-ww * 1.04)} 0 Z`}
              fill={NIO.white}
              opacity={0.94}
            />
          </g>
        );
      })}
    </g>
  );
};

/** 仙人掌（沙地）：主干 + 两条不等高侧臂；fx=-1 可水平镜像换姿态 */
export const Cactus: React.FC<{x: number; h: number; fx?: number; gy?: number}> = ({
  x, h, fx = 1, gy = GROUND_Y,
}) => (
  <g transform={`translate(${f1(x)} ${gy}) scale(${fx} 1)`}>
    <ellipse cy={1.5} rx={17} ry={3.5} fill={TERRA.sand.dk} opacity={0.6} />
    <path d={`M0 0 L0 ${f1(-h)}`} stroke={NIO.ink3} strokeWidth={15} strokeLinecap="round" fill="none" />
    <path d={`M-2 ${f1(-h * 0.46)} L-19 ${f1(-h * 0.46)} L-19 ${f1(-h * 0.74)}`}
      stroke={NIO.ink3} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d={`M2 ${f1(-h * 0.62)} L20 ${f1(-h * 0.62)} L20 ${f1(-h * 0.88)}`}
      stroke={NIO.ink3} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d={`M0 ${f1(-h * 0.08)} L0 ${f1(-h * 0.93)}`} stroke={NIO.ink4}
      strokeWidth={1.4} opacity={0.6} fill="none" />
  </g>
);

/** 枯木（沙地的第二种道具，和仙人掌交替出现避免重复感） */
export const DeadWood: React.FC<{x: number; gy?: number}> = ({x, gy = GROUND_Y}) => (
  <g transform={`translate(${f1(x)} ${gy})`}>
    <path d="M-20 0 L2 -24 M2 -24 L15 -37 M2 -24 L-9 -36 M-9 -36 L-18 -43 M15 -37 L24 -42"
      stroke={TERRA.mud.dk} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.85} />
    <ellipse cy={1} rx={16} ry={3} fill={TERRA.sand.dk} opacity={0.55} />
  </g>
);

/** 干草簇（沙地的低矮填充） */
export const DryGrass: React.FC<{x: number; sd: number; gy?: number}> = ({x, sd, gy = GROUND_Y}) => (
  <g transform={`translate(${f1(x)} ${gy})`}>
    {[0, 1, 2, 3, 4].map((j) => (
      <path
        key={j}
        d={`M${f1((j - 2) * 4)} 0 q${f1((rnd(sd + j) - 0.5) * 10)} ${f1(-9 - rnd(sd + j * 3) * 8)} ${f1((rnd(sd + j * 2) - 0.5) * 22)} ${f1(-16 - rnd(sd + j) * 12)}`}
        stroke={NIO.ink4} strokeWidth={1.5} fill="none" strokeLinecap="round"
      />
    ))}
  </g>
);

/** 芦苇（湿地）：弯茎 + 叶片 + 蒲棒 */
export const Reeds: React.FC<{x: number; h: number; sd: number; gy?: number}> = ({
  x, h, sd, gy = GROUND_Y,
}) => (
  <g transform={`translate(${f1(x)} ${gy})`}>
    <ellipse cy={1.5} rx={26} ry={4} fill={TERRA.wet.dk} opacity={0.55} />
    {[0, 1, 2, 3, 4, 5].map((j) => {
      const o = (rnd(sd + j * 2.3) - 0.5) * 34;
      const hh = h * (0.62 + rnd(sd + j * 4.1) * 0.55);
      const bd2 = (rnd(sd + j * 6.7) - 0.5) * 26;
      return (
        <g key={j}>
          <path d={`M${f1(o)} 0 Q${f1(o + bd2 * 0.4)} ${f1(-hh * 0.6)} ${f1(o + bd2)} ${f1(-hh)}`}
            stroke={NIO.ink3} strokeWidth={2.4} fill="none" strokeLinecap="round" />
          <path d={`M${f1(o + bd2 * 0.25)} ${f1(-hh * 0.4)} q${f1(9 + bd2 * 0.3)} ${f1(-hh * 0.18)} ${f1(13 + bd2 * 0.4)} ${f1(-hh * 0.5)}`}
            stroke={NIO.ink3} strokeWidth={1.6} fill="none" strokeLinecap="round" opacity={0.8} />
          {j % 2 === 0 && <ellipse cx={o + bd2} cy={-hh - 8} rx={3.4} ry={9.5} fill={TERRA.mud.dk} />}
        </g>
      );
    })}
  </g>
);

/** 单块石头（碎石）：6 边不规则多边形 + 一块高光面 */
export const Stone: React.FC<{x: number; y: number; r: number; sd: number}> = ({x, y, r, sd}) => {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const th = (i / 6) * Math.PI * 2 + rnd(sd + i) * 0.55;
    const rr = r * (0.72 + rnd(sd + i * 2.2) * 0.5);
    pts.push(`${(x + Math.cos(th) * rr).toFixed(1)} ${(y + Math.sin(th) * rr * 0.84).toFixed(1)}`);
  }
  return (
    <g>
      <path d={`M${pts.join(' L')} Z`} fill={TERRA.gravel.dk} stroke={NIO.ink3}
        strokeWidth={0.9} strokeLinejoin="round" />
      <ellipse cx={x - r * 0.24} cy={y - r * 0.3} rx={r * 0.42} ry={r * 0.2}
        fill={NIO.white} opacity={0.45} />
    </g>
  );
};

/** 路肩碎石堆（地面线以上的隆起，9 块石头堆成小丘） */
export const StonePile: React.FC<{x: number; sd: number; gy?: number}> = ({x, sd, gy = GROUND_Y}) => (
  <g>
    {Array.from({length: 9}, (_, j) => {
      const a = rnd(sd + j * 3.7);
      const b = rnd(sd + j * 5.3);
      const px = x + (a - 0.5) * 52;
      const py = gy - 3 - (1 - Math.abs(px - x) / 30) * (11 + b * 14);
      return <Stone key={j} x={px} y={py} r={4 + b * 5.5} sd={sd + j * 2.3} />;
    })}
  </g>
);

/** 雪丘小堆（雪地的低矮填充，配合 Pine 用） */
export const SnowMound: React.FC<{x: number; w: number; h: number; gy?: number}> = ({
  x, w, h, gy = GROUND_Y,
}) => (
  <path d={`M${f1(x)} ${gy} q${f1(w * 0.34)} ${f1(-h)} ${f1(w)} 0 Z`}
    fill={NIO.white} stroke={TERRA.snow.dk} strokeWidth={1.2} />
);

// ─── 地面底纹 pattern（塞进 <defs>；band 的 fill 用 url(#pat-xxx)） ───────
export const TerrainPatterns: React.FC<{gy?: number}> = ({gy = GROUND_Y}) => (
  <>
    <pattern id="pat-asphalt" patternUnits="userSpaceOnUse" width={140} height={140} y={gy}>
      <rect fill={TERRA.asphalt.dk} x={10} y={34} width={46} height={3} rx={1.5} />
      <rect fill={TERRA.asphalt.dk} x={86} y={78} width={38} height={3} rx={1.5} />
      <rect fill={TERRA.asphalt.dk} x={34} y={112} width={30} height={3} rx={1.5} />
    </pattern>
    <pattern id="pat-mud" patternUnits="userSpaceOnUse" width={140} height={140} y={gy}>
      <ellipse fill={TERRA.mud.dk} cx={36} cy={38} rx={16} ry={7} />
      <ellipse fill={TERRA.mud.dk} cx={104} cy={70} rx={20} ry={8} />
      <ellipse fill={TERRA.mud.dk} cx={56} cy={110} rx={13} ry={6} />
      <path stroke={TERRA.mud.dk} fill="none" strokeWidth={2} d="M8 88 q10 -6 20 0 q10 6 20 0" />
    </pattern>
    <pattern id="pat-sand" patternUnits="userSpaceOnUse" width={140} height={140} y={gy}>
      <path stroke={TERRA.sand.dk} fill="none" strokeWidth={2} d="M6 44 q17 -12 34 0 q17 12 34 0" />
      <path stroke={TERRA.sand.dk} fill="none" strokeWidth={2} d="M66 100 q17 -12 34 0 q17 12 34 0" />
      <circle fill={TERRA.sand.dk} cx={112} cy={36} r={3} />
      <circle fill={TERRA.sand.dk} cx={30} cy={116} r={3} />
    </pattern>
    <pattern id="pat-snow" patternUnits="userSpaceOnUse" width={140} height={140} y={gy}>
      <circle fill={TERRA.snow.dk} cx={30} cy={40} r={4} />
      <circle fill={TERRA.snow.dk} cx={96} cy={66} r={3} />
      <circle fill={TERRA.snow.dk} cx={58} cy={108} r={4} />
      <path d="M118 104 l0 -14 M111 97 l14 0 M113 92 l10 10 M123 92 l-10 10"
        stroke={TERRA.snow.dk} strokeWidth={1.8} fill="none" />
    </pattern>
    <pattern id="pat-wet" patternUnits="userSpaceOnUse" width={140} height={140} y={gy}>
      <path stroke={TERRA.wet.dk} fill="none" strokeWidth={2} d="M8 46 q12 -7 24 0 q12 7 24 0 q12 -7 24 0" />
      <path stroke={TERRA.wet.dk} fill="none" strokeWidth={2} d="M50 100 q12 -7 24 0 q12 7 24 0" />
      <rect fill={TERRA.wet.dk} x={96} y={30} width={26} height={3} rx={1.5} />
    </pattern>
    <pattern id="pat-gravel" patternUnits="userSpaceOnUse" width={140} height={140} y={gy}>
      <circle fill={TERRA.gravel.dk} cx={24} cy={42} r={6} />
      <circle fill={TERRA.gravel.dk} cx={52} cy={36} r={4} />
      <circle fill={TERRA.gravel.dk} cx={92} cy={60} r={7} />
      <circle fill={TERRA.gravel.dk} cx={120} cy={44} r={4} />
      <circle fill={TERRA.gravel.dk} cx={40} cy={102} r={6} />
      <circle fill={TERRA.gravel.dk} cx={78} cy={114} r={5} />
      <circle fill={TERRA.gravel.dk} cx={116} cy={98} r={6} />
    </pattern>
  </>
);

// ─── 整条地形带的道具组装 ────────────────────────────────────────────────
type DecorProps = {
  bd: Band;
  sd: number;
  /** 地面滚动位移，用于 behindCar 判定 */
  dx?: number;
  /** 秒（涟漪等循环动画用） */
  t?: number;
  gy?: number;
  /** 主体遮挡淡出函数；不传则道具不淡出 */
  behind?: (x: number, dx: number) => number;
};

const one = () => 1;

export const SnowDecor: React.FC<DecorProps> = ({bd, sd, dx = 0, gy = GROUND_Y, behind = one}) => {
  const edge = crest(bd, 15, sd, 92, 140, gy);
  return (
    <g>
      <path d={edge} fill={NIO.white} opacity={0.9} />
      <path d={edge} fill="none" stroke={TERRA.snow.dk} strokeWidth={1.3} opacity={0.7} />
      <path d={wavy(bd, gy + 85, 12, sd + 5)} fill="none" stroke={TERRA.snow.dk}
        strokeWidth={2.4} opacity={0.55} strokeDasharray="26 34" />
      {spots(bd, 165, sd + 40).map((p) => {
        const k = (p.i + 1) % 3;
        if (k === 1) {
          return <g key={p.i} opacity={behind(p.x, dx)}><Snowman x={p.x} s={1.24 + p.b * 0.34} gy={gy} /></g>;
        }
        if (k === 2) {
          return <g key={p.i} opacity={behind(p.x, dx)}><Pine x={p.x} h={112 + p.b * 56} gy={gy} /></g>;
        }
        return (
          <g key={p.i} opacity={behind(p.x, dx)}>
            <Pine x={p.x - 22} h={64 + p.c * 30} gy={gy} />
            <SnowMound x={p.x + 18} w={24 + p.c * 12} h={13 + p.b * 8} gy={gy} />
          </g>
        );
      })}
    </g>
  );
};

export const MudDecor: React.FC<DecorProps> = ({bd, sd, gy = GROUND_Y}) => (
  <g>
    {/* 两道深陷车辙（虚线 = 胎纹） */}
    {[{y: gy + 32, w: 10}, {y: gy + 92, w: 12}].map((r, i) => (
      <g key={i}>
        <path d={wavy(bd, r.y, 9, sd + i * 3)} fill="none" stroke={TERRA.mud.dk}
          strokeWidth={r.w + 8} opacity={0.55} strokeLinecap="round" />
        <path d={wavy(bd, r.y, 9, sd + i * 3)} fill="none" stroke={NIO.ink2}
          strokeWidth={r.w} opacity={0.3} strokeDasharray="7 12" />
      </g>
    ))}
    {spots(bd, 132, sd + 60).map((p) => {
      const py = gy + 20 + p.c * 96;
      return (
        <g key={p.i}>
          <ellipse cx={p.x} cy={py} rx={22 + p.b * 12} ry={7 + p.b * 3} fill={NIO.ink2} opacity={0.44} />
          <ellipse cx={p.x + 15} cy={py + 3} rx={13} ry={5} fill={NIO.ink2} opacity={0.44} />
          <ellipse cx={p.x - 13} cy={py - 2.5} rx={11} ry={4.5} fill={NIO.ink2} opacity={0.44} />
          <ellipse cx={p.x - 5} cy={py - 2.5} rx={10 + p.b * 4} ry={1.8} fill={NIO.white} opacity={0.3} />
          {[0, 1, 2, 3, 4].map((j) => (
            <circle key={j}
              cx={p.x + (rnd(sd + p.i * 9 + j) - 0.5) * 84}
              cy={py - 14 - rnd(sd + p.i * 5 + j * 2) * 20}
              r={1.4 + rnd(sd + p.i * 3 + j) * 2.2}
              fill={TERRA.mud.dk} opacity={0.85} />
          ))}
          {/* 泥埂（地面线以上的隆起） */}
          <path d={`M${f1(p.x - 34)} ${gy} q10 ${f1(-8 - p.b * 6)} 24 0 Z`} fill={TERRA.mud.dk} />
        </g>
      );
    })}
  </g>
);

export const SandDecor: React.FC<DecorProps> = ({bd, sd, dx = 0, gy = GROUND_Y, behind = one}) => (
  <g>
    {/* 远近两层沙丘轮廓 */}
    <path d={crest(bd, 52, sd + 11, 210, 30, gy)} fill={TERRA.sand.dk} opacity={0.28} />
    <path d={crest(bd, 27, sd + 29, 150, 34, gy)} fill={TERRA.sand.dk} opacity={0.45} />
    <path d={crest(bd, 27, sd + 29, 150, 34, gy)} fill="none" stroke={TERRA.sand.dk}
      strokeWidth={1.4} opacity={0.8} />
    {[36, 76, 114].map((dy, i) => (
      <path key={i} d={wavy(bd, gy + dy, 16, sd + i * 7, 120)} fill="none"
        stroke={TERRA.sand.dk} strokeWidth={1.8} opacity={0.6} />
    ))}
    {spots(bd, 195, sd + 80).map((p) => {
      const k = p.i % 3;
      if (k === 0) {
        return (
          <g key={p.i} opacity={behind(p.x, dx)}>
            <Cactus x={p.x} h={92 + p.b * 40} fx={p.c > 0.5 ? 1 : -1} gy={gy} />
          </g>
        );
      }
      if (k === 1) {
        return <g key={p.i} opacity={behind(p.x, dx)}><DeadWood x={p.x} gy={gy} /></g>;
      }
      return <DryGrass key={p.i} x={p.x} sd={sd + p.i} gy={gy} />;
    })}
  </g>
);

export const WetDecor: React.FC<DecorProps> = ({bd, sd, dx = 0, t = 0, gy = GROUND_Y, behind = one}) => (
  <g>
    <rect x={bd.x} y={gy} width={bd.w} height={30} fill={NIO.white} opacity={0.2} />
    <path d={wavy(bd, gy + 50, 10, sd + 4)} fill="none" stroke={NIO.white} strokeWidth={2.6} opacity={0.45} />
    <path d={wavy(bd, gy + 112, 10, sd + 9)} fill="none" stroke={NIO.white} strokeWidth={2.2} opacity={0.35} />
    {spots(bd, 180, sd + 100).map((p) => {
      const py = gy + 28 + p.c * 88;
      const rx = 30 + p.b * 20;
      return (
        <g key={p.i}>
          <ellipse cx={p.x} cy={py} rx={rx} ry={rx * 0.3} fill={TERRA.wet.dk} opacity={0.7} />
          <ellipse cx={p.x} cy={py} rx={rx - 4} ry={rx * 0.3 - 3} fill={NIO.white} opacity={0.42} />
          <path d={`M${f1(p.x - rx * 0.6)} ${f1(py - 2)} L${f1(p.x + rx * 0.2)} ${f1(py - 2)}`}
            stroke={NIO.white} strokeWidth={1.8} opacity={0.85} />
          <path d={`M${f1(p.x - rx * 0.3)} ${f1(py + 4)} L${f1(p.x + rx * 0.5)} ${f1(py + 4)}`}
            stroke={NIO.white} strokeWidth={1.4} opacity={0.6} />
          {/* 扩散涟漪圈（运动层） */}
          {[0, 1, 2].map((j) => {
            const k = frac(t / 2.1 + j / 3 + p.a);
            return (
              <ellipse key={j} cx={p.x} cy={py}
                rx={5 + k * (rx - 6)} ry={(5 + k * (rx - 6)) * 0.3}
                fill="none" stroke={NIO.white} strokeWidth={2} opacity={0.9 * (1 - k)} />
            );
          })}
        </g>
      );
    })}
    {spots(bd, 148, sd + 140).map((p) => (
      <g key={p.i} opacity={behind(p.x, dx)}>
        <Reeds x={p.x} h={78 + p.b * 46} sd={sd + p.i * 13} gy={gy} />
      </g>
    ))}
  </g>
);

export const GravelDecor: React.FC<DecorProps> = ({bd, sd, dx = 0, gy = GROUND_Y, behind = one}) => (
  <g>
    <path d={crest(bd, 11, sd + 3, 70, 26, gy)} fill={TERRA.gravel.dk} opacity={0.5} />
    {spots(bd, 150, sd + 170).map((p) => (
      <g key={p.i}>
        {p.i % 2 === 0 && (
          <g opacity={behind(p.x, dx)}>
            <StonePile x={p.x} sd={sd + p.i * 13} gy={gy} />
          </g>
        )}
        {Array.from({length: 5}, (_, j) => (
          <Stone key={`s${j}`}
            x={p.x + (rnd(sd + p.i * 4 + j * 2.1) - 0.5) * 130}
            y={gy + 14 + rnd(sd + p.i * 6 + j * 3.3) * 110}
            r={3.5 + rnd(sd + p.i * 8 + j) * 8}
            sd={sd + p.i * 17 + j * 5.1} />
        ))}
      </g>
    ))}
  </g>
);

/** 柏油：对照组，只有车道标线 */
export const AsphaltDecor: React.FC<DecorProps> = ({bd, gy = GROUND_Y}) => (
  <g>
    <path d={`M${bd.x} ${gy + 14} L${bd.x + bd.w} ${gy + 14}`} stroke={NIO.white} strokeWidth={3} opacity={0.5} />
    <path d={`M${bd.x} ${gy + 72} L${bd.x + bd.w} ${gy + 72}`} stroke={NIO.white} strokeWidth={5.5}
      opacity={0.8} strokeDasharray="60 46" />
    <path d={`M${bd.x} ${gy + 128} L${bd.x + bd.w} ${gy + 128}`} stroke={NIO.white} strokeWidth={3} opacity={0.4} />
  </g>
);

/** 按地形分发；sd 建议用 `bandIndex * 97 + 13` 保证各带互不相同又稳定 */
export const BandDecor: React.FC<DecorProps> = (p) => {
  switch (p.bd.terr) {
    case 'snow': return <SnowDecor {...p} />;
    case 'mud': return <MudDecor {...p} />;
    case 'sand': return <SandDecor {...p} />;
    case 'wet': return <WetDecor {...p} />;
    case 'gravel': return <GravelDecor {...p} />;
    default: return <AsphaltDecor {...p} />;
  }
};

// ─── 空中层（不随地形滚动，独立循环，纯 t 的函数） ───────────────────────

/** 飘雪：小颗粒画圆点，大颗粒（c>0.62）画六角雪花并自转 */
export const Snowfall: React.FC<{
  t: number; op: number; n: number; sd: number; big?: boolean; width?: number; height?: number;
}> = ({t, op, n, sd, big = false, width = 1000, height = 560}) => {
  if (op <= 0.01) return null;
  return (
    <g>
      {Array.from({length: n}, (_, i) => {
        const a = rnd(sd + i * 1.7);
        const b = rnd(sd + i * 2.9 + 5.1);
        const c = rnd(sd + i * 4.1 + 9.7);
        const per = 4.2 + b * 4.6;
        const k = frac(t / per + c);
        const y = -30 + k * (height + 70);
        const x = a * (width + 50) - 25 + Math.sin(t * (0.7 + b * 0.8) + i) * (7 + c * 13);
        const r = (big ? 2.2 : 1.4) + c * (big ? 2.6 : 1.6);
        const o = op * (0.4 + b * 0.5);
        if (big && c > 0.62) {
          return (
            <g key={i}
              transform={`translate(${f1(x)} ${f1(y)}) rotate(${((t * 46 + i * 27) % 360).toFixed(1)})`}
              opacity={o}>
              <path
                d={`M0 ${f1(-r * 1.7)} L0 ${f1(r * 1.7)} M${f1(-r * 1.47)} ${f1(-r * 0.85)} L${f1(r * 1.47)} ${f1(r * 0.85)} M${f1(-r * 1.47)} ${f1(r * 0.85)} L${f1(r * 1.47)} ${f1(-r * 0.85)}`}
                stroke={SNOWFLAKE_STROKE} strokeWidth={1.2} strokeLinecap="round" />
            </g>
          );
        }
        return (
          <circle key={i} cx={x} cy={y} r={r} fill={NIO.white} stroke={SNOW_STROKE}
            strokeWidth={0.7} opacity={o} />
        );
      })}
    </g>
  );
};

/** 扬沙：短划线从右向左掠过（沙地的运动层） */
export const SandWind: React.FC<{t: number; op: number; width?: number; gy?: number}> = ({
  t, op, width = 1000, gy = GROUND_Y,
}) => {
  if (op <= 0.01) return null;
  return (
    <g>
      {Array.from({length: 24}, (_, i) => {
        const a = rnd(i * 3.3 + 2.2);
        const b = rnd(i * 5.7 + 7.9);
        const c = rnd(i * 2.1 + 13.3);
        const per = 1.5 + b * 1.7;
        const k = frac(t / per + c);
        const x = width + 50 - k * (width + 110);
        const y = gy - 124 + a * 148 + Math.sin(t * 2.3 + i) * (3 + c * 9);
        const len = 16 + c * 30;
        return (
          <path key={i} d={`M${f1(x)} ${f1(y)} l${len.toFixed(0)} ${f1(-2 + c * 4)}`}
            stroke={TERRA.sand.dk} strokeWidth={1.3 + c} strokeLinecap="round"
            opacity={op * (0.3 + b * 0.45)} />
        );
      })}
    </g>
  );
};
