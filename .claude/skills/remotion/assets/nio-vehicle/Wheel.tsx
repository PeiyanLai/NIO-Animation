// ES9「大饼轮毂」矢量车轮（来自全地形动画 remotion-terrain/src/Stage.tsx）
//
// 关键识别特征：整块高抛光实心盘面 + **9 个等分 40°** 的四边形镂空。
// 数量和孔形是可信度来源——不是「一圈孔」，不是水滴孔，是沿轮毂轮廓走的四边形：
//   外缘 = 一段贴着轮辋走的同心圆弧（最宽的一条边）
//   内缘 = 一段更短的同心圆弧，靠近中心盖
//   两侧 = 近乎直线，从外缘两端收到内缘两端
//   四角 = 极小倒角，保持四边形的硬朗棱角
//
// ─── 硬性约束 ─────────────────────────────────────────────────────────────
// 1. **自身坐标系固定**：轮胎外圈 r=100（275/40R23 胎面），轮辋 r=73（23"，比值 0.727）。
//    要多大就在外面套 `scale(k)`，**不要改这里的半径**，否则胎壁比例就错了。
// 2. **高光必须画在 rotate 组之外**（WheelGloss 是最后一层）：光源固定不跟着轮子转，
//    转起来才像抛光金属；画进旋转组里会变成「贴纸在转」。
// 3. 孔用 `<mask id="rimHoles">` 做成**真镂空**，透出下层轮腔/制动盘/卡钳，
//    转起来才看得出在转（实心画个深色多边形是看不出转的）。
// 4. **必须先把 <WheelDefs/> 塞进自己的 <defs>**，否则 url(#rimFace) 等引用会失效。
//    ID 是固定的 `rimFace` / `rimDome` / `rimHoles`——同页面别再定义同名 ID。
//
// 用法：
// ```tsx
// <defs><WheelDefs /></defs>
// <g transform={`translate(${cx} ${cy}) scale(${k})`}>
//   <WheelTire />
//   <g transform={`rotate(${deg})`}><WheelSpokes /></g>
//   <WheelGloss />
// </g>
// ```
// 或直接用 <ES9Wheel cx={573.2} cy={376.6} scale={0.407} deg={deg} />

import React from 'react';
import {NIO} from './colors';

// ─── 几何常量（实拍量得，不要凭手感改） ──────────────────────────────────
export const R_FACE = 69; //   盘面外缘（r=73 轮辋内，留 4 单位暗色轮辋唇）
export const R_HOLE_O = 65; // 孔外缘圆弧半径 = 0.95 R_FACE
export const R_HOLE_I = 48; // 孔内缘圆弧半径 = 0.70 R_FACE（孔宽/孔长 ≈ 1.7，又矮又胖）
export const A_HOLE_O = 12.8; // 外缘半角 → 25.6° 镂空 / 14.4° 盘面桥（40° 一格）
export const A_HOLE_I = 8.6; //  内缘半角 → 内缘弦长 / 外缘弦长 = 0.50
export const HOLE_TILT = 2.5; // 内缘相对外缘的切向偏移（实拍约 2.6°，轻微涡轮感）
export const HOLE_R = 2.4; //    四角倒角：沿两条边各回退的长度（等效圆角半径 ≈ 2）
export const HOLE_COUNT = 9; //  ⚠️ 换车型时先数清楚孔数再改
export const TIRE_R = 100; //    胎面外圈（自身坐标系）
export const RIM_R = 73; //      轮辋外圈 = TIRE_R × 0.727

type Pt = [number, number];
const pol = (r: number, d: number): Pt => {
  const a = ((d - 90) * Math.PI) / 180;
  return [r * Math.cos(a), r * Math.sin(a)];
};
const S = (p: Pt) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
/** 从 a 沿 a→b 方向前进 dist 个单位（把尖角回退成小倒角） */
const along = (a: Pt, b: Pt, dist: number): Pt => {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [a[0] + ((b[0] - a[0]) * dist) / L, a[1] + ((b[1] - a[1]) * dist) / L];
};
const DEG = 180 / Math.PI;

/** 单个孔：外缘弧（贴轮辋）→ 顺时针侧边 → 内缘弧 → 逆时针侧边，四角小倒角 */
export const holePath = (deg: number) => {
  const oL = deg - A_HOLE_O; // 外缘逆时针端
  const oR = deg + A_HOLE_O; // 外缘顺时针端
  const iL = deg + HOLE_TILT - A_HOLE_I; // 内缘逆时针端
  const iR = deg + HOLE_TILT + A_HOLE_I; // 内缘顺时针端
  const dO = (HOLE_R / R_HOLE_O) * DEG; // 外弧上的回退角
  const dI = (HOLE_R / R_HOLE_I) * DEG; // 内弧上的回退角

  const CoL = pol(R_HOLE_O, oL); // 四个尖角（倒角的控制点）
  const CoR = pol(R_HOLE_O, oR);
  const CiR = pol(R_HOLE_I, iR);
  const CiL = pol(R_HOLE_I, iL);

  const arcO0 = pol(R_HOLE_O, oL + dO); // 外缘弧起止
  const arcO1 = pol(R_HOLE_O, oR - dO);
  const arcI0 = pol(R_HOLE_I, iR - dI); // 内缘弧起止（反向走）
  const arcI1 = pol(R_HOLE_I, iL + dI);

  const sR0 = along(CoR, CiR, HOLE_R); // 顺时针侧边两端
  const sR1 = along(CiR, CoR, HOLE_R);
  const sL0 = along(CiL, CoL, HOLE_R); // 逆时针侧边两端
  const sL1 = along(CoL, CiL, HOLE_R);

  return (
    `M${S(arcO0)}` +
    ` A${R_HOLE_O} ${R_HOLE_O} 0 0 1 ${S(arcO1)}` + // 外缘：沿轮辋的圆弧
    ` Q${S(CoR)} ${S(sR0)}` +
    ` L${S(sR1)}` + //                                 顺时针侧边（直线）
    ` Q${S(CiR)} ${S(arcI0)}` +
    ` A${R_HOLE_I} ${R_HOLE_I} 0 0 0 ${S(arcI1)}` + // 内缘：同心短弧
    ` Q${S(CiL)} ${S(sL0)}` +
    ` L${S(sL1)}` + //                                 逆时针侧边（直线）
    ` Q${S(CoL)} ${S(arcO0)} Z`
  );
};

/** 9 个孔，等分 40° */
export const RIM_HOLES = Array.from({length: HOLE_COUNT}, (_, i) =>
  holePath((i * 360) / HOLE_COUNT),
);

/**
 * 车轮依赖的 <defs> 内容：抛光盘面渐变 + 穹面高光渐变 + 9 孔镂空 mask。
 * 使用方只要 `<defs><WheelDefs /></defs>`，其余组件就能直接用。
 */
export const WheelDefs: React.FC = () => (
  <>
    <radialGradient id="rimFace" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stopColor={NIO.rimHighlight} />
      <stop offset="50%" stopColor={NIO.stageBg} />
      <stop offset="82%" stopColor={NIO.accentDim} />
      <stop offset="100%" stopColor={NIO.ink4} />
    </radialGradient>
    <radialGradient id="rimDome" cx="36%" cy="28%" r="80%">
      <stop offset="0%" stopColor={NIO.white} stopOpacity="0.42" />
      <stop offset="46%" stopColor={NIO.white} stopOpacity="0.04" />
      <stop offset="100%" stopColor={NIO.ink2} stopOpacity="0.26" />
    </radialGradient>
    <mask id="rimHoles" maskUnits="userSpaceOnUse" x={-90} y={-90} width={180} height={180}>
      <circle r={R_FACE + 1} fill="#fff" />
      {RIM_HOLES.map((d, i) => (
        <path key={i} d={d} fill="#000" />
      ))}
    </mask>
  </>
);

/** 静态层：胎圈 + 暗色轮辋唇 + 孔内可见的轮腔 / 制动盘 / 卡钳（**不随轮转动**） */
export const WheelTire: React.FC = () => (
  <g>
    <circle r={104} fill="#0B0D10" opacity={0.4} />
    <circle r={TIRE_R} fill={NIO.tireBlack} />
    <circle r={TIRE_R} fill="none" stroke={NIO.tireEdge} strokeWidth={3} />
    <circle r={RIM_R} fill={NIO.rimLip} />
    <circle r={70} fill={NIO.ink} />
    <circle r={51} fill="none" stroke="#2B3838" strokeWidth={24} />
    <circle r={51} fill="none" stroke="#41595A" strokeWidth={1.4} opacity={0.75} />
    {/* 卡钳 */}
    <path d="M-50 16 A52 52 0 0 0 -16 50" fill="none" stroke={NIO.caliper}
      strokeWidth={17} strokeLinecap="round" />
    <circle r={26} fill="#202B2A" />
  </g>
);

/** 旋转层：抛光盘面（被 9 孔 mask 镂空）+ 孔缘倒角 + 中心盖。**包一层 rotate 用** */
export const WheelSpokes: React.FC = () => (
  <g>
    <g mask="url(#rimHoles)">
      <circle r={R_FACE} fill="url(#rimFace)" />
      <circle r={R_FACE - 1.8} fill="none" stroke={NIO.rimHighlight} strokeWidth={2.2} opacity={0.9} />
      <circle r={R_HOLE_I - 4} fill="none" stroke={NIO.white} strokeWidth={1.3} opacity={0.45} />
    </g>
    {/* 孔缘：暗色凹陷 + 亮银倒角高光 */}
    {RIM_HOLES.map((d, i) => (
      <g key={i}>
        <path d={d} fill="none" stroke={NIO.ink2} strokeWidth={3} opacity={0.55} />
        <path d={d} fill="none" stroke={NIO.rimHighlight} strokeWidth={1.2} opacity={0.85} />
      </g>
    ))}
    {/* 中心盖：细暗环 + 浅色盘底 + 简化 logo */}
    <circle r={20} fill="none" stroke={NIO.ink2} strokeWidth={1.3} opacity={0.75} />
    <circle r={17} fill="url(#rimFace)" opacity={0.9} />
    <circle r={9.6} fill={NIO.ink} stroke={NIO.rimSilver} strokeWidth={0.9} />
    <path d="M-4.6 -0.6 A5.2 5.2 0 0 1 4.6 -0.6" fill="none" stroke={NIO.rimHighlight}
      strokeWidth={1.7} strokeLinecap="round" />
    <path d="M-4 2.2 L4 2.2 L1.7 6.2 L-1.7 6.2 Z" fill={NIO.rimHighlight} />
  </g>
);

/** 静态高光：抛光盘的穹面反射。**必须在 rotate 组之外**，光源才是固定的 */
export const WheelGloss: React.FC = () => <circle r={R_FACE} fill="url(#rimDome)" />;

/**
 * 一整个车轮（三层已按正确顺序拼好）。
 * cx/cy = 轮心舞台坐标；scale = 舞台胎半径 / 100；deg = 当前转角。
 */
export const ES9Wheel: React.FC<{cx: number; cy: number; scale: number; deg: number}> = ({
  cx, cy, scale, deg,
}) => (
  <g transform={`translate(${cx} ${cy}) scale(${scale})`}>
    <WheelTire />
    <g transform={`rotate(${deg.toFixed(1)})`}>
      <WheelSpokes />
    </g>
    <WheelGloss />
  </g>
);
