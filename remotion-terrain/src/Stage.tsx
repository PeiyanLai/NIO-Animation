import React from 'react';
import {AbsoluteFill, Img, useCurrentFrame, useVideoConfig} from 'remotion';
import {
  Band, CAR_BODY, F_DATA, F_UI, SCENES, SPEED, T_COLORS as C, TERRA, TerrKey, WHEEL_R,
  easeOutBack, frac, modeAt, phaseOf, terrAt, win,
} from './data';

import {RIM_F_URI, RIM_PHOTO_R, RIM_R_URI} from './wheel-photo';
import {PHOTO_URI} from './photo';

const PHOTO = PHOTO_URI;

const WHITE = '#FFFFFF';
const GY = 420; // 地面线（地形带上沿 = 轮胎接地线）

// 固定种子伪随机（纯函数，无 Math.random）
const rnd = (i: number) => frac(Math.sin(i * 127.1 + 311.7) * 43758.5453);
const f1 = (n: number) => n.toFixed(1);

// ─── 车轮 ────────────────────────────────────────────────────────────────
// **不再画矢量轮**：照片自带的大饼轮毂在孔形、质感、中心盖 Logo 上都比手画的准。
// 车身遮罩不挖轮拱洞让轮胎露出来，再叠一张单独抠出来的轮辋圆盘按滚动距离旋转
//（见 wheel-photo.ts）。矢量版仍保留在 skill 资产库 assets/nio-vehicle/Wheel.tsx，
// 供拿不到可用侧视照片时兜底。

// ─── 地形纹理 pattern（底纹） ─────────────────────────────────────────────
const Patterns: React.FC = () => (
  <>
    <pattern id="pat-asphalt" patternUnits="userSpaceOnUse" width={140} height={140} y={420}>
      <rect fill={TERRA.asphalt.dk} x={10} y={34} width={46} height={3} rx={1.5} />
      <rect fill={TERRA.asphalt.dk} x={86} y={78} width={38} height={3} rx={1.5} />
      <rect fill={TERRA.asphalt.dk} x={34} y={112} width={30} height={3} rx={1.5} />
    </pattern>
    <pattern id="pat-mud" patternUnits="userSpaceOnUse" width={140} height={140} y={420}>
      <ellipse fill={TERRA.mud.dk} cx={36} cy={38} rx={16} ry={7} />
      <ellipse fill={TERRA.mud.dk} cx={104} cy={70} rx={20} ry={8} />
      <ellipse fill={TERRA.mud.dk} cx={56} cy={110} rx={13} ry={6} />
      <path stroke={TERRA.mud.dk} fill="none" strokeWidth={2} d="M8 88 q10 -6 20 0 q10 6 20 0" />
    </pattern>
    <pattern id="pat-sand" patternUnits="userSpaceOnUse" width={140} height={140} y={420}>
      <path stroke={TERRA.sand.dk} fill="none" strokeWidth={2} d="M6 44 q17 -12 34 0 q17 12 34 0" />
      <path stroke={TERRA.sand.dk} fill="none" strokeWidth={2} d="M66 100 q17 -12 34 0 q17 12 34 0" />
      <circle fill={TERRA.sand.dk} cx={112} cy={36} r={3} />
      <circle fill={TERRA.sand.dk} cx={30} cy={116} r={3} />
    </pattern>
    <pattern id="pat-snow" patternUnits="userSpaceOnUse" width={140} height={140} y={420}>
      <circle fill={TERRA.snow.dk} cx={30} cy={40} r={4} />
      <circle fill={TERRA.snow.dk} cx={96} cy={66} r={3} />
      <circle fill={TERRA.snow.dk} cx={58} cy={108} r={4} />
      <path d="M118 104 l0 -14 M111 97 l14 0 M113 92 l10 10 M123 92 l-10 10"
        stroke={TERRA.snow.dk} strokeWidth={1.8} fill="none" />
    </pattern>
    <pattern id="pat-wet" patternUnits="userSpaceOnUse" width={140} height={140} y={420}>
      <path stroke={TERRA.wet.dk} fill="none" strokeWidth={2} d="M8 46 q12 -7 24 0 q12 7 24 0 q12 -7 24 0" />
      <path stroke={TERRA.wet.dk} fill="none" strokeWidth={2} d="M50 100 q12 -7 24 0 q12 7 24 0" />
      <rect fill={TERRA.wet.dk} x={96} y={30} width={26} height={3} rx={1.5} />
    </pattern>
    <pattern id="pat-gravel" patternUnits="userSpaceOnUse" width={140} height={140} y={420}>
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

// ─── 具象地形道具（全部在地形带的 translate(-dx) 组内，随地面横向滚动） ──
// 立式道具经过车身时淡出：侧视里车底与车轮之间有缝，背景树/仙人掌会从车底「长」出来
const CAR_L = 190, CAR_R = 640, FADE = 46;
const behindCar = (x: number, dx: number) => {
  const sx = x - dx;
  if (sx <= CAR_L - FADE || sx >= CAR_R + FADE) return 1;
  if (sx >= CAR_L && sx <= CAR_R) return 0;
  return sx < CAR_L ? (CAR_L - sx) / FADE : (sx - CAR_R) / FADE;
};
type Spot = {x: number; a: number; b: number; c: number; i: number};
const spots = (bd: Band, step: number, sd: number): Spot[] => {
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

// 沿地面线起伏的轮廓（雪丘 / 沙丘 / 石堆边缘）
const crest = (bd: Band, amp: number, sd: number, step: number, depth: number) => {
  const n = Math.max(2, Math.ceil(bd.w / step));
  let py = GY - 2 - rnd(sd) * amp;
  let d = `M${f1(bd.x)} ${GY + depth} L${f1(bd.x)} ${f1(py)}`;
  for (let i = 1; i <= n; i++) {
    const x = bd.x + (bd.w * i) / n;
    const px = bd.x + (bd.w * (i - 1)) / n;
    const y = GY - 2 - rnd(sd + i * 2.93) * amp;
    d += ` Q${f1((px + x) / 2)} ${f1(Math.min(py, y) - amp * 0.5)} ${f1(x)} ${f1(y)}`;
    py = y;
  }
  return `${d} L${f1(bd.x + bd.w)} ${GY + depth} Z`;
};

// 缓起伏的横向线（车辙 / 沙纹 / 水线）
const wavy = (bd: Band, y: number, amp: number, sd: number, step = 150) => {
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

// —— 雪地：雪人 / 松树 / 雪堆 ——
const Snowman: React.FC<{x: number; s: number}> = ({x, s}) => (
  <g transform={`translate(${f1(x)} ${GY}) scale(${s.toFixed(2)})`}>
    <ellipse cy={1.5} rx={21} ry={4} fill={TERRA.snow.dk} opacity={0.55} />
    <circle cy={-15} r={16} fill={WHITE} stroke={TERRA.snow.dk} strokeWidth={1.5} />
    <circle cy={-38} r={11.5} fill={WHITE} stroke={TERRA.snow.dk} strokeWidth={1.5} />
    <circle cy={-56} r={8.6} fill={WHITE} stroke={TERRA.snow.dk} strokeWidth={1.5} />
    {/* 树枝手臂 */}
    <path d="M-11 -40 L-26 -50 M-19.5 -45.5 L-27 -44.5 M-21.5 -46.8 L-24.5 -53"
      stroke={TERRA.mud.dk} strokeWidth={1.8} fill="none" strokeLinecap="round" />
    <path d="M11 -40 L27 -49 M20 -44.5 L28 -43.5 M22 -45.8 L25.5 -52"
      stroke={TERRA.mud.dk} strokeWidth={1.8} fill="none" strokeLinecap="round" />
    {/* 围巾 */}
    <path d="M-9.5 -47.5 q9.5 4.5 19 0 l0 4.6 q-9.5 4.5 -19 0 Z" fill={C.accentDim} />
    <path d="M6.5 -44 l4.6 12.5 l-4.2 1.2 l-3.4 -12.6 Z" fill={C.accentDim} />
    {/* 胡萝卜鼻 + 眼 + 嘴 */}
    <path d="M2 -56.5 L14.5 -54.6 L2 -52.6 Z" fill={C.warn} />
    <circle cx={-2.6} cy={-58.6} r={1.5} fill={C.ink2} />
    <circle cx={3.4} cy={-58.9} r={1.5} fill={C.ink2} />
    <path d="M-3.4 -50.6 q4.2 2.6 8 -0.4" stroke={C.ink2} strokeWidth={1.1}
      fill="none" strokeLinecap="round" />
    {/* 纽扣 + 帽子 */}
    <circle cy={-19} r={1.7} fill={C.ink3} />
    <circle cy={-12} r={1.7} fill={C.ink3} />
    <path d="M-10.5 -63 L10.5 -63 L9 -65.6 L-9 -65.6 Z" fill={C.ink2} />
    <rect x={-6.4} y={-74} width={12.8} height={9} rx={1.6} fill={C.ink2} />
  </g>
);

const Pine: React.FC<{x: number; h: number}> = ({x, h}) => {
  const w = h * 0.44;
  return (
    <g transform={`translate(${f1(x)} ${GY})`}>
      <ellipse cy={1.5} rx={w * 0.5} ry={3.5} fill={TERRA.snow.dk} opacity={0.5} />
      <rect x={-w * 0.06} y={-h * 0.13} width={w * 0.12} height={h * 0.13} fill={TERRA.mud.dk} />
      {[0, 1, 2].map((k) => {
        const yb = -h * (0.1 + k * 0.26);
        const ww = (w / 2) * (1 - k * 0.25);
        const ht = h * 0.38;
        return (
          <g key={k}>
            <path d={`M0 ${f1(yb - ht)} L${f1(ww)} ${f1(yb)} L${f1(-ww)} ${f1(yb)} Z`} fill={C.ink3} />
            <path
              d={`M0 ${f1(yb - ht)} L${f1(ww * 0.52)} ${f1(yb - ht * 0.46)} q${f1(-ww * 0.52)} ${f1(ht * 0.2)} ${f1(-ww * 1.04)} 0 Z`}
              fill={WHITE}
              opacity={0.94}
            />
          </g>
        );
      })}
    </g>
  );
};

const SnowDecor: React.FC<{bd: Band; sd: number; dx: number}> = ({bd, sd, dx}) => {
  const edge = crest(bd, 15, sd, 92, 140);
  return (
    <g>
      <path d={edge} fill={WHITE} opacity={0.9} />
      <path d={edge} fill="none" stroke={TERRA.snow.dk} strokeWidth={1.3} opacity={0.7} />
      {/* 地面雪痕 */}
      <path d={wavy(bd, 505, 12, sd + 5)} fill="none" stroke={TERRA.snow.dk}
        strokeWidth={2.4} opacity={0.55} strokeDasharray="26 34" />
      {spots(bd, 165, sd + 40).map((p) => {
        const k = (p.i + 1) % 3;
        if (k === 1) return <g key={p.i} opacity={behindCar(p.x, dx)}><Snowman x={p.x} s={1.24 + p.b * 0.34} /></g>;
        if (k === 2) return <g key={p.i} opacity={behindCar(p.x, dx)}><Pine x={p.x} h={112 + p.b * 56} /></g>;
        return (
          <g key={p.i} opacity={behindCar(p.x, dx)}>
            <Pine x={p.x - 22} h={64 + p.c * 30} />
            <path
              d={`M${f1(p.x + 18)} ${GY} q${f1(8 + p.c * 5)} ${f1(-13 - p.b * 8)} ${f1(24 + p.c * 12)} 0 Z`}
              fill={WHITE}
              stroke={TERRA.snow.dk}
              strokeWidth={1.2}
            />
          </g>
        );
      })}
    </g>
  );
};

// —— 泥地：车辙 / 泥坑 / 飞溅泥点 ——
const MudDecor: React.FC<{bd: Band; sd: number}> = ({bd, sd}) => (
  <g>
    {/* 两道深陷车辙（虚线 = 胎纹） */}
    {[{y: 452, w: 10}, {y: 512, w: 12}].map((r, i) => (
      <g key={i}>
        <path d={wavy(bd, r.y, 9, sd + i * 3)} fill="none" stroke={TERRA.mud.dk}
          strokeWidth={r.w + 8} opacity={0.55} strokeLinecap="round" />
        <path d={wavy(bd, r.y, 9, sd + i * 3)} fill="none" stroke={C.ink2}
          strokeWidth={r.w} opacity={0.3} strokeDasharray="7 12" />
      </g>
    ))}
    {spots(bd, 132, sd + 60).map((p) => {
      const py = 440 + p.c * 96;
      return (
        <g key={p.i}>
          {/* 泥坑：多椭圆叠加成不规则水洼 */}
          <ellipse cx={p.x} cy={py} rx={22 + p.b * 12} ry={7 + p.b * 3} fill={C.ink2} opacity={0.44} />
          <ellipse cx={p.x + 15} cy={py + 3} rx={13} ry={5} fill={C.ink2} opacity={0.44} />
          <ellipse cx={p.x - 13} cy={py - 2.5} rx={11} ry={4.5} fill={C.ink2} opacity={0.44} />
          <ellipse cx={p.x - 5} cy={py - 2.5} rx={10 + p.b * 4} ry={1.8} fill={WHITE} opacity={0.3} />
          {/* 飞溅泥点 */}
          {[0, 1, 2, 3, 4].map((j) => (
            <circle
              key={j}
              cx={p.x + (rnd(sd + p.i * 9 + j) - 0.5) * 84}
              cy={py - 14 - rnd(sd + p.i * 5 + j * 2) * 20}
              r={1.4 + rnd(sd + p.i * 3 + j) * 2.2}
              fill={TERRA.mud.dk}
              opacity={0.85}
            />
          ))}
          {/* 泥埂（地面线以上的隆起） */}
          <path
            d={`M${f1(p.x - 34)} ${GY} q${f1(10)} ${f1(-8 - p.b * 6)} ${f1(24)} 0 Z`}
            fill={TERRA.mud.dk}
          />
        </g>
      );
    })}
  </g>
);

// —— 沙地：连绵沙丘 / 仙人掌 / 枯木 / 风纹 ——
const Cactus: React.FC<{x: number; h: number; fx: number}> = ({x, h, fx}) => (
  <g transform={`translate(${f1(x)} ${GY}) scale(${fx} 1)`}>
    <ellipse cy={1.5} rx={17} ry={3.5} fill={TERRA.sand.dk} opacity={0.6} />
    <path d={`M0 0 L0 ${f1(-h)}`} stroke={C.ink3} strokeWidth={15} strokeLinecap="round" fill="none" />
    <path d={`M-2 ${f1(-h * 0.46)} L-19 ${f1(-h * 0.46)} L-19 ${f1(-h * 0.74)}`}
      stroke={C.ink3} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d={`M2 ${f1(-h * 0.62)} L20 ${f1(-h * 0.62)} L20 ${f1(-h * 0.88)}`}
      stroke={C.ink3} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d={`M0 ${f1(-h * 0.08)} L0 ${f1(-h * 0.93)}`} stroke={C.ink4}
      strokeWidth={1.4} opacity={0.6} fill="none" />
  </g>
);

const SandDecor: React.FC<{bd: Band; sd: number; dx: number}> = ({bd, sd, dx}) => (
  <g>
    {/* 远近两层沙丘轮廓 */}
    <path d={crest(bd, 52, sd + 11, 210, 30)} fill={TERRA.sand.dk} opacity={0.28} />
    <path d={crest(bd, 27, sd + 29, 150, 34)} fill={TERRA.sand.dk} opacity={0.45} />
    <path d={crest(bd, 27, sd + 29, 150, 34)} fill="none" stroke={TERRA.sand.dk}
      strokeWidth={1.4} opacity={0.8} />
    {/* 沙面风纹 */}
    {[456, 496, 534].map((y, i) => (
      <path key={i} d={wavy(bd, y, 16, sd + i * 7, 120)} fill="none"
        stroke={TERRA.sand.dk} strokeWidth={1.8} opacity={0.6} />
    ))}
    {spots(bd, 195, sd + 80).map((p) => {
      const k = p.i % 3;
      if (k === 0) return <g key={p.i} opacity={behindCar(p.x, dx)}><Cactus x={p.x} h={92 + p.b * 40} fx={p.c > 0.5 ? 1 : -1} /></g>;
      if (k === 1) {
        return (
          <g key={p.i} opacity={behindCar(p.x, dx)} transform={`translate(${f1(p.x)} ${GY})`}>
            {/* 枯木 */}
            <path d="M-20 0 L2 -24 M2 -24 L15 -37 M2 -24 L-9 -36 M-9 -36 L-18 -43 M15 -37 L24 -42"
              stroke={TERRA.mud.dk} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.85} />
            <ellipse cy={1} rx={16} ry={3} fill={TERRA.sand.dk} opacity={0.55} />
          </g>
        );
      }
      return (
        <g key={p.i} transform={`translate(${f1(p.x)} ${GY})`}>
          {/* 小灌木 / 干草簇 */}
          {[0, 1, 2, 3, 4].map((j) => (
            <path
              key={j}
              d={`M${f1((j - 2) * 4)} 0 q${f1((rnd(sd + p.i + j) - 0.5) * 10)} ${f1(-9 - rnd(sd + j * 3) * 8)} ${f1((rnd(sd + p.i * 2 + j) - 0.5) * 22)} ${f1(-16 - rnd(sd + j) * 12)}`}
              stroke={C.ink4}
              strokeWidth={1.5}
              fill="none"
              strokeLinecap="round"
            />
          ))}
        </g>
      );
    })}
  </g>
);

// —— 湿地：水洼倒影 / 涟漪 / 芦苇 ——
const Reeds: React.FC<{x: number; h: number; sd: number}> = ({x, h, sd}) => (
  <g transform={`translate(${f1(x)} ${GY})`}>
    <ellipse cy={1.5} rx={26} ry={4} fill={TERRA.wet.dk} opacity={0.55} />
    {[0, 1, 2, 3, 4, 5].map((j) => {
      const o = (rnd(sd + j * 2.3) - 0.5) * 34;
      const hh = h * (0.62 + rnd(sd + j * 4.1) * 0.55);
      const bd2 = (rnd(sd + j * 6.7) - 0.5) * 26;
      return (
        <g key={j}>
          <path d={`M${f1(o)} 0 Q${f1(o + bd2 * 0.4)} ${f1(-hh * 0.6)} ${f1(o + bd2)} ${f1(-hh)}`}
            stroke={C.ink3} strokeWidth={2.4} fill="none" strokeLinecap="round" />
          {/* 叶片 */}
          <path d={`M${f1(o + bd2 * 0.25)} ${f1(-hh * 0.4)} q${f1(9 + bd2 * 0.3)} ${f1(-hh * 0.18)} ${f1(13 + bd2 * 0.4)} ${f1(-hh * 0.5)}`}
            stroke={C.ink3} strokeWidth={1.6} fill="none" strokeLinecap="round" opacity={0.8} />
          {j % 2 === 0 && (
            <ellipse cx={o + bd2} cy={-hh - 8} rx={3.4} ry={9.5} fill={TERRA.mud.dk} />
          )}
        </g>
      );
    })}
  </g>
);

const WetDecor: React.FC<{bd: Band; sd: number; dx: number; t: number}> = ({bd, sd, dx, t}) => (
  <g>
    {/* 水面反光带 */}
    <rect x={bd.x} y={GY} width={bd.w} height={30} fill={WHITE} opacity={0.2} />
    <path d={wavy(bd, 470, 10, sd + 4)} fill="none" stroke={WHITE} strokeWidth={2.6} opacity={0.45} />
    <path d={wavy(bd, 532, 10, sd + 9)} fill="none" stroke={WHITE} strokeWidth={2.2} opacity={0.35} />
    {spots(bd, 180, sd + 100).map((p) => {
      const py = 448 + p.c * 88;
      const rx = 30 + p.b * 20;
      return (
        <g key={p.i}>
          {/* 水洼 + 倒影高光 */}
          <ellipse cx={p.x} cy={py} rx={rx} ry={rx * 0.3} fill={TERRA.wet.dk} opacity={0.7} />
          <ellipse cx={p.x} cy={py} rx={rx - 4} ry={rx * 0.3 - 3} fill={WHITE} opacity={0.42} />
          <path d={`M${f1(p.x - rx * 0.6)} ${f1(py - 2)} L${f1(p.x + rx * 0.2)} ${f1(py - 2)}`}
            stroke={WHITE} strokeWidth={1.8} opacity={0.85} />
          <path d={`M${f1(p.x - rx * 0.3)} ${f1(py + 4)} L${f1(p.x + rx * 0.5)} ${f1(py + 4)}`}
            stroke={WHITE} strokeWidth={1.4} opacity={0.6} />
          {/* 扩散涟漪圈 */}
          {[0, 1, 2].map((j) => {
            const k = frac(t / 2.1 + j / 3 + p.a);
            return (
              <ellipse
                key={j}
                cx={p.x}
                cy={py}
                rx={5 + k * (rx - 6)}
                ry={(5 + k * (rx - 6)) * 0.3}
                fill="none"
                stroke={WHITE}
                strokeWidth={2}
                opacity={0.9 * (1 - k)}
              />
            );
          })}
        </g>
      );
    })}
    {spots(bd, 148, sd + 140).map((p) => (
      <g key={p.i} opacity={behindCar(p.x, dx)}><Reeds x={p.x} h={78 + p.b * 46} sd={sd + p.i * 13} /></g>
    ))}
  </g>
);

// —— 碎石：大小不一的石块 / 路肩碎石堆 ——
const Stone: React.FC<{x: number; y: number; r: number; sd: number}> = ({x, y, r, sd}) => {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const th = (i / 6) * Math.PI * 2 + rnd(sd + i) * 0.55;
    const rr = r * (0.72 + rnd(sd + i * 2.2) * 0.5);
    pts.push(`${(x + Math.cos(th) * rr).toFixed(1)} ${(y + Math.sin(th) * rr * 0.84).toFixed(1)}`);
  }
  return (
    <g>
      <path d={`M${pts.join(' L')} Z`} fill={TERRA.gravel.dk} stroke={C.ink3}
        strokeWidth={0.9} strokeLinejoin="round" />
      <ellipse cx={x - r * 0.24} cy={y - r * 0.3} rx={r * 0.42} ry={r * 0.2}
        fill={WHITE} opacity={0.45} />
    </g>
  );
};

const GravelDecor: React.FC<{bd: Band; sd: number; dx: number}> = ({bd, sd, dx}) => (
  <g>
    <path d={crest(bd, 11, sd + 3, 70, 26)} fill={TERRA.gravel.dk} opacity={0.5} />
    {spots(bd, 150, sd + 170).map((p) => (
      <g key={p.i}>
        {/* 路肩碎石堆（地面线以上） */}
        {p.i % 2 === 0 && (
        <g opacity={behindCar(p.x, dx)}>
          {Array.from({length: 9}, (_, j) => {
            const a = rnd(sd + p.i * 13 + j * 3.7);
            const b = rnd(sd + p.i * 7 + j * 5.3);
            const px = p.x + (a - 0.5) * 52;
            const py = GY - 3 - (1 - Math.abs(px - p.x) / 30) * (11 + b * 14);
            return <Stone key={j} x={px} y={py} r={4 + b * 5.5} sd={sd + p.i * 11 + j * 2.3} />;
          })}
        </g>
        )}
        {/* 路面散落石块 */}
        {Array.from({length: 5}, (_, j) => (
          <Stone
            key={`s${j}`}
            x={p.x + (rnd(sd + p.i * 4 + j * 2.1) - 0.5) * 130}
            y={434 + rnd(sd + p.i * 6 + j * 3.3) * 110}
            r={3.5 + rnd(sd + p.i * 8 + j) * 8}
            sd={sd + p.i * 17 + j * 5.1}
          />
        ))}
      </g>
    ))}
  </g>
);

// —— 柏油：对照组，仅车道标线 ——
const AsphaltDecor: React.FC<{bd: Band}> = ({bd}) => (
  <g>
    <path d={`M${bd.x} 434 L${bd.x + bd.w} 434`} stroke={WHITE} strokeWidth={3} opacity={0.5} />
    <path d={`M${bd.x} 492 L${bd.x + bd.w} 492`} stroke={WHITE} strokeWidth={5.5}
      opacity={0.8} strokeDasharray="60 46" />
    <path d={`M${bd.x} 548 L${bd.x + bd.w} 548`} stroke={WHITE} strokeWidth={3} opacity={0.4} />
  </g>
);

const BandDecor: React.FC<{bd: Band; i: number; t: number; dx: number}> = ({bd, i, t, dx}) => {
  const sd = i * 97 + 13;
  switch (bd.terr) {
    case 'snow':
      return <SnowDecor bd={bd} sd={sd} dx={dx} />;
    case 'mud':
      return <MudDecor bd={bd} sd={sd} />;
    case 'sand':
      return <SandDecor bd={bd} sd={sd} dx={dx} />;
    case 'wet':
      return <WetDecor bd={bd} sd={sd} t={t} dx={dx} />;
    case 'gravel':
      return <GravelDecor bd={bd} sd={sd} dx={dx} />;
    default:
      return <AsphaltDecor bd={bd} />;
  }
};

// ─── 空中粒子（不随地形滚动，独立循环，纯 frame 函数） ───────────────────
const Snowfall: React.FC<{t: number; op: number; n: number; sd: number; big: boolean}> = ({
  t, op, n, sd, big,
}) => {
  if (op <= 0.01) return null;
  return (
    <g>
      {Array.from({length: n}, (_, i) => {
        const a = rnd(sd + i * 1.7);
        const b = rnd(sd + i * 2.9 + 5.1);
        const c = rnd(sd + i * 4.1 + 9.7);
        const per = 4.2 + b * 4.6;
        const k = frac(t / per + c);
        const y = -30 + k * 630;
        const x = a * 1050 - 25 + Math.sin(t * (0.7 + b * 0.8) + i) * (7 + c * 13);
        const r = (big ? 2.2 : 1.4) + c * (big ? 2.6 : 1.6);
        const o = op * (0.4 + b * 0.5);
        if (big && c > 0.62) {
          return (
            <g key={i} transform={`translate(${f1(x)} ${f1(y)}) rotate(${((t * 46 + i * 27) % 360).toFixed(1)})`}
              opacity={o}>
              <path
                d={`M0 ${f1(-r * 1.7)} L0 ${f1(r * 1.7)} M${f1(-r * 1.47)} ${f1(-r * 0.85)} L${f1(r * 1.47)} ${f1(r * 0.85)} M${f1(-r * 1.47)} ${f1(r * 0.85)} L${f1(r * 1.47)} ${f1(-r * 0.85)}`}
                stroke="#8FB6CE"
                strokeWidth={1.2}
                strokeLinecap="round"
              />
            </g>
          );
        }
        return (
          <circle key={i} cx={x} cy={y} r={r} fill={WHITE} stroke="#9BBDD2"
            strokeWidth={0.7} opacity={o} />
        );
      })}
    </g>
  );
};

const SandWind: React.FC<{t: number; op: number}> = ({t, op}) => {
  if (op <= 0.01) return null;
  return (
    <g>
      {Array.from({length: 24}, (_, i) => {
        const a = rnd(i * 3.3 + 2.2);
        const b = rnd(i * 5.7 + 7.9);
        const c = rnd(i * 2.1 + 13.3);
        const per = 1.5 + b * 1.7;
        const k = frac(t / per + c);
        const x = 1050 - k * 1110;
        const y = 296 + a * 148 + Math.sin(t * 2.3 + i) * (3 + c * 9);
        const len = 16 + c * 30;
        return (
          <path
            key={i}
            d={`M${f1(x)} ${f1(y)} l${len.toFixed(0)} ${f1(-2 + c * 4)}`}
            stroke={TERRA.sand.dk}
            strokeWidth={1.3 + c}
            strokeLinecap="round"
            opacity={op * (0.3 + b * 0.45)}
          />
        );
      })}
    </g>
  );
};

// ─── 场景舞台：一切皆为 t 的纯函数 ────────────────────────────────────────
export const Stage: React.FC<{scene: 'a' | 'b' | 'c'}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = SCENES[scene];
  const t = Math.min(frame / fps, s.T - 0.001);

  const ph = phaseOf(s, t);
  const terr = terrAt(s, t);
  const mode = modeAt(s, t);
  const modeOn = mode !== null;

  const dx = SPEED * t;
  const bob = Math.sin(t * 5) * 1.2;
  const deg = ((dx / WHEEL_R) * 57.2958) % 360;

  // 当前地形的进出淡入淡出（用于空中粒子层）
  const terrFade = (key: TerrKey) => {
    if (terr !== key) return 0;
    let start = 0;
    for (const b of s.bounds) if (t >= b.t) start = b.t;
    const nx = s.bounds.find((b) => b.t > t);
    const end = nx ? nx.t : s.T;
    return Math.min(win(t, start, start + 0.7), 1 - win(t, end - 0.5, end));
  };
  const snowOp = terrFade('snow');
  const sandOp = terrFade('sand');

  // 气泡（场景 a/b）
  let bk = 0;
  if (s.bub) {
    if (t >= s.ph[1] && t < s.pressAt! + 0.5) bk = win(t, s.ph[1], s.ph[1] + 0.45);
    if (t >= s.pressAt! + 0.5) bk = 1 - win(t, s.pressAt! + 0.5, s.pressAt! + 0.9);
  }

  // 完成确认
  const ck = t >= s.tDone + 0.3 ? win(t, s.tDone + 0.3, s.tDone + 0.75) : 0;

  // 识别脉冲（相位 1 循环，三道弧错峰）
  const scanActive = ph === 1;
  const scanT = t - s.ph[0];
  const scanOp = (delay: number) =>
    scanActive && scanT >= delay ? 0.95 * (1 - frac((scanT - delay) / 1.1)) : 0;

  // 按键涟漪（a/b 相位 3 起两轮）
  const rippleK =
    s.pressAt !== undefined && t >= s.pressAt && t < s.pressAt + 1.6
      ? frac((t - s.pressAt) / 0.8)
      : -1;

  // 扬尘（模式开启循环，三粒错峰 0.9s）
  const sprayDot = (delay: number) => {
    if (!modeOn) return {op: 0, x: 0, y: 0};
    const k = frac((t - delay) / 0.9);
    const op = k < 0.15 ? (k / 0.15) * 0.7 : 0.7 * (1 - (k - 0.15) / 0.85);
    return {op, x: -46 * k, y: -26 * k};
  };

  // 徽标呼吸环（2s 循环）
  const ringK = modeOn ? frac(t / 2) : 0;

  // 抓地标识淡入
  const gripShow = modeOn
    ? s.startMode === 'auto' || s.startMode ? 0.9 : Math.min(0.9, win(t, s.activateAt ?? 0, (s.activateAt ?? 0) + 0.4) * 0.9)
    : 0;

  // 字幕入场
  const phStart = ph === 0 ? 0 : s.ph[ph - 1];
  const capK = win(t, phStart, phStart + 0.45);

  const hudMode = mode ? TERRA[mode].label : '标准';
  const badgeTxt = mode ? `全地形 · ${TERRA[mode].label}模式` : '全地形模式 · 未开启';
  const badgeDot = mode ? TERRA[mode].base : TERRA.asphalt.base;

  const capDone = ph === 4;

  // 模式徽标：移到车头上方（不再占画面左上角）
  const BX = 640;
  const BY = 150;

  return (
    <AbsoluteFill style={{background: C.stageBg, fontFamily: F_UI}}>
      {/* 预载真车照片（Img 阻塞渲染直至加载完成，确保 SVG image 同帧就绪） */}
      <Img src={PHOTO} style={{position: 'absolute', width: 1, height: 1, opacity: 0}} />

      <svg
        viewBox="0 0 1000 560"
        style={{position: 'absolute', left: 0, top: 2, width: 1920, height: 1075}}
      >
        <defs>
          {/* 车身抠形。**不再挖轮拱洞**——照片自带的大饼轮毂比手画的矢量轮准得多，
              让它自己露出来；行驶感靠上层单独旋转的轮辋圆盘（见 wheel-photo.ts） */}
          <mask id="carMask">
            <path d={CAR_BODY} fill="#fff" />
          </mask>
          <radialGradient id="rimDome" cx="36%" cy="28%" r="80%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.42" />
            <stop offset="46%" stopColor="#FFFFFF" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#2E3D3D" stopOpacity="0.26" />
          </radialGradient>
          <Patterns />
        </defs>

        {/* 地形带（滚动）：底色 + 底纹 + 具象道具 */}
        <g transform={`translate(${-dx} 0)`}>
          {s.bands.map((b, i) => (
            <g key={i}>
              <rect fill={TERRA[b.terr].base} x={b.x} y={420} width={b.w} height={140} />
              <rect fill={`url(#pat-${b.terr})`} x={b.x} y={420} width={b.w} height={140} />
            </g>
          ))}
          {s.bands.map((b, i) => (
            <BandDecor key={`d${i}`} bd={b} i={i} t={t} dx={dx} />
          ))}
        </g>

        {/* 远景飘雪 / 扬沙（车后） */}
        <Snowfall t={t} op={snowOp * 0.7} n={16} sd={5} big={false} />
        <SandWind t={t} op={sandOp * 0.6} />

        {/* 接地阴影（浅色底：轮下压暗 + 整车软投影） */}
        <ellipse cx={573.2} cy={420} rx={48} ry={7} fill="#2E3D3D" opacity={0.34} />
        <ellipse cx={257.5} cy={420} rx={49} ry={7} fill="#2E3D3D" opacity={0.34} />
        <ellipse cx={415} cy={421} rx={215} ry={8} fill="#5C7070" opacity={0.14} />

        {/* 车身照片（抠形 + 镜像 + 微浮动）——最后绘制，覆盖轮子上沿 */}
        <g transform={`translate(120 ${(201.7 + bob).toFixed(2)})`}>
          <g transform="scale(0.55)">
            <g transform="translate(1020 0) scale(-1 1)">
              <image
                href={PHOTO}
                width={1020}
                height={460}
                mask="url(#carMask)"
              />
            </g>
          </g>
        </g>

        {/* 旋转轮辋：叠在车身之上，位置随车身一起浮动（bob），转角与滚动距离一致。
            轮拱下缘在 y≈238（照片坐标），轮辋顶在 y≈257，不重叠，所以可以直接盖上去。 */}
        {([[573.75, RIM_F_URI], [257.5, RIM_R_URI]] as const).map(([cx, href], i) => (
          <g key={i} transform={`translate(${cx} ${(376.6 + bob).toFixed(2)}) rotate(${deg.toFixed(1)}) scale(-1 1)`}>
            <image href={href as string}
              x={-RIM_PHOTO_R * 0.55} y={-RIM_PHOTO_R * 0.55}
              width={RIM_PHOTO_R * 1.1} height={RIM_PHOTO_R * 1.1} />
          </g>
        ))}
        {/* 静态高光：照片轮辋自带的高光会跟着转，叠一层不转的穹面反射把它压住，
            否则高速滚动时会出现频闪感。光源固定在左上，与车身照片一致。 */}
        {([573.75, 257.5] as const).map((cx, i) => (
          <circle key={i} cx={cx} cy={376.6 + bob} r={RIM_PHOTO_R * 0.55}
            fill="url(#rimDome)" opacity={0.5} />
        ))}

        {/* 近景飘雪 / 扬沙（车前） */}
        <Snowfall t={t} op={snowOp} n={26} sd={91} big />
        <SandWind t={t} op={sandOp} />

        {/* 尾部扬尘 */}
        <g transform="translate(200 404)">
          {([0, 0.3, 0.6] as const).map((d, i) => {
            const p = sprayDot(d);
            const base = [{r: 4, cx: 0, cy: 0}, {r: 3, cx: 8, cy: 6}, {r: 3.5, cx: -6, cy: 10}][i];
            return (
              <circle
                key={i}
                r={base.r}
                cx={base.cx + p.x}
                cy={base.cy + p.y}
                fill={C.ink3}
                opacity={p.op}
              />
            );
          })}
        </g>

        {/* 抓地标识 */}
        <path d="M228 440 q26 9 52 0" stroke={C.accent} strokeWidth={2.5} fill="none"
          strokeLinecap="round" opacity={gripShow} />
        <path d="M535 440 q26 9 52 0" stroke={C.accent} strokeWidth={2.5} fill="none"
          strokeLinecap="round" opacity={gripShow} />

        {/* 激光雷达识别脉冲 */}
        <path d="M725 305 A 70 70 0 0 1 795 375" stroke={C.accent} strokeWidth={2.5} fill="none" opacity={scanOp(0)} />
        <path d="M725 305 A 105 105 0 0 1 830 410" stroke={C.accent} strokeWidth={2.5} fill="none" opacity={scanOp(0.3)} />
        <path d="M725 305 A 140 140 0 0 1 865 445" stroke={C.accent} strokeWidth={2.5} fill="none" opacity={scanOp(0.6)} />

        {/* 模式徽标：贴在车头上方 */}
        {modeOn && ringK > 0 && (
          <rect
            x={BX - 4} y={BY - 4} width={228} height={40} rx={20}
            fill="none" stroke={C.accent} strokeWidth={2}
            opacity={0.6 * (1 - ringK)}
            transform={`translate(${(BX + 110) * (1 - (1 + 0.18 * ringK))} ${(BY + 16) * (1 - (1 + 0.18 * ringK))}) scale(${1 + 0.18 * ringK})`}
          />
        )}
        <rect x={BX} y={BY} width={220} height={32} rx={16}
          fill={modeOn ? C.accentWash : C.panel}
          stroke={modeOn ? C.accent : C.line} strokeWidth={1.5} />
        <circle cx={BX + 20} cy={BY + 16} r={6} fill={badgeDot} />
        <text x={BX + 36} y={BY + 21} fontSize={14.5} fontWeight={600} fill={modeOn ? C.accent : C.ink2}>
          {badgeTxt}
        </text>

        {/* NOMI 提醒气泡：贴在车顶上方，带指向车身的小尾巴 */}
        {s.bub && bk > 0 && (
          <g
            opacity={Math.min(1, bk * 2)}
            transform={`translate(360 174) scale(${easeOutBack(bk).toFixed(3)})`}
          >
            <rect x={-240} y={-42} width={480} height={84} rx={14}
              fill={C.panel} stroke={C.accent} strokeWidth={2} />
            <path d="M-42 41 L-20 66 L2 41 Z" fill={C.panel} />
            <path d="M-42 41 L-20 66 L2 41" fill="none" stroke={C.accent}
              strokeWidth={2} strokeLinejoin="round" />
            <circle cx={-206} cy={0} r={15} fill={C.nvRoof} />
            <circle cx={-211} cy={-3} r={3} fill={C.accent} />
            <circle cx={-201} cy={-3} r={3} fill={C.accent} />
            <text x={-178} y={-8} fontSize={17} fontWeight={700} fill={C.ink}>{s.bub[0]}</text>
            <text x={-178} y={18} fontSize={14.5} fill={C.ink2}>{s.bub[1]}</text>
            <text x={228} y={30} textAnchor="end" fontSize={10.5} fill={C.accent}
              fontFamily={F_DATA} letterSpacing="0.1em">方向盘按键 · 一键确认</text>
          </g>
        )}

        {/* 完成确认 */}
        {ck > 0 && (
          <g
            opacity={Math.min(1, ck * 2)}
            transform={`translate(500 240) scale(${easeOutBack(ck).toFixed(3)}) translate(-500 -240)`}
          >
            <circle cx={500} cy={240} r={17} fill={C.panel} stroke={C.ok} strokeWidth={2.5} />
            <path d="M492 240 L498 246 L509 234" fill="none" stroke={C.ok}
              strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
      </svg>

      {/* HUD */}
      <div style={{
        position: 'absolute', top: 24, left: 32, right: 32,
        display: 'flex', justifyContent: 'space-between',
        fontFamily: F_DATA, fontSize: 21, letterSpacing: '0.12em', color: C.ink3,
      }}>
        <span>侧视图 · DRIVE VIEW</span>
        <span>
          模式 <b style={{color: C.accent, fontWeight: 600}}>{hudMode}</b>
          {' · '}路面 <b style={{color: C.accent, fontWeight: 600}}>{TERRA[terr].label}</b>
        </span>
      </div>

      {/* 场景标签（开场 3 秒淡入淡出） */}
      <div style={{
        position: 'absolute', top: 24, left: 0, right: 0, display: 'flex', justifyContent: 'center',
        opacity: Math.min(win(t, 0.2, 0.7), 1 - win(t, 3.0, 3.6)),
      }}>
        <span style={{
          fontFamily: F_UI, fontSize: 22, color: C.ink2,
          background: C.panel, border: `1.5px solid ${C.line}`,
          borderRadius: 999, padding: '8px 22px',
        }}>{s.chip}</span>
      </div>

      {/* 字幕卡：紧贴车身下方（不再是底部通栏） */}
      <div style={{
        position: 'absolute', left: 292, top: 856,
        display: 'inline-flex', alignItems: 'center', gap: 20,
        background: 'rgba(255,255,255,.94)',
        border: `1.5px solid ${capDone ? C.ok : C.line}`,
        borderRadius: 14, padding: '13px 24px',
        boxShadow: '0 8px 26px rgba(26,31,31,.12)',
        opacity: capK, transform: `translateY(${(1 - capK) * 10}px)`,
      }}>
        <i style={{
          width: 6, height: 32, borderRadius: 3,
          background: capDone ? C.ok : C.accent, flex: 'none',
        }} />
        <span style={{
          fontSize: 30, fontWeight: 700, letterSpacing: '0.01em', whiteSpace: 'nowrap',
          color: capDone ? C.ok : C.ink,
        }}>
          {s.caps[ph]}
        </span>
        <span style={{display: 'flex', gap: 10, marginLeft: 4}}>
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} style={{
              width: 12, height: 12, borderRadius: '50%',
              background: i <= ph ? C.accent : C.line,
              transform: i === ph ? 'scale(1.3)' : 'none',
            }} />
          ))}
        </span>
      </div>

      {/* 方向盘按键 pill + 涟漪：紧跟字幕卡，贴在车身下方 */}
      <div style={{position: 'absolute', left: 292, top: 946}}>
        <div style={{
          position: 'relative',
          display: 'inline-flex', alignItems: 'center', gap: 14,
          padding: '14px 26px', borderRadius: 999,
          background: 'rgba(255,255,255,.94)',
          border: `1.5px solid ${ph > 0 ? C.accent : C.line}`,
          boxShadow: '0 8px 26px rgba(26,31,31,.12)',
          fontSize: 22, color: ph > 0 ? C.ink : C.ink2,
        }}>
          {rippleK >= 0 && (
            <div style={{
              position: 'absolute', inset: -5, borderRadius: 999,
              border: `3px solid ${C.accent}`,
              opacity: 0.9 * (1 - rippleK),
              transform: `scale(${1 + 0.45 * rippleK})`,
            }} />
          )}
          <i style={{
            width: 14, height: 14, borderRadius: '50%',
            background: ph > 0 ? C.accent : C.ink3,
            boxShadow: ph > 0 ? `0 0 0 5px ${C.accentWash}` : 'none',
          }} />
          {s.pill}
        </div>
      </div>
    </AbsoluteFill>
  );
};
