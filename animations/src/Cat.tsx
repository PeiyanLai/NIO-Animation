// 侧视小型宠物猫（概念形象，非特定品种）· 矢量组件
//
// 契约（调用方只做 translate + 可选 scale，本组件内部按 sit 缩放）：
//   局部坐标原点 = **坐骨着地点**，头朝 **+x**；`sit` 姿态坐高 = 传入的 sit（= CAT.sit ≈ 137.5px）
//   体长 = sit × CAT_BODY_RATIO（≈ 1.3636）
//   pose：sit 坐姿 / lookout 探头张望 / turn 转身想往外走 / curl 蜷卧
//   位姿关键点表在 bag-data.ts 的 CAT_POSE 里（数据与断言共用同一份）
//   胸背带扣点 = CAT_POSE[pose].clip（栓扣扣这里，唯一出现 #00bebe 的地方）
//
// 全部几何写成 u 单位（1u = sit），最外层 scale(sit) 落到舞台 px。
// 呼吸 / 尾摆只依赖 t（秒），纯函数，禁止 Math.random。

import React from 'react';
import {T_COLORS as C, TERRA} from './data';
import {CAT_POSE, CAT_BODY_RATIO, type CatPose} from './bag-data';

export type {CatPose};
export {CAT_BODY_RATIO};

type P = readonly [number, number];

const F = (v: number) => (Math.round(v * 1e4) / 1e4).toString();
const pt = (p: P) => `${F(p[0])},${F(p[1])}`;

const hex2 = (h: string) => [
  parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16),
];
const mix = (a: string, b: string, k: number) => {
  const A = hex2(a), B = hex2(b);
  const c = (i: number) => Math.round(A[i] + (B[i] - A[i]) * k).toString(16).padStart(2, '0');
  return `#${c(0)}${c(1)}${c(2)}`;
};

/** 灰白虎斑（参考图里的银渐层）—— 全部从 TERRA.gravel / sand 派生，不引入品牌外配色 */
const FUR = {
  light: mix(TERRA.gravel.base, '#FFFFFF', 0.64),   // ≈ #E7E4DE
  mid: TERRA.gravel.base,                            // #C6C0B4
  dark: TERRA.gravel.dk,                             // #A39C8C
  belly: mix(TERRA.gravel.base, '#FFFFFF', 0.86),
  ear: mix(TERRA.sand.base, '#FFFFFF', 0.45),
};

/** Catmull-Rom → 三次贝塞尔 */
const crSegs = (pts: P[], closed: boolean, tension = 0.18): string[] => {
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

/** 变宽度骨条 → 闭合轮廓（腿、尾用它）*/
const taper = (pts: P[], w0: number, w1: number, steps = 9): string => {
  const n = pts.length;
  const g = (i: number) => pts[Math.max(0, Math.min(n - 1, i))];
  const S: {p: P; w: number}[] = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    const last = i === n - 2 ? steps : steps - 1;
    for (let s = 0; s <= last; s++) {
      const u = s / steps, u2 = u * u, u3 = u2 * u;
      const c = (k: 0 | 1) =>
        0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * u +
          (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 +
          (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3);
      const g0 = (i + u) / (n - 1);
      S.push({p: [c(0), c(1)], w: w0 + (w1 - w0) * g0});
    }
  }
  const L: P[] = [], R: P[] = [];
  for (let i = 0; i < S.length; i++) {
    const a = S[Math.max(0, i - 1)].p, b = S[Math.min(S.length - 1, i + 1)].p;
    const m = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const tx = (b[0] - a[0]) / m, ty = (b[1] - a[1]) / m, hw = S[i].w / 2;
    L.push([S[i].p[0] - ty * hw, S[i].p[1] + tx * hw]);
    R.push([S[i].p[0] + ty * hw, S[i].p[1] - tx * hw]);
  }
  const e = S.length - 1;
  const rw = S[e].w / 2;
  return `M${L.map(pt).join('L')}` +
    `A${F(rw)} ${F(rw)} 0 0 1 ${pt(R[e])}` +
    `L${R.slice().reverse().map(pt).join('L')}Z`;
};

/** 两骨 IK：根 a、末端 c，bend=+1 关节偏向法线正向 */
const ik2 = (a: P, c: P, l1: number, l2: number, bend: 1 | -1): P => {
  let d = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const dmax = (l1 + l2) * 0.995;
  if (d > dmax) d = dmax;
  if (d < 1e-4) d = 1e-4;
  const ux = (c[0] - a[0]) / Math.hypot(c[0] - a[0], c[1] - a[1] || 1e-4);
  const uy = (c[1] - a[1]) / Math.hypot(c[0] - a[0] || 1e-4, c[1] - a[1] || 1e-4);
  const x = (d * d + l1 * l1 - l2 * l2) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  return [a[0] + ux * x - uy * h * bend, a[1] + uy * x + ux * h * bend];
};

export const Cat: React.FC<{
  t: number;
  pose: CatPose;
  /** 坐姿坐高（px）—— 传 CAT.sit */
  sit: number;
  op?: number;
  uid?: string;
}> = ({t, pose, sit, op = 1, uid = 'cat'}) => {
  if (op <= 0.005) return null;
  const P = CAT_POSE[pose];
  const body = CAT_BODY_RATIO;

  // ── 纯函数动效：呼吸（3.4s 一轮）、尾摆（2.6s 一轮）、耳朵微动 ──
  const br = Math.sin((2 * Math.PI * t) / 3.4);
  const breathe = 1 + 0.016 * br;
  const sway = Math.sin((2 * Math.PI * t) / 2.6);
  const sway2 = Math.sin((2 * Math.PI * t) / 1.7 + 1.1);
  const earTw = 1.6 * Math.sin((2 * Math.PI * t) / 5.1);

  const hip: P = [P.hip[0], P.hip[1]];
  const sh: P = [P.sh[0], P.sh[1] * breathe];
  const head: P = [P.head[0], P.head[1] * breathe];
  const hr = P.headR;

  // ── 躯干 ──
  const torso: P[] = [
    [hip[0] - P.hipR[0], hip[1] + P.hipR[1] * 0.1],
    [hip[0] - P.hipR[0] * 0.72, hip[1] - P.hipR[1] * 0.8],
    [hip[0] + P.hipR[0] * 0.16, hip[1] - P.hipR[1] * 1.06],
    [sh[0] - 0.07, sh[1] - 0.05],
    [sh[0] + 0.1, sh[1] + 0.03],
    [sh[0] + 0.075, sh[1] + 0.3],
    [(sh[0] + hip[0]) / 2 + 0.04, hip[1] + P.hipR[1] * 0.66],
    [hip[0] - P.hipR[0] * 0.56, hip[1] + P.hipR[1] * 0.94],
  ];
  const torsoD = closedPath(torso);

  // ── 尾巴（末端摆动）──
  const tail: P[] = P.tail.map((q, i) => {
    const k = i / (P.tail.length - 1);
    return [q[0] + 0.035 * sway * k * k, q[1] + 0.028 * sway2 * k * k] as P;
  });
  const tailD = taper(tail, 0.085, 0.038);

  // ── 腿（两骨 IK）──
  const legF = (() => {
    const a: P = [sh[0] + 0.02, sh[1] + 0.06];
    const c: P = [P.fPaw[0], P.fPaw[1]];
    const l1 = 0.5 * Math.hypot(c[0] - a[0], c[1] - a[1]) + 0.09;
    const k = ik2(a, c, l1, l1, 1);
    return taper([a, k, c], 0.16, 0.105);
  })();
  const legH = (() => {
    const a: P = [hip[0] + 0.03, hip[1] + 0.02];
    const c: P = [P.hPaw[0], P.hPaw[1]];
    const l1 = 0.5 * Math.hypot(c[0] - a[0], c[1] - a[1]) + 0.1;
    const k = ik2(a, c, l1, l1, -1);
    return taper([a, k, c], 0.2, 0.115);
  })();

  // ── 颈（把头和肩胛连起来，否则头看着是浮空的）──
  const neckD = taper(
    [[sh[0] - 0.03, sh[1] + 0.03] as P,
     [(sh[0] + head[0]) / 2, (sh[1] + head[1]) / 2 + 0.02] as P,
     [head[0] - hr * 0.2, head[1] + hr * 0.55] as P],
    0.34, 0.25,
  );

  // ── 头 ──（圆脸 + 两颊）
  const face: P[] = [
    [head[0], head[1] - hr * 1.0],
    [head[0] + hr * 0.72, head[1] - hr * 0.66],
    [head[0] + hr * 1.0, head[1] + hr * 0.12],
    [head[0] + hr * 0.66, head[1] + hr * 0.82],
    [head[0], head[1] + hr * 1.02],
    [head[0] - hr * 0.7, head[1] + hr * 0.84],
    [head[0] - hr * 1.02, head[1] + hr * 0.1],
    [head[0] - hr * 0.74, head[1] - hr * 0.68],
  ];
  const faceD = closedPath(face);

  // ── 竖耳（耳尖抵达 P.earTip；轻微抖动）──
  const ear = (bx: number, tipDx: number, tw: number): string => {
    const bY = head[1] - hr * 0.72;
    const base: P = [head[0] + bx, bY];
    const tip: P = [head[0] + bx + tipDx + tw * 0.012, P.earTip * breathe];
    const out: P = [base[0] + (tipDx > 0 ? 0.062 : -0.062), bY + 0.012];
    return `M${pt(base)}L${pt(tip)}L${pt(out)}Z`;
  };
  const earNear = ear(0.03, 0.055, earTw);
  const earFar = ear(-0.085, -0.03, -earTw);

  // ── 胡须 ──
  const muz: P = [head[0] + hr * 0.62, head[1] + hr * 0.38];
  const whisk = [-0.055, 0.005, 0.06].map((dy, i) =>
    `M${pt([muz[0] - 0.01, muz[1] + dy * 0.5])}Q${pt([muz[0] + 0.18, muz[1] + dy - 0.01])} ${pt([muz[0] + 0.3, muz[1] + dy * 1.5 - 0.012 + 0.006 * Math.sin(t * 1.6 + i)])}`,
  );

  // ── 胸背带（栓扣扣在 clip 上）──
  const clip: P = [P.clip[0], P.clip[1] * breathe];
  const chestA: P = [sh[0] + 0.055, sh[1] + 0.2];
  const strapD =
    `M${pt(clip)}Q${pt([clip[0] + 0.085, clip[1] + 0.1])} ${pt(chestA)}` +
    `Q${pt([chestA[0] - 0.1, chestA[1] + 0.055])} ${pt([sh[0] - 0.06, sh[1] + 0.16])}`;
  const strapB =
    `M${pt(clip)}Q${pt([clip[0] - 0.09, clip[1] + 0.02])} ${pt([sh[0] - 0.085, sh[1] + 0.05])}`;

  const sw = 0.0125;   // 轮廓线宽（u）

  return (
    <g opacity={op} transform={`scale(${F(sit)})`}>
      <defs>
        <clipPath id={`catBody-${uid}`}><path d={torsoD} /></clipPath>
      </defs>

      {/* 远侧腿（压暗，营造前后关系） */}
      <g opacity={0.55}>
        <path d={legH} fill={FUR.dark} transform="translate(-0.035 0)" />
        <path d={legF} fill={FUR.dark} transform="translate(-0.045 0)" />
      </g>

      {/* 尾 */}
      <path d={tailD} fill={FUR.mid} stroke={C.ink2} strokeWidth={sw} strokeLinejoin="round" />

      {/* 躯干 */}
      <path d={torsoD} fill={FUR.light} stroke={C.ink2} strokeWidth={sw} strokeLinejoin="round" />
      {/* 虎斑（等距解析生成，clip 在躯干里） */}
      <g clipPath={`url(#catBody-${uid})`} opacity={0.5}>
        {[0, 1, 2, 3, 4].map((i) => {
          const u = -0.2 + i * 0.135;
          return (
            <path key={i}
              d={`M${pt([hip[0] + u, hip[1] - P.hipR[1] * 1.15])}q0.055 0.09 0.012 0.2`}
              fill="none" stroke={FUR.dark} strokeWidth={0.036} strokeLinecap="round" />
          );
        })}
        {/* 腹侧提亮 */}
        <ellipse cx={F((sh[0] + hip[0]) / 2 + 0.05)} cy={F(hip[1] + P.hipR[1] * 0.55)}
          rx={0.26} ry={0.13} fill={FUR.belly} opacity={0.85} />
      </g>

      {/* 近侧腿 */}
      <path d={legH} fill={FUR.mid} stroke={C.ink2} strokeWidth={sw} strokeLinejoin="round" />
      <path d={legF} fill={FUR.light} stroke={C.ink2} strokeWidth={sw} strokeLinejoin="round" />

      {/* 胸背带：#00bebe 只出现在扣点 */}
      <g fill="none" stroke={C.ink3} strokeWidth={0.052} strokeLinecap="round">
        <path d={strapD} />
        <path d={strapB} />
      </g>
      <circle cx={F(clip[0])} cy={F(clip[1])} r={0.046} fill={C.panel}
        stroke={C.accent} strokeWidth={0.024} />
      <circle cx={F(clip[0])} cy={F(clip[1])} r={0.019} fill={C.accent} />

      {/* 颈 → 远耳 → 头 → 近耳 */}
      <path d={neckD} fill={FUR.light} stroke={C.ink2} strokeWidth={sw} strokeLinejoin="round" />
      <path d={earFar} fill={FUR.dark} stroke={C.ink2} strokeWidth={sw} strokeLinejoin="round" />
      <path d={faceD} fill={FUR.light} stroke={C.ink2} strokeWidth={sw} strokeLinejoin="round" />
      <path d={earNear} fill={FUR.mid} stroke={C.ink2} strokeWidth={sw} strokeLinejoin="round" />

      {/* 额纹（虎斑的 M 纹） */}
      <g fill="none" stroke={FUR.dark} strokeWidth={0.026} strokeLinecap="round" opacity={0.65}>
        <path d={`M${pt([head[0] - 0.052, head[1] - hr * 0.78])}l0.016 0.062`} />
        <path d={`M${pt([head[0] + 0.006, head[1] - hr * 0.84])}l0.012 0.066`} />
      </g>

      {/* 眼（竖瞳） */}
      <g>
        <ellipse cx={F(head[0] + hr * 0.34)} cy={F(head[1] - hr * 0.06)} rx={0.048} ry={0.04}
          fill={mix(TERRA.sand.base, '#FFFFFF', 0.35)} stroke={C.ink2} strokeWidth={0.014} />
        <ellipse cx={F(head[0] + hr * 0.34)} cy={F(head[1] - hr * 0.06)} rx={0.013}
          ry={0.03 + 0.006 * Math.sin(t * 1.3)} fill={C.ink} />
        <ellipse cx={F(head[0] - hr * 0.3)} cy={F(head[1] - hr * 0.02)} rx={0.04} ry={0.034}
          fill={mix(TERRA.sand.base, '#FFFFFF', 0.35)} stroke={C.ink2} strokeWidth={0.014}
          opacity={0.75} />
        <ellipse cx={F(head[0] - hr * 0.3)} cy={F(head[1] - hr * 0.02)} rx={0.011} ry={0.026}
          fill={C.ink} opacity={0.75} />
      </g>

      {/* 鼻 + 嘴 */}
      <path d={`M${pt([muz[0] - 0.026, muz[1] - 0.03])}l0.052 0l-0.026 0.036Z`} fill={C.ink3} />
      <path d={`M${pt([muz[0], muz[1] + 0.006])}q-0.028 0.042 -0.056 0.006M${pt([muz[0], muz[1] + 0.006])}q0.028 0.042 0.056 0.006`}
        fill="none" stroke={C.ink2} strokeWidth={0.016} strokeLinecap="round" />

      {/* 胡须 */}
      <g fill="none" stroke={C.ink3} strokeWidth={0.011} strokeLinecap="round" opacity={0.7}>
        {whisk.map((d, i) => <path key={i} d={d} />)}
      </g>
    </g>
  );
};

/** 俯视猫头（第三章平面视用：敞篷打开后从上方看到的头 + 竖耳） */
export const CatTop: React.FC<{t: number; r: number}> = ({t, r}) => {
  const tw = 1.4 * Math.sin((2 * Math.PI * t) / 5.1);
  return (
    <g>
      <ellipse cx={0} cy={r * 1.15} rx={r * 0.96} ry={r * 1.1} fill={FUR.mid}
        stroke={C.ink2} strokeWidth={0.9} />
      <path d={`M${F(-r * 0.72)} ${F(-r * 0.42)}L${F(-r * 0.98 - tw * 0.1)} ${F(-r * 1.05)}L${F(-r * 0.2)} ${F(-r * 0.82)}Z`}
        fill={FUR.mid} stroke={C.ink2} strokeWidth={0.9} strokeLinejoin="round" />
      <path d={`M${F(r * 0.72)} ${F(-r * 0.42)}L${F(r * 0.98 + tw * 0.1)} ${F(-r * 1.05)}L${F(r * 0.2)} ${F(-r * 0.82)}Z`}
        fill={FUR.mid} stroke={C.ink2} strokeWidth={0.9} strokeLinejoin="round" />
      <circle cx={0} cy={0} r={r} fill={FUR.light} stroke={C.ink2} strokeWidth={1} />
      <ellipse cx={-r * 0.36} cy={-r * 0.04} rx={r * 0.15} ry={r * 0.12} fill={C.ink} />
      <ellipse cx={r * 0.36} cy={-r * 0.04} rx={r * 0.15} ry={r * 0.12} fill={C.ink} />
      <path d={`M${F(-r * 0.12)} ${F(r * 0.38)}l${F(r * 0.24)} 0l${F(-r * 0.12)} ${F(r * 0.16)}Z`} fill={C.ink3} />
    </g>
  );
};
