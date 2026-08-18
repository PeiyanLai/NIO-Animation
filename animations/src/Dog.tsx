// 侧视中大型犬（金毛/拉布拉多一类）· 矢量组件
//
// 局部坐标系（调用方只做 translate + rotate，本组件内部自己按 h 缩放）：
//   原点 = 前后掌中点、地面高度；四足踩在 y = 0
//   鼻尖朝 +x，身体向 −x 延伸
//   肩胛 (+0.30·body, −1.00h)；髋 (−0.32·body, −0.95h)，body = h·DOG_BODY_RATIO
//   横向占位 x ∈ [−0.62·body, +0.68·body]；站立最高点 ≈ −1.18h
//
// 所有几何都写成「h 的比例」（下文一律称 u 单位，1u = 1h），最外层用 scale(h) 落到舞台 px。
// 纯函数：只依赖 (t, pose, h, senior)，无 Math.random / Date。

import React from 'react';
import {T_COLORS, TERRA, clamp01, frac} from './data';

/** 体长 / 肩高 = 950 / 570 */
export const DOG_BODY_RATIO = 1.667;

export type DogPose = 'stand' | 'walk' | 'sit' | 'lie' | 'crouch' | 'lookup';
/** 前左 / 前右 / 后左 / 后右。左 = 近侧（画得浅），右 = 远侧（画得深） */
export type Leg = 'FL' | 'FR' | 'HL' | 'HR';

type P = readonly [number, number];

/* ═══ 小工具（全部纯函数）═══════════════════════════════════════════════ */

const F = (v: number) => (Math.round(v * 1e4) / 1e4).toString();
const pt = (p: P) => `${F(p[0])},${F(p[1])}`;
const dist = (a: P, b: P) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const lerpP = (a: P, b: P, k: number): P => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
const smooth = (k: number) => {const c = clamp01(k); return c * c * (3 - 2 * c);};

const rotP = (p: P, deg: number): P => {
  const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
};
const xform = (p: P, org: P, deg: number): P => {
  const q = rotP(p, deg);
  return [org[0] + q[0], org[1] + q[1]];
};

const hex2 = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a: string, b: string, k: number) => {
  const A = hex2(a), B = hex2(b);
  const c = (i: number) => Math.round(A[i] + (B[i] - A[i]) * k).toString(16).padStart(2, '0');
  return `#${c(0)}${c(1)}${c(2)}`;
};

/** Catmull-Rom → 三次贝塞尔段列表。闭合时最后一段是「收口边」，描边时丢掉它即可 */
const crSegs = (pts: P[], closed: boolean, tension = 0.17): string[] => {
  const n = pts.length;
  const get = (i: number) => (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const out: string[] = [];
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const b1: P = [p1[0] + (p2[0] - p0[0]) * tension, p1[1] + (p2[1] - p0[1]) * tension];
    const b2: P = [p2[0] - (p3[0] - p1[0]) * tension, p2[1] - (p3[1] - p1[1]) * tension];
    out.push(`C${pt(b1)} ${pt(b2)} ${pt(p2)}`);
  }
  return out;
};
const closedPath = (pts: P[]) => `M${pt(pts[0])}${crSegs(pts, true).join('')}Z`;
/** 同一条曲线，但跳过收口边（用于「填充闭合、描边开口」的接缝隐藏） */
const openStroke = (pts: P[]) => `M${pt(pts[0])}${crSegs(pts, true).slice(0, pts.length - 1).join('')}`;
const polyPath = (pts: P[]) => `M${pt(pts[0])}${crSegs(pts, false).join('')}`;

/** 沿中心线采样（含每点宽度） */
const sampleW = (pts: P[], ws: number[], perSeg: number) => {
  const n = pts.length;
  const g = (i: number) => pts[Math.max(0, Math.min(n - 1, i))];
  const out: {p: P; w: number}[] = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    const steps = i === n - 2 ? perSeg + 1 : perSeg;
    for (let s = 0; s < steps; s++) {
      const u = s / perSeg, u2 = u * u, u3 = u2 * u;
      const c = (k: 0 | 1) =>
        0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 +
          (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3);
      out.push({p: [c(0), c(1)], w: ws[i] + (ws[i + 1] - ws[i]) * u});
    }
  }
  return out;
};

/** 变宽度骨条 → 闭合轮廓。腿、尾都用它，关节处自然出现折点。capE=末端圆头程度 */
const taperPoly = (pts: P[], ws: number[], perSeg = 6, capEK = 1.33): string => {
  const S = sampleW(pts, ws, perSeg);
  const L: P[] = [], R: P[] = [], T: P[] = [];
  for (let i = 0; i < S.length; i++) {
    const a = S[Math.max(0, i - 1)].p, b = S[Math.min(S.length - 1, i + 1)].p;
    const m = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const tx = (b[0] - a[0]) / m, ty = (b[1] - a[1]) / m, hw = S[i].w / 2;
    T.push([tx, ty]);
    L.push([S[i].p[0] - ty * hw, S[i].p[1] + tx * hw]);
    R.push([S[i].p[0] + ty * hw, S[i].p[1] - tx * hw]);
  }
  const e = S.length - 1, k = 1.33;
  const capE = (p: P, t: P, hw: number): P => [p[0] + t[0] * hw * capEK, p[1] + t[1] * hw * capEK];
  const capS = (p: P, t: P, hw: number): P => [p[0] - t[0] * hw * k, p[1] - t[1] * hw * k];
  let d = `M${L.map(pt).join('L')}`;
  d += `C${pt(capE(L[e], T[e], S[e].w / 2))} ${pt(capE(R[e], T[e], S[e].w / 2))} ${pt(R[e])}`;
  d += `L${R.slice().reverse().map(pt).join('L')}`;
  d += `C${pt(capS(R[0], T[0], S[0].w / 2))} ${pt(capS(L[0], T[0], S[0].w / 2))} ${pt(L[0])}Z`;
  return d;
};

/** 两骨 IK：根 a、末端 c，骨长 l1/l2，bend=+1 关节偏向法线正向 */
const ik2 = (a: P, c: P, l1: number, l2: number, bend: 1 | -1): P => {
  let d = dist(a, c);
  const dmax = (l1 + l2) * 0.998, dmin = Math.abs(l1 - l2) * 1.02 + 1e-4;
  d = Math.max(dmin, Math.min(dmax, d));
  const ux = (c[0] - a[0]) / (dist(a, c) || 1), uy = (c[1] - a[1]) / (dist(a, c) || 1);
  const t = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const hgt = Math.sqrt(Math.max(0, l1 * l1 - t * t));
  return [a[0] + ux * t - uy * hgt * bend, a[1] + uy * t + ux * hgt * bend];
};

/* ═══ 配色（NIO 浅色体系 + TERRA 环境色）═════════════════════════════════ */

// 真实动物是**反荫蔽**（countershading）：背深、腹浅。早先画成「腹部一条深带」正好画反，
// 加上肩/髋/肋三条结构描边像装甲拼缝、远侧腿黑得像金属肢——「机械狗」的观感就是这么来的。
// 取不到实拍参考（外网 egress 403），比例按拉布拉多公开体型数据：体长/肩高≈1.67、
// 胸深≈0.5h、垂耳长≈头长 0.6。
const FUR = {
  base: TERRA.sand.base,                                  // #E3CE9C 主体暖米
  lit: mix(TERRA.sand.base, T_COLORS.panel, 0.24),        // 近侧腿 / 高光
  cream: mix(TERRA.sand.base, T_COLORS.panel, 0.52),      // 胸腹奶油色（反荫蔽：下浅）
  saddle: mix(TERRA.sand.base, TERRA.sand.dk, 0.60),      // 背鞍（反荫蔽：上深）
  mid: TERRA.sand.dk,                                     // #C4A96E 结构暗部
  dk: mix(TERRA.sand.dk, TERRA.mud.dk, 0.22),             // 远侧腿（0.45 太黑，像金属肢）
  dpr: mix(TERRA.sand.dk, TERRA.mud.dk, 0.40),            // 远耳
  ear: mix(TERRA.sand.dk, TERRA.mud.base, 0.30),          // 近侧垂耳
  gray: mix(TERRA.sand.base, T_COLORS.panel, 0.62),       // 老年犬花白口鼻
  line: T_COLORS.ink2,                                    // 轮廓线
};
const LW = 0.024;   // 主轮廓线宽（u）
const LW2 = 0.016;  // 结构线宽

/* ═══ 步态（trot：左前+右后 / 右前+左后 同相）═══════════════════════════ */

export const DOG_GAIT = {
  cycle: 0.62,        // 一个步态周期（秒）
  cycleSenior: 0.82,  // 老年犬（步频慢约 30%）
  duty: 0.62,         // 支撑相占比 —— >0.5 保证任一时刻至少 2 条腿着地
  strideFore: 0.30,   // 前肢步幅（u = ×h）
  strideHind: 0.34,   // 后肢步幅
  liftFore: 0.155,    // 摆动相最大抬掌高度（u）
  liftHind: 0.175,
  bob: 0.015,         // 身体上下起伏幅度（u，即 ±1.5%h）
} as const;

const LEG_PHASE: Record<Leg, number> = {FL: 0, HR: 0, FR: 0.5, HL: 0.5};

export const gaitCycle = (senior = false) => (senior ? DOG_GAIT.cycleSenior : DOG_GAIT.cycle);

/** 该腿在步态周期内的相位 ∈ [0,1) */
export const legPhase = (leg: Leg, t: number, senior = false) =>
  frac(t / gaitCycle(senior) + LEG_PHASE[leg]);

/** 摆动相抬起量 ∈ [0,1]；支撑相恒为 0 */
export const pawLift01 = (leg: Leg, t: number, senior = false) => {
  const ph = legPhase(leg, t, senior);
  if (ph < DOG_GAIT.duty) return 0;
  return Math.sin(Math.PI * ((ph - DOG_GAIT.duty) / (1 - DOG_GAIT.duty)));
};

/**
 * walk 步态下该腿掌心的 y（舞台 px，局部坐标；0 = 贴地，负 = 离地）。
 * 支撑相严格返回 0 —— 断言「至少 2 条腿 |pawY| < 0.02h」由 duty = 0.62 保证。
 */
export const pawY = (leg: Leg, t: number, h: number, senior = false): number =>
  -pawLift01(leg, t, senior) * (leg[0] === 'F' ? DOG_GAIT.liftFore : DOG_GAIT.liftHind) * h;

/** walk 步态下该腿掌心相对站立位的前后位移（舞台 px，+x = 向前） */
export const pawDX = (leg: Leg, t: number, h: number, senior = false): number => {
  const ph = legPhase(leg, t, senior);
  const S = leg[0] === 'F' ? DOG_GAIT.strideFore : DOG_GAIT.strideHind;
  if (ph < DOG_GAIT.duty) return S * (0.5 - ph / DOG_GAIT.duty) * h;           // 支撑相：随地面后移
  const u = (ph - DOG_GAIT.duty) / (1 - DOG_GAIT.duty);
  return S * (-0.5 + smooth(u)) * h;                                            // 摆动相：前摆回位
};

/** walk 时躯干的上下起伏（舞台 px，+ = 下沉），幅度 ±1.5%h */
export const bodyBob = (t: number, h: number, senior = false): number =>
  -DOG_GAIT.bob * h * Math.cos(4 * Math.PI * (frac(t / gaitCycle(senior)) - 0.06));

/* ═══ 骨骼（u 单位）═════════════════════════════════════════════════════ */

const FORE_ROOT: P = [0.500, -0.980];     // 肩胛顶（= 规范锚点 +0.30body / −1.00h）
const FORE_ELB0: P = [0.403, -0.429];     // 肘（略低于胸底 → 折点可见）
const FORE_CAR0: P = [0.550, -0.100];     // 腕
const FORE_PAW0: P = [0.520, 0];
const FORE_L1 = dist(FORE_ROOT, FORE_ELB0);
const FORE_L2 = dist(FORE_ELB0, FORE_CAR0);
const FORE_PASTERN: P = [FORE_CAR0[0] - FORE_PAW0[0], FORE_CAR0[1] - FORE_PAW0[1]];

const HIND_ROOT: P = [-0.500, -0.800];    // 髋关节（髋顶锚点在 −0.32body / −0.95h，见轮廓）
const HIND_STI0: P = [-0.335, -0.492];    // 膝
const HIND_HOC0: P = [-0.620, -0.245];    // 跗（飞节）
const HIND_PAW0: P = [-0.520, 0];
const HIND_L1 = dist(HIND_ROOT, HIND_STI0);
const HIND_L2 = dist(HIND_STI0, HIND_HOC0);
const HIND_META: P = [HIND_HOC0[0] - HIND_PAW0[0], HIND_HOC0[1] - HIND_PAW0[1]];

const FORE_W = [0.205, 0.142, 0.100, 0.076];
const HIND_W = [0.284, 0.168, 0.108, 0.080];

/* ═══ 各 pose 的躯干轮廓（index 0 = 颈上接点，末位 = 颈下接点）════════════ */

const TORSO_STAND: P[] = [
  [0.535, -1.022],   // 0 颈上接点
  [0.492, -1.008],   // 1 鬐甲（规范锚点 +0.30body / −1.00h）
  [0.352, -0.996], [0.150, -0.976], [-0.090, -0.968], [-0.330, -0.964],
  [-0.533, -0.950],  // 6 髋顶（规范锚点 −0.32body / −0.95h）
  [-0.662, -0.892], [-0.728, -0.826], [-0.768, -0.700], [-0.756, -0.588],
  [-0.652, -0.516],  // 11 腹股沟
  [-0.386, -0.606], [-0.132, -0.578], [0.116, -0.520], [0.326, -0.474],
  [0.458, -0.482],   // 16 胸底前（胸深 0.47h，腰腹 0.60h → 收腹明显）
  [0.572, -0.566], [0.606, -0.684],
];
const STAND_UNDER: [number, number] = [11, 16];

const TORSO_SIT: P[] = [
  [0.535, -1.026], [0.492, -1.010], [0.352, -0.982], [0.178, -0.930],
  [0.005, -0.848], [-0.170, -0.740], [-0.310, -0.618], [-0.428, -0.468],
  [-0.502, -0.322], [-0.556, -0.176], [-0.560, -0.058], [-0.478, -0.010],
  [-0.300, -0.010], [-0.126, -0.086], [-0.005, -0.300], [0.148, -0.432],
  [0.292, -0.478], [0.400, -0.492], [0.470, -0.500], [0.572, -0.586],
  [0.614, -0.700],
];
const SIT_UNDER: [number, number] = [13, 18];

const TORSO_LIE: P[] = [
  [0.452, -0.606], [0.386, -0.598], [0.204, -0.590], [-0.020, -0.580],
  [-0.234, -0.570], [-0.424, -0.556], [-0.566, -0.526], [-0.686, -0.438],
  [-0.760, -0.350], [-0.806, -0.234], [-0.796, -0.122], [-0.704, -0.042],
  [-0.480, -0.020], [-0.150, -0.024], [0.160, -0.040], [0.366, -0.096],
  [0.474, -0.196], [0.542, -0.300], [0.564, -0.372],
];
const LIE_UNDER: [number, number] = [11, 16];

/** 头部局部坐标（原点 = 寰枕关节，+x = 吻向） */
const HEAD_PTS: P[] = [
  [-0.089, -0.094],  // 0 后枕（颈上接点）
  [-0.040, -0.140], [0.047, -0.158], [0.124, -0.153], [0.170, -0.134],
  [0.193, -0.105],   // 5 止部 stop（明显）
  [0.246, -0.098], [0.303, -0.092], [0.340, -0.081],
  [0.355, -0.049],   // 9 鼻尖
  [0.344, -0.010], [0.297, 0.014], [0.235, 0.022], [0.165, 0.032],
  [0.085, 0.058], [0.009, 0.081],
  [-0.052, 0.086],   // 16 喉（颈下接点）
];
// 眼必须在垂耳前缘之前：耳根 x + 耳前缘宽 0.128 要 < 眼 x，否则耳把眼盖住，脸读不出来
const EYE: P = [0.172, -0.100];
const NOSE: P = [0.326, -0.042];
const EAR_ANCHOR: P = [0.018, -0.130];

/** 垂耳（耳根为原点，+y 向下）—— 金毛/拉布拉多式中长垂耳 */
const EAR_D =
  'M-0.010,-0.006C-0.066,0.034 -0.098,0.116 -0.088,0.208C-0.078,0.290 -0.024,0.336 0.034,0.326' +
  'C0.092,0.314 0.124,0.246 0.128,0.162C0.130,0.084 0.108,0.020 0.070,-0.022Z';

/* ═══ pose → 姿态参数 ═══════════════════════════════════════════════════ */

type Rig = {
  torso: P[]; under: [number, number];
  headPos: P; headAng: number; earExtra: number;
  tail: P[]; tailWag: number;
  fore: LegSpec; hind: LegSpec;
};
/** chain 给死四点；否则用 paw + 掌/跖偏移做 IK */
type LegSpec = {root: P; chain?: P[]; paw?: P; off?: P};

/** 老年犬背线下塌（沿背中部隆起一个平滑的下沉量） */
const sagAt = (x: number) => 0.034 * Math.sin(Math.PI * clamp01((0.46 - x) / 0.86));

const buildRig = (pose: DogPose, t: number, senior: boolean): Rig => {
  const cyc = gaitCycle(senior);
  const walk = pose === 'walk';
  const ph = frac(t / cyc);
  // 呼吸：站立/仰头/坐/卧慢周期；行走时并入步态
  const brP = senior ? 4.4 : 3.4;
  const breathe = Math.sin((2 * Math.PI * t) / brP);
  const bob = walk ? -DOG_GAIT.bob * Math.cos(4 * Math.PI * (ph - 0.06)) : 0;

  // ── 躯干轮廓 ──────────────────────────────────────────────────────────
  let src: P[], under: [number, number];
  if (pose === 'sit') {src = TORSO_SIT; under = SIT_UNDER;}
  else if (pose === 'lie') {src = TORSO_LIE; under = LIE_UNDER;}
  else {src = TORSO_STAND; under = STAND_UNDER;}

  const crouch = pose === 'crouch';
  const crouchDrop = (x: number) => 0.02 + 0.16 * smooth((0.30 - x) / 0.72);

  const torso: P[] = src.map((p, i) => {
    let [x, y] = p;
    const isTop = i >= 1 && i <= 8;   // 三套轮廓的 1..8 都是背线段（鬐甲→尾根）
    // 呼吸：胸腔 ±1%（下腹侧扩张 + 背线极轻起伏）
    if (i >= under[0] && i <= under[1]) y += 0.0062 * breathe;
    if (isTop) y -= 0.0034 * breathe;
    // 老年犬：背线略塌 + 腹部略垂
    if (senior) y += isTop ? sagAt(x) : sagAt(x) * 0.28;
    // 蓄力下蹲：臀降低约 0.18h，前段仅微沉
    if (crouch) y += crouchDrop(x) * (isTop ? 1 : 0.72);
    return [x, y] as P;
  });

  // ── 头 ────────────────────────────────────────────────────────────────
  let headPos: P = [0.756, -1.028];
  let headAng = 4;
  if (pose === 'sit') {headPos = [0.734, -1.068]; headAng = -8;}
  if (pose === 'lie') {headPos = [0.668, -0.212]; headAng = 6;}
  if (crouch) {headPos = [0.770, -1.006]; headAng = 1;}
  if (pose === 'lookup') {
    const pivot: P = [0.556, -0.916];
    const rel: P = [headPos[0] - pivot[0], headPos[1] - pivot[1]];
    const r = rotP(rel, -22);
    headPos = [pivot[0] + r[0], pivot[1] + r[1]];
    headAng = 4 - 22;
  }
  if (senior && pose !== 'lie') {headPos = [headPos[0] - 0.018, headPos[1] + 0.042]; headAng += 5;}
  if (walk) {
    headPos = [headPos[0], headPos[1] + bob * 0.35];
    headAng += 2.4 * Math.sin(2 * Math.PI * ph);
  }
  if (pose === 'stand' || pose === 'lookup') headAng += 0.9 * breathe;

  // 耳朵：部分抵消头部转角（重力）+ 步态摆动
  let earExtra = -headAng * 0.55;
  if (walk) earExtra += 9 * Math.sin(2 * Math.PI * ph - 0.9);
  else earExtra += 1.6 * breathe;
  if (pose === 'lookup') earExtra += 4;

  // ── 尾 ────────────────────────────────────────────────────────────────
  let tail: P[];
  if (pose === 'sit') tail = [[-0.502, -0.322], [-0.612, -0.238], [-0.712, -0.130], [-0.778, -0.048], [-0.714, -0.018]];
  else if (pose === 'lie') tail = [[-0.760, -0.350], [-0.856, -0.256], [-0.930, -0.146], [-0.966, -0.056], [-0.912, -0.024]];
  else {
    tail = [[-0.720, -0.836], [-0.812, -0.800], [-0.898, -0.736], [-0.958, -0.648], [-0.988, -0.552]];
    if (crouch) tail = tail.map(([x, y]) => [x, y + 0.16] as P);
    if (senior) tail = tail.map(([x, y]) => [x, y + 0.03] as P);
  }
  const tailWag = walk ? 7.2 * Math.sin(2 * Math.PI * ph + 0.6)
    : pose === 'crouch' ? 3 * Math.sin(2 * Math.PI * t * 1.4)
    : 3.2 * Math.sin(2 * Math.PI * t / (senior ? 3.6 : 2.8));

  // ── 四肢 ──────────────────────────────────────────────────────────────
  let fore: LegSpec, hind: LegSpec;
  if (pose === 'lie') {
    fore = {root: FORE_ROOT, chain: [[0.402, -0.520], [0.470, -0.140], [0.734, -0.078], [0.926, -0.048]]};
    hind = {root: HIND_ROOT, chain: [[-0.530, -0.412], [-0.364, -0.180], [-0.628, -0.086], [-0.852, -0.042]]};
  } else if (pose === 'sit') {
    fore = {root: [0.500, -1.000], paw: FORE_PAW0, off: FORE_PASTERN};
    hind = {root: [-0.330, -0.410], paw: [-0.170, -0.010], off: [-0.230, -0.065]};
  } else if (crouch) {
    fore = {root: [FORE_ROOT[0], FORE_ROOT[1] + 0.03], paw: [0.600, 0], off: FORE_PASTERN};
    hind = {root: [HIND_ROOT[0], HIND_ROOT[1] + 0.18], paw: [-0.440, 0], off: [-0.135, -0.232]};
  } else {
    fore = {root: [FORE_ROOT[0], FORE_ROOT[1] + bob], paw: FORE_PAW0, off: FORE_PASTERN};
    hind = {root: [HIND_ROOT[0], HIND_ROOT[1] + bob], paw: HIND_PAW0, off: HIND_META};
  }

  return {torso, under, headPos, headAng, earExtra, tail, tailWag, fore, hind};
};

/** 解一条腿：root → j1 → j2 → paw（u 单位） */
const solveLeg = (leg: Leg, rig: Rig, pose: DogPose, t: number, senior: boolean): P[] => {
  const hindLeg = leg[0] === 'H';
  const spec = hindLeg ? rig.hind : rig.fore;
  if (spec.chain) {
    const side = leg === 'FR' || leg === 'HR' ? (hindLeg ? 0.040 : -0.046) : 0;
    return spec.chain.map(([x, y]) => [x + side, y] as P);
  }
  const walk = pose === 'walk';
  const dx = walk ? pawDX(leg, t, 1, senior) : 0;
  const lift = walk ? pawLift01(leg, t, senior) : 0;
  const liftH = lift * (hindLeg ? DOG_GAIT.liftHind : DOG_GAIT.liftFore);
  const side = leg === 'FR' || leg === 'HR' ? (hindLeg ? 0.042 : -0.048) : 0;

  const paw: P = [spec.paw![0] + dx + side, spec.paw![1] - liftH];
  // 摆动相掌部内收：腕/跗相对掌前移，形成折腕
  const fold = lift * (hindLeg ? 20 : 26);
  const off = rotP(spec.off!, fold);
  const mid: P = [paw[0] + off[0], paw[1] + off[1]];
  const root: P = [spec.root[0] + side * 0.5, spec.root[1]];
  const j1 = hindLeg
    ? ik2(root, mid, HIND_L1, HIND_L2, -1)
    : ik2(root, mid, FORE_L1, FORE_L2, 1);
  return [root, j1, mid, paw];
};

/* ═══ 零件 ═══════════════════════════════════════════════════════════════ */

const LegPart: React.FC<{chain: P[]; near: boolean; hind: boolean}> = ({chain, near, hind}) => {
  const startF = hind ? 0.16 : 0.84;
  // 末端往回缩 0.018u：加上线宽后掌尖恰好落在 y = 0，不会插进地面
  const segL = dist(chain[2], chain[3]) || 1;
  const tip = lerpP(chain[2], chain[3], Math.max(0, 1 - 0.018 / segL));
  const pts: P[] = [lerpP(chain[0], chain[1], startF), chain[1], chain[2], tip];
  const wsFull = hind ? HIND_W : FORE_W;
  const ws = [wsFull[0] + (wsFull[1] - wsFull[0]) * startF, wsFull[1], wsFull[2], wsFull[3]];
  const k = near ? 1 : 0.94;
  const d = taperPoly(pts, ws.map((w) => w * k), 6, 0.55);
  // 掌：沿末段方向的小楔形
  const a = chain[2], b = chain[3];
  const m = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI - 90;
  const pw = (hind ? 0.100 : 0.108) * k, ppp = 0.062 * k;
  return (
    <g>
      <path d={d} fill={near ? FUR.lit : FUR.dk} stroke={FUR.line} strokeWidth={near ? LW : LW * 0.85}
        strokeLinejoin="round" />
      <g transform={`translate(${F(b[0])} ${F(b[1])}) rotate(${F(ang)}) translate(0 ${F(-LW / 2)})`}>
        <path d={`M${F(-pw * 0.44)},${F(-ppp)}L${F(pw * 0.30)},${F(-ppp * 1.05)}` +
          `Q${F(pw * 0.60)},${F(-ppp * 0.9)} ${F(pw * 0.58)},${F(-ppp * 0.25)}` +
          `Q${F(pw * 0.56)},0 ${F(pw * 0.30)},0L${F(-pw * 0.32)},0` +
          `Q${F(-pw * 0.52)},0 ${F(-pw * 0.50)},${F(-ppp * 0.5)}Z`}
          fill={near ? FUR.lit : FUR.dk} stroke={FUR.line} strokeWidth={near ? LW : LW * 0.85}
          strokeLinejoin="round" />
        {/* 趾缝：一条极短竖线就能让「楔形块」读成「爪子」 */}
        {near && (
          <path d={`M${F(pw * 0.12)},${F(-ppp * 0.72)}L${F(pw * 0.10)},${F(-ppp * 0.1)}`}
            fill="none" stroke={FUR.line} strokeWidth={LW2 * 0.9} strokeLinecap="round" opacity={0.4} />
        )}
      </g>
    </g>
  );
};

const Ear: React.FC<{org: P; ang: number; near: boolean}> = ({org, ang, near}) => (
  <g transform={`translate(${F(org[0])} ${F(org[1])}) rotate(${F(ang)})`}>
    <path d={EAR_D} fill={near ? FUR.ear : FUR.dpr} stroke={FUR.line}
      strokeWidth={near ? LW : LW * 0.8} strokeLinejoin="round" opacity={near ? 1 : 0.9} />
    {near && (
      <path d="M0.056,0.050C0.074,0.118 0.070,0.198 0.040,0.262"
        fill="none" stroke={FUR.dpr} strokeWidth={LW2} strokeLinecap="round" opacity={0.45} />
    )}
  </g>
);

/* ═══ 主组件 ═════════════════════════════════════════════════════════════ */

export const Dog: React.FC<{
  t: number;
  pose: DogPose;
  h: number;
  senior?: boolean;
  op?: number;
}> = ({t, pose, h, senior = false, op = 1}) => {
  const uid = React.useId().replace(/:/g, '');
  const rig = buildRig(pose, t, senior);

  const H = (p: P) => xform(p, rig.headPos, rig.headAng);
  const head = HEAD_PTS.map(H);
  const occiput = head[0], throat = head[16];
  const neckTopT = rig.torso[0], neckBotT = rig.torso[rig.torso.length - 1];

  // 颈：躯干开口 → 头部开口的锥形四边（两条侧边描边，端头压在躯干/头下面）
  const crestC: P = [
    (neckTopT[0] + occiput[0]) / 2 - (occiput[1] - neckTopT[1]) * 0.16,
    (neckTopT[1] + occiput[1]) / 2 + (occiput[0] - neckTopT[0]) * 0.16 - 0.012,
  ];
  const throatC: P = [
    (neckBotT[0] + throat[0]) / 2 + (throat[1] - neckBotT[1]) * 0.10,
    (neckBotT[1] + throat[1]) / 2 - (throat[0] - neckBotT[0]) * 0.10 + 0.016,
  ];
  const neckFill = `M${pt(neckTopT)}Q${pt(crestC)} ${pt(occiput)}L${pt(throat)}Q${pt(throatC)} ${pt(neckBotT)}Z`;
  const neckTopEdge = `M${pt(neckTopT)}Q${pt(crestC)} ${pt(occiput)}`;
  const neckBotEdge = `M${pt(neckBotT)}Q${pt(throatC)} ${pt(throat)}`;

  const torsoFill = closedPath(rig.torso);
  const torsoLine = openStroke(rig.torso);
  const headFill = closedPath(head);
  const headLine = openStroke(head);

  const standFamily = pose !== 'sit' && pose !== 'lie';
  /** 结构弧 → 无描边肌群块面：沿弧法线向躯干内侧加宽后闭合 */
  const blobOf = (arc: P[], w: number): P[] => {
    const off: P[] = arc.map((p, i) => {
      const a = arc[Math.max(0, i - 1)], b = arc[Math.min(arc.length - 1, i + 1)];
      const m = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return [p[0] - ((b[1] - a[1]) / m) * w - 0.05, p[1] + ((b[0] - a[0]) / m) * w] as P;
    });
    return [...arc, ...off.reverse()];
  };
  const underline = rig.torso.slice(rig.under[0], rig.under[1] + 1);
  const shoulderArc: P[] = pose === 'lie'
    ? [[0.372, -0.572], [0.420, -0.416], [0.408, -0.248]]
    : [[0.474, -0.976], [0.444, -0.766], [0.408, -0.552]];
  const ribArc: P[] | null = pose === 'sit' || pose === 'lie' ? null
    : [[0.176, -0.508], [0.086, -0.720], [0.052, -0.944]];
  const haunchArc: P[] = pose === 'sit'
    ? [[-0.300, -0.624], [-0.180, -0.436], [-0.126, -0.194]]
    : pose === 'lie'
    ? [[-0.556, -0.520], [-0.456, -0.330], [-0.404, -0.124]]
    : [[-0.520, -0.942], [-0.392, -0.752], [-0.344, -0.578]];

  // 尾：沿尾长逐渐增大的摆幅
  const tailPts = rig.tail.map((p, i) => {
    const w = i / (rig.tail.length - 1);
    const rel: P = [p[0] - rig.tail[0][0], p[1] - rig.tail[0][1]];
    const r = rotP(rel, rig.tailWag * w);
    return [rig.tail[0][0] + r[0], rig.tail[0][1] + r[1]] as P;
  });

  const legs: Record<Leg, P[]> = {
    FL: solveLeg('FL', rig, pose, t, senior),
    FR: solveLeg('FR', rig, pose, t, senior),
    HL: solveLeg('HL', rig, pose, t, senior),
    HR: solveLeg('HR', rig, pose, t, senior),
  };

  const earOrg = H(EAR_ANCHOR);
  const earAngNear = rig.headAng + rig.earExtra;
  const earOrgFar: P = [earOrg[0] - 0.030, earOrg[1] - 0.006];

  return (
    <g opacity={op} transform={`scale(${F(h)})`}>
      <defs>
        <clipPath id={`dgT${uid}`}><path d={torsoFill} /></clipPath>
        <clipPath id={`dgH${uid}`}><path d={headFill} /></clipPath>
      </defs>

      {/* 远侧腿（深） */}
      <LegPart chain={legs.HR} near={false} hind />
      <LegPart chain={legs.FR} near={false} hind={false} />

      {/* 尾 */}
      <path d={taperPoly(tailPts, [0.118, 0.100, 0.078, 0.054, 0.030])}
        fill={FUR.base} stroke={FUR.line} strokeWidth={LW} strokeLinejoin="round" />
      {/* 尾下缘两笔羽毛（不要整条中线——那是拼缝） */}
      <g fill="none" stroke={FUR.mid} strokeWidth={LW2} strokeLinecap="round" opacity={0.5}>
        <path d={`M${pt(lerpP(tailPts[1], tailPts[2], 0.4))}q-0.020,0.052 -0.052,0.070`} />
        <path d={`M${pt(lerpP(tailPts[2], tailPts[3], 0.5))}q-0.016,0.046 -0.044,0.062`} />
      </g>

      {/* 颈（端头被躯干与头压住，接缝不可见） */}
      <path d={neckFill} fill={FUR.base} />
      <path d={neckTopEdge} fill="none" stroke={FUR.line} strokeWidth={LW} strokeLinecap="round" />
      <path d={neckBotEdge} fill="none" stroke={FUR.line} strokeWidth={LW} strokeLinecap="round" />

      {/* 远侧垂耳（压在头下） */}
      <Ear org={earOrgFar} ang={earAngNear - 6} near={false} />

      {/* 躯干。内部**不许出现线**——线读作拼缝，块面才读作肌肉（机械感的主根源） */}
      <path d={torsoFill} fill={FUR.base} />
      <g clipPath={`url(#dgT${uid})`}>
        {/* 反荫蔽：背鞍略深（上）、胸腹奶油色（下）。方向不能反 */}
        <path d={polyPath(rig.torso.slice(1, 9))} fill="none" stroke={FUR.saddle}
          strokeWidth={0.15} strokeLinecap="round" opacity={0.32} />
        <path d={polyPath(underline)} fill="none" stroke={FUR.cream}
          strokeWidth={0.17} strokeLinecap="round" opacity={0.9} />
        {/* 肩与大腿肌群：无描边填色块面（由原结构弧加宽闭合而来） */}
        <path d={closedPath(blobOf(shoulderArc, 0.20))} fill={FUR.mid} opacity={0.15} />
        <path d={closedPath(blobOf(haunchArc, 0.17))} fill={FUR.mid} opacity={0.20} />
        {/* 稀疏毛发笔触：胸前 + 大腿后缘（只在站立族姿态，坐卧不套用这些坐标） */}
        {standFamily && (
          <g fill="none" stroke={FUR.mid} strokeWidth={LW2} strokeLinecap="round" opacity={0.42}>
            <path d="M0.472,-0.470C0.462,-0.436 0.466,-0.404 0.482,-0.378" />
            <path d="M0.398,-0.492C0.390,-0.462 0.394,-0.436 0.406,-0.414" />
            <path d="M-0.700,-0.640C-0.724,-0.610 -0.734,-0.572 -0.728,-0.536" />
            <path d="M-0.742,-0.700C-0.766,-0.672 -0.776,-0.638 -0.772,-0.606" />
          </g>
        )}
      </g>
      <path d={torsoLine} fill="none" stroke={FUR.line} strokeWidth={LW}
        strokeLinecap="round" strokeLinejoin="round" />

      {/* 近侧腿（浅）—— 趴卧时前肢在头之前画（头搭在前肢上） */}
      {pose === 'lie' && <LegPart chain={legs.HL} near hind />}
      {pose === 'lie' && <LegPart chain={legs.FL} near hind={false} />}

      {/* 头 */}
      <path d={headFill} fill={FUR.base} />
      <g clipPath={`url(#dgH${uid})`}>
        {/* 吻部（老年犬花白）*/}
        <path d={`M${pt(H([0.186, -0.108]))}${crSegs([H([0.186, -0.108]), H([0.290, -0.096]),
          H([0.352, -0.056]), H([0.348, -0.014]), H([0.280, 0.016]), H([0.200, 0.014])], true).join('')}Z`}
          fill={senior ? FUR.gray : FUR.lit} opacity={senior ? 0.92 : 0.42} />
        {/* 颊 → 止部的结构线 */}
        <path d={polyPath([H([0.086, 0.052]), H([0.146, 0.000]), H([0.180, -0.076]), H([0.192, -0.106])])}
          fill="none" stroke={FUR.mid} strokeWidth={LW2 * 1.1} strokeLinecap="round" opacity={0.55} />
        {senior && (
          <g transform={`translate(${F(rig.headPos[0])} ${F(rig.headPos[1])}) rotate(${F(rig.headAng)})`}>
            <ellipse cx={0.128} cy={-0.108} rx={0.062} ry={0.040} fill={FUR.gray} opacity={0.6} />
          </g>
        )}
      </g>
      <path d={headLine} fill="none" stroke={FUR.line} strokeWidth={LW}
        strokeLinecap="round" strokeLinejoin="round" />

      {/* 五官 */}
      <g transform={`translate(${F(rig.headPos[0])} ${F(rig.headPos[1])}) rotate(${F(rig.headAng)})`}>
        <ellipse cx={EYE[0]} cy={EYE[1]} rx={0.031} ry={0.026} fill={T_COLORS.ink} />
        <ellipse cx={EYE[0] + 0.010} cy={EYE[1] - 0.009} rx={0.010} ry={0.008} fill={T_COLORS.panel} opacity={0.85} />
        <path d="M0.128,-0.132C0.156,-0.146 0.188,-0.144 0.206,-0.130"
          fill="none" stroke={FUR.mid} strokeWidth={LW2} strokeLinecap="round" opacity={0.85} />
        <ellipse cx={NOSE[0]} cy={NOSE[1]} rx={0.030} ry={0.027} fill={T_COLORS.ink}
          transform={`rotate(-18 ${NOSE[0]} ${NOSE[1]})`} />
        <path d={`M${F(NOSE[0] - 0.006)},${F(NOSE[1] - 0.008)}l-0.015,0.008`}
          fill="none" stroke={FUR.gray} strokeWidth={0.009} strokeLinecap="round" opacity={0.55} />
        <path d="M0.330,-0.006C0.296,0.014 0.252,0.024 0.212,0.024"
          fill="none" stroke={FUR.line} strokeWidth={LW2} strokeLinecap="round" opacity={0.9} />
      </g>

      {/* 颈圈（唯一使用主色的位置，面积极小） */}
      {(() => {
        const s = 0.54;
        const a: P = [neckTopT[0] + (occiput[0] - neckTopT[0]) * s, neckTopT[1] + (occiput[1] - neckTopT[1]) * s - 0.008];
        const b: P = [neckBotT[0] + (throat[0] - neckBotT[0]) * s, neckBotT[1] + (throat[1] - neckBotT[1]) * s + 0.006];
        const mid: P = [(a[0] + b[0]) / 2 + 0.018, (a[1] + b[1]) / 2];
        return (
          <g>
            <path d={`M${pt(a)}Q${pt(mid)} ${pt(b)}`} fill="none" stroke={T_COLORS.accent}
              strokeWidth={0.034} strokeLinecap="round" />
            <path d={`M${pt(a)}Q${pt(mid)} ${pt(b)}`} fill="none" stroke={T_COLORS.panel}
              strokeWidth={0.010} strokeLinecap="round" opacity={0.32} />
            <circle cx={b[0] + 0.004} cy={b[1] + 0.016} r={0.024} fill={T_COLORS.accent} />
            <circle cx={b[0] + 0.004} cy={b[1] + 0.016} r={0.010} fill={T_COLORS.panel} opacity={0.75} />
          </g>
        );
      })()}

      {/* 近侧垂耳 */}
      <Ear org={earOrg} ang={earAngNear} near />

      {/* 近侧腿（浅） */}
      {pose !== 'lie' && <LegPart chain={legs.HL} near hind />}
      {pose !== 'lie' && <LegPart chain={legs.FL} near hind={false} />}
    </g>
  );
};

export default Dog;
