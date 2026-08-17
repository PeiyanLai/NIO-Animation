// 贴主体信息卡：卡片 + 指向三角 + 虚线引导线 + 端点圆点 + 安全区 clamp + 随主体旋转求落点
//
// 出处：ParkingStage.tsx（HTML 卡片跟随旋转车身）与 PetStage.tsx（SVG 状态卡指向座椅）的公共形态。
//
// 为什么要有这个：用户教育动画最常见的失败不是画得不好看，而是**看的人不知道该往哪儿看**。
// 字幕在底部通栏、读数在右上角、主体在正中间 —— 眼睛要在四个角之间来回跳。
// 规则（SKILL.md「信息展示的位置」）：
//   · 信息一律贴主体的上/下/左/右，间距 24–40 舞台单位，不许丢进画面四角
//   · 每块信息都要有指向关系：朝主体的实心小三角 + 4–6px dash 引导线 + 端点圆点
//   · 主体会动时卡片跟着走，并 clamp 在安全区内；跟不动了让引导线拉长，卡片别出画
//   · 同一屏最多两块贴身信息
//
// 断言配套（assert-timeline.mjs）：卡片矩形与主体外接矩形**不重叠**、四边不出界、
// 不越过场景关键线（车位线/分界线）—— 用 followCardLayout 的返回值直接判。

import React from 'react';
import {NIO} from './colors';

const RAD = Math.PI / 180;
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** 主体位姿：中心 + SVG 呈现角（度） */
export interface Subject {
  x: number;
  y: number;
  th?: number;
  /** 主体未旋转时的外接矩形 */
  w: number;
  h: number;
}

export interface FollowCardOpts {
  subject: Subject;
  /** 卡片尺寸（舞台单位） */
  card: {w: number; h: number};
  /** 贴哪一侧 */
  side: 'left' | 'right' | 'top' | 'bottom';
  /** 卡片与主体旋转后包围盒之间的间距，默认 26 */
  gap?: number;
  /** 安全区：卡片四边必须落在里面 */
  safe: {x0: number; y0: number; x1: number; y1: number};
  /**
   * 关键禁越线（可选）：卡片不许越过的场景线，如车位开口虚线、座舱边界。
   * 语义是「卡片这一边不得超过该值」。
   */
  forbid?: {maxRight?: number; minLeft?: number; maxBottom?: number; minTop?: number};
  /**
   * 引导线落点（主体局部归一化坐标，-0.5 ~ +0.5，随主体旋转）。
   * 默认落在朝向卡片那一侧的边缘中偏后处。
   */
  lead?: {u: number; v: number};
  /** 三角尖沿卡片该边的位置（0=起点端，1=末端），默认 0.2 */
  tipAt?: number;
}

export interface FollowCardGeom {
  left: number;
  right: number;
  top: number;
  bottom: number;
  cx: number;
  cy: number;
  side: FollowCardOpts['side'];
  /** 三角尖端（贴在卡片边框上，指向主体） */
  tip: [number, number];
  /** 三角底边两端（画实心三角用） */
  tipBase: [[number, number], [number, number]];
  /** 引导线落点（主体上的那个部位） */
  lead: [number, number];
  /** 卡片四角（给 SAT 断言用） */
  poly: [number, number][];
}

/** 旋转后包围盒半宽/半高 */
const halfSpan = (thDeg: number, w: number, h: number) => {
  const c = Math.abs(Math.cos(thDeg * RAD)), s = Math.abs(Math.sin(thDeg * RAD));
  return {w: (w * c + h * s) / 2, h: (h * c + w * s) / 2};
};

/**
 * 求卡片落位：贴主体 → clamp 安全区 → 卡关键禁越线 → 求三角尖与引导线落点。
 * 纯几何函数，渲染与断言共用同一份，避免「画对了但断言算的是另一套」。
 */
export function followCardLayout(o: FollowCardOpts): FollowCardGeom {
  const {subject: sub, card, side, safe} = o;
  const gap = o.gap ?? 26;
  const th = sub.th ?? 0;
  const hs = halfSpan(th, sub.w, sub.h);

  // 1) 贴主体
  let cx = sub.x, cy = sub.y;
  if (side === 'left') cx = sub.x - hs.w - gap - card.w / 2;
  if (side === 'right') cx = sub.x + hs.w + gap + card.w / 2;
  if (side === 'top') cy = sub.y - hs.h - gap - card.h / 2;
  if (side === 'bottom') cy = sub.y + hs.h + gap + card.h / 2;

  // 2) clamp 到安全区（跟不动了就让引导线拉长，卡片本身不出画）
  cx = clamp(cx, safe.x0 + card.w / 2, safe.x1 - card.w / 2);
  cy = clamp(cy, safe.y0 + card.h / 2, safe.y1 - card.h / 2);

  // 3) 关键禁越线
  const fb = o.forbid ?? {};
  if (fb.maxRight !== undefined) cx = Math.min(cx, fb.maxRight - card.w / 2);
  if (fb.minLeft !== undefined) cx = Math.max(cx, fb.minLeft + card.w / 2);
  if (fb.maxBottom !== undefined) cy = Math.min(cy, fb.maxBottom - card.h / 2);
  if (fb.minTop !== undefined) cy = Math.max(cy, fb.minTop + card.h / 2);

  const left = cx - card.w / 2, right = cx + card.w / 2;
  const top = cy - card.h / 2, bottom = cy + card.h / 2;

  // 4) 三角尖：贴在朝向主体那条边上
  const tipAt = o.tipAt ?? 0.2;
  const T = 13; // 三角外伸长度
  const B = 9; //  三角底边半长
  let tip: [number, number];
  let tipBase: [[number, number], [number, number]];
  if (side === 'left') {
    const py = top + card.h * tipAt;
    tip = [right + T, py];
    tipBase = [[right, py - B], [right, py + B]];
  } else if (side === 'right') {
    const py = top + card.h * tipAt;
    tip = [left - T, py];
    tipBase = [[left, py - B], [left, py + B]];
  } else if (side === 'top') {
    const px = left + card.w * tipAt;
    tip = [px, bottom + T];
    tipBase = [[px - B, bottom], [px + B, bottom]];
  } else {
    const px = left + card.w * tipAt;
    tip = [px, top - T];
    tipBase = [[px - B, top], [px + B, top]];
  }

  // 5) 引导线落点：主体局部坐标随主体旋转
  //    默认落在**朝向卡片那一侧**的主体边缘（卡片在左 ⇒ 落点在主体左边缘），偏后 0.2 车长
  const d = o.lead ?? {
    left: {u: -0.5, v: 0.2},
    right: {u: 0.5, v: 0.2},
    top: {u: 0, v: -0.5},
    bottom: {u: 0, v: 0.5},
  }[side];
  const c = Math.cos(th * RAD), s = Math.sin(th * RAD);
  const bx = d.u * sub.w, by = d.v * sub.h;
  const lead: [number, number] = [sub.x + bx * c - by * s, sub.y + bx * s + by * c];

  return {
    left, right, top, bottom, cx, cy, side, tip, tipBase, lead,
    poly: [[left, top], [right, top], [right, bottom], [left, bottom]],
  };
}

/**
 * SVG 指向层：虚线引导线 + 端点圆点 + 实心三角。
 * 画在卡片之上、主体之上（否则会被车体挡住）。
 */
export const CardConnector: React.FC<{
  geom: FollowCardGeom;
  color?: string;
  opacity?: number;
  dash?: string;
}> = ({geom, color = NIO.accent, opacity = 0.9, dash = '5 5'}) => (
  <g opacity={opacity}>
    <path
      d={`M${geom.tip[0]} ${geom.tip[1]} L${geom.lead[0].toFixed(2)} ${geom.lead[1].toFixed(2)}`}
      stroke={color} strokeWidth={1.6} strokeDasharray={dash} fill="none"
    />
    <circle cx={geom.lead[0]} cy={geom.lead[1]} r={3.5} fill={color} />
    <path
      d={`M${geom.tipBase[0][0]} ${geom.tipBase[0][1]} L${geom.tip[0]} ${geom.tip[1]} L${geom.tipBase[1][0]} ${geom.tipBase[1][1]} Z`}
      fill={color}
    />
  </g>
);

/**
 * 纯 SVG 卡片外框（想把卡片也画在 SVG 里时用；文字自己往里放）。
 * 好处是跟主体同一坐标系、缩放一致；坏处是排版全靠手算。
 */
export const CardFrame: React.FC<{
  geom: FollowCardGeom;
  color?: string;
  fill?: string;
  radius?: number;
  children?: React.ReactNode;
}> = ({geom, color = NIO.accent, fill = NIO.panel, radius = 14, children}) => (
  <g>
    <rect
      x={geom.left} y={geom.top}
      width={geom.right - geom.left} height={geom.bottom - geom.top}
      rx={radius} fill={fill} stroke={color} strokeWidth={2}
    />
    {children}
  </g>
);

/**
 * HTML 卡片（推荐：排版交给 CSS，中文字重/行高好控制）。
 * scale = 舞台 → CSS 的缩放：{kx: cssW / stageW, ky: cssH / stageH}。
 * 注意 <Player> 的 composition 里 HTML 层与 SVG 层共用同一个 AbsoluteFill，
 * 所以卡片用 HTML、指向线用 SVG（CardConnector）是可以混搭的。
 */
export const FollowCard: React.FC<{
  geom: FollowCardGeom;
  scale: {kx: number; ky: number};
  color?: string;
  padding?: string;
  radius?: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({geom, scale, color = NIO.accent, padding = '20px 26px 22px', radius = 20, style, children}) => (
  <div
    style={{
      position: 'absolute',
      left: geom.left * scale.kx,
      top: geom.top * scale.ky,
      width: (geom.right - geom.left) * scale.kx,
      boxSizing: 'border-box',
      background: NIO.panel,
      border: `1.5px solid ${color}`,
      borderRadius: radius,
      padding,
      boxShadow: '0 10px 28px rgba(92,112,112,0.16)',
      ...style,
    }}
  >
    {children}
  </div>
);

/**
 * 常用卡片内容件：进度点（第 i / n 步）。
 * 放在卡片底部，比在画面角落放进度条更容易被看到。
 */
export const StepDots: React.FC<{n: number; i: number; color?: string; size?: number}> = ({
  n, i, color = NIO.accent, size = 12,
}) => (
  <div style={{display: 'flex', gap: size - 1, marginTop: 18}}>
    {Array.from({length: n}, (_, k) => (
      <span key={k} style={{
        width: size, height: size, borderRadius: '50%',
        background: k <= i ? color : NIO.line,
        transform: k === i ? 'scale(1.25)' : 'none',
      }} />
    ))}
  </div>
);
