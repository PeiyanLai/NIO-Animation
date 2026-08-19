// 灵动宠物包 · 四章舞台（1000×560）
//
// 视角 A 座舱俯视平面（第 1、3 章）：ES8 全舱俯视实拍打底（标定见 PLAN_PHOTO）。
// 视角 B 前排实拍舞台（第 1、2、4 章）：ES8 前排照片当舞台，
//   固定接口/栓扣/按键等机构直接画在照片岛台上（相机标定见 SIDE_CAM）。
// 猫为真实照片剪纸动效（PetsPhoto）。
// 所有位置只依赖当前秒数，与 bag-data.ts 的纯函数一一对应，禁止 Math.random。

import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {CatTop} from './Cat';
import {NioLogo} from './NioLogo';
import {PhotoCat} from './PetsPhoto';
import {ES8_CABIN_SIDE_URI, ES8_CABIN_TOP_URI} from './es8-cabin-photo';
import {
  BAG, BAG_PLAN, BODY, BUTTON, CABIN, CANOPY, CANOPY_PLAN, CAT, CAT_GROUND_Y,
  DASH, ISL, ISLAND_TOP, LATCH_TRAVEL, LATCH_X, LEVELS,
  LID_LEN, LID_TH, PAD_PLAN, PLAN, PLAN_PHOTO, REACH_CLIP, REACH_R,
  ROW_Y, SEAT_X, SECTORS, SIDE_XF, SLOT_W, TETHER,
  BAG_SCENES, F_DATA, F_UI, T_COLORS as C, bagBottom, bagOp, buttonAt, canopyDeg,
  cardAnchorScreen, cardsAt, catAt, catClip, catPhotoXf, handAt, latchAt, levelK,
  phaseOf, phaseStart,
  SEAT_OCC_POLY,
  planPt, planXfStr, reachK, roadPhase, stateAt, steerDeg, tetherAt, viewAt, win,
  type BagKey, type Card, type Pt,
} from './bag-data';

const N = (v: number) => (Math.round(v * 100) / 100).toString();
const TONE = {accent: C.accent, ok: C.ok, warn: C.warn, ink: C.ink3} as const;

/** CJK 友好换行：中文按 1 单位、ASCII 按 0.55 单位计宽 */
const wrapCJK = (s: string, maxUnits: number): string[] => {
  const out: string[] = [];
  let cur = '', w = 0;
  for (const ch of s) {
    const u = ch.charCodeAt(0) < 0x2e80 ? 0.55 : 1;
    if (w + u > maxUnits && cur) {out.push(cur); cur = ''; w = 0;}
    cur += ch; w += u;
  }
  if (cur) out.push(cur);
  return out;
};

/* ═══ 贴主体信息卡（卡片 + 指向三角 + 虚线引导线 + 端点圆点）═══════════ */
const InfoCard: React.FC<{c: Card; anchor: Pt; ph: number; nph: number}> = ({c, anchor, ph, nph}) => {
  if (c.op <= 0.01) return null;
  const tone = TONE[c.tone];
  const pad = 16;
  const mid = {
    left: {x: c.x, y: c.y + c.h * 0.5},
    right: {x: c.x + c.w, y: c.y + c.h * 0.5},
    top: {x: c.x + c.w * 0.5, y: c.y},
    bottom: {x: c.x + c.w * 0.5, y: c.y + c.h},
  }[c.edge];
  const tri = c.edge === 'left'
    ? `M${N(mid.x)} ${N(mid.y - 9)}L${N(mid.x - 13)} ${N(mid.y)}L${N(mid.x)} ${N(mid.y + 9)}Z`
    : c.edge === 'right'
      ? `M${N(mid.x)} ${N(mid.y - 9)}L${N(mid.x + 13)} ${N(mid.y)}L${N(mid.x)} ${N(mid.y + 9)}Z`
      : c.edge === 'top'
        ? `M${N(mid.x - 9)} ${N(mid.y)}L${N(mid.x)} ${N(mid.y - 13)}L${N(mid.x + 9)} ${N(mid.y)}Z`
        : `M${N(mid.x - 9)} ${N(mid.y)}L${N(mid.x)} ${N(mid.y + 13)}L${N(mid.x + 9)} ${N(mid.y)}Z`;

  const body = c.big
    ? wrapCJK(c.lines[0], (c.w - pad * 2) / 17)
    : c.lines.flatMap((l) => wrapCJK(l, (c.w - pad * 2) / 14));

  return (
    <g opacity={c.op}>
      <line x1={mid.x} y1={mid.y} x2={anchor.x} y2={anchor.y} stroke={tone}
        strokeWidth={1.5} strokeDasharray="5 5" />
      <circle cx={anchor.x} cy={anchor.y} r={3.6} fill={tone} />
      <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={14} fill={C.panel}
        stroke={tone} strokeWidth={1.6} />
      <path d={tri} fill={tone} />
      {c.kicker && (
        <text x={c.x + pad} y={c.y + 22} fontFamily={F_UI} fontSize={13} fill={C.ink3}>
          {c.kicker}
        </text>
      )}
      {c.big && (
        <text x={c.x + c.w - pad} y={c.y + 22} textAnchor="end" fontFamily={F_DATA}
          fontSize={12.5} fill={C.ink4} letterSpacing="0.08em">
          {`${String(ph + 1).padStart(2, '0')} / 0${nph}`}
        </text>
      )}
      {body.map((l, i) => (
        <text key={i} x={c.x + pad}
          y={c.y + (c.kicker ? 48 : 34) + i * (c.big ? 23 : 20)}
          fontFamily={F_UI} fontSize={c.big ? 17 : 14}
          fontWeight={c.big ? 700 : 500} fill={c.big ? C.ink : C.ink2}>
          {l}
        </text>
      ))}
      {c.big && (
        <g>
          {Array.from({length: nph}, (_, i) => (
            <circle key={i} cx={c.x + pad + 6 + i * 15} cy={c.y + c.h - 15} r={i === ph ? 5.4 : 4.2}
              fill={i <= ph ? tone : C.line} />
          ))}
        </g>
      )}
    </g>
  );
};

/* ═══ 座舱俯视平面（视角 A）══════════════════════════════════════════════ */
const Seat: React.FC<{cx: number; yH: number; w: number; l: number; bench?: boolean}> =
  ({cx, yH, w, l, bench}) => {
    const x0 = cx - w / 2;
    return (
      <g>
        {/* 坐垫（向车头方向伸出） */}
        <rect x={x0} y={yH - l * 0.62} width={w} height={l * 0.8} rx={bench ? 10 : 13}
          fill={C.panel} stroke={C.ink4} strokeWidth={1.3} />
        {/* 靠背 */}
        <rect x={x0 - 1.5} y={yH + l * 0.18} width={w + 3} height={l * 0.34} rx={11}
          fill={C.accentWash} stroke={C.ink4} strokeWidth={1.3} />
        {/* 头枕 */}
        <rect x={cx - w * 0.27} y={yH + l * 0.4} width={w * 0.54} height={l * 0.22} rx={8}
          fill={C.accentDim} stroke={C.ink4} strokeWidth={1.2} />
        {/* 侧翼 */}
        {!bench && (
          <>
            <rect x={x0} y={yH - l * 0.5} width={w * 0.16} height={l * 0.6} rx={7}
              fill={C.lineSoft} stroke={C.ink4} strokeWidth={1} />
            <rect x={x0 + w * 0.84} y={yH - l * 0.5} width={w * 0.16} height={l * 0.6} rx={7}
              fill={C.lineSoft} stroke={C.ink4} strokeWidth={1} />
          </>
        )}
      </g>
    );
  };

const Occupant: React.FC<{cx: number; yH: number; sh: Pt; k: number}> = ({cx, yH, sh, k}) => (
  <g opacity={0.95}>
    <rect x={cx - 24} y={yH - 20} width={48} height={17} rx={8.5} fill={C.ink4} opacity={0.3} />
    <circle cx={cx} cy={yH - 24} r={8.4} fill={C.ink3} opacity={0.72} />
    {k > 0.01 && <circle cx={sh.x} cy={sh.y} r={4.6} fill={C.accent} opacity={k} />}
  </g>
);

const PlanView: React.FC<{scene: BagKey; t: number; op: number}> = ({scene, t, op}) => {
  if (op <= 0.01) return null;
  const uid = `p-${scene}`;
  const s = BAG_SCENES[scene];
  const ph = phaseOf(s, t);
  const c3 = scene === 'c3';
  const padHL = scene === 'c1'
    ? 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(t * 3.1))
    : 0.14;
  const canOpen = c3 ? canopyDeg(scene, t) / CANOPY.openDeg : 0;
  const rk = reachK(scene, t);
  const cat = catAt(scene, t);
  const steer = c3 ? steerDeg(t) : 0;
  const flow = c3 ? roadPhase(t) : 0;

  // 敞篷（俯视投影）：绕包体**车尾**沿翻起，投影长度 = len·cos θ（θ>90° 后翻到车尾侧）
  const th = (Math.abs(CANOPY.openDeg) * canOpen * Math.PI) / 180;
  const lidProj = CANOPY_PLAN.len * Math.cos(th);

  return (
    <g opacity={op}>
      {/* 路面流动：车头朝上，路面向后（+y）流 */}
      {c3 && [322, 618].map((x) => (
        <g key={x} opacity={0.4}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <rect key={i} x={x} y={-20 + i * 68 + flow * 2} width={6} height={30} rx={3}
              fill={C.accentDim} />
          ))}
        </g>
      ))}

      {/* 车身外廓（去顶俯视）+ 接地投影 */}
      <ellipse cx={(BODY.x0 + BODY.x1) / 2} cy={BODY.y1 - 6} rx={(BODY.x1 - BODY.x0) / 2 + 8}
        ry={16} fill="#5C7070" opacity={0.16} />
      <rect x={BODY.x0} y={BODY.y0} width={BODY.x1 - BODY.x0} height={BODY.y1 - BODY.y0}
        rx={54} fill={C.panel} stroke={C.ink3} strokeWidth={2.2} />
      {/* 前风挡（去顶后能看到的前部） */}
      <path d={`M${BODY.x0 + 8} ${DASH.y0}L${BODY.x0 + 20} ${BODY.y0 + 20}
        Q${(BODY.x0 + BODY.x1) / 2} ${BODY.y0 + 4} ${BODY.x1 - 20} ${BODY.y0 + 20}L${BODY.x1 - 8} ${DASH.y0}Z`}
        fill={C.lineSoft} stroke={C.line} strokeWidth={1.4} />

      {/* 座舱：ES8 全舱俯视实拍打底（仪表台/方向盘/座椅/岛台全在照片里，
          不再叠矢量仪表台与座椅——照片是真车，矢量画上去是第二套现实）。
          裁进圆角矩形，挡掉照片四周的暗色车身 */}
      <clipPath id={`cab-${uid}`}>
        <rect x={CABIN.x0 - 6} y={60} width={CABIN.x1 - CABIN.x0 + 12} height={CABIN.y1 - 60}
          rx={24} />
      </clipPath>
      <g clipPath={`url(#cab-${uid})`}>
        <image href={ES8_CABIN_TOP_URI} x={PLAN_PHOTO.tx} y={PLAN_PHOTO.ty}
          width={PLAN_PHOTO.w * PLAN_PHOTO.s} height={PLAN_PHOTO.h * PLAN_PHOTO.s} />
      </g>

      {c3 && (
        <g opacity={0.9}>
          <circle cx={SEAT_X.l - 44} cy={28} r={3.4} fill={C.ok}
            opacity={0.45 + 0.45 * Math.sin(t * 4.2)} />
          <text x={SEAT_X.l - 36} y={32} fontFamily={F_DATA} fontSize={10.5}
            fill={C.ink3}>行驶中 · 60 km/h</text>
        </g>
      )}

      {/* 前排乘员（肩点 = 可及扇形圆心）——叠在照片座椅上的人员标记 */}
      <Occupant cx={SEAT_X.l} yH={ROW_Y[0]} sh={SECTORS[0].c} k={rk} />
      <Occupant cx={SEAT_X.r} yH={ROW_Y[0]} sh={SECTORS[1].c} k={rk} />

      {/* 岛台软包段高亮（照片上的放包位置指引；照片本身已有真岛台，只叠指引） */}
      <rect x={ISL.x0 + 2} y={PAD_PLAN.y0} width={ISL.x1 - ISL.x0 - 4}
        height={PAD_PLAN.y1 - PAD_PLAN.y0} rx={9}
        fill={C.accentWash} stroke={C.accent} strokeWidth={1.6} opacity={padHL} />

      {/* 第一章：「包放这里」落位指引 */}
      {scene === 'c1' && (
        <g opacity={win(t, 0.9, 1.4) * (1 - win(t, 2.9, 3.3))}>
          <rect x={BAG_PLAN.x} y={BAG_PLAN.y} width={BAG_PLAN.w} height={BAG_PLAN.h} rx={9}
            fill="none" stroke={C.accent} strokeWidth={2} strokeDasharray="7 6" />
          {[0, 1].map((i) => (
            <path key={i}
              d={`M${PLAN.cx - 11} ${BAG_PLAN.y - 30 + i * 11 + (t * 26) % 11}l11 9l11 -9`}
              fill="none" stroke={C.accent} strokeWidth={2.4} strokeLinecap="round"
              strokeLinejoin="round" opacity={0.75 - i * 0.3} />
          ))}
        </g>
      )}

      {/* 第三章：宠物包（俯视）+ 敞篷翻开 + 猫头 */}
      {c3 && (
        <g>
          <rect x={BAG_PLAN.x + 3} y={BAG_PLAN.y + 4} width={BAG_PLAN.w} height={BAG_PLAN.h}
            rx={10} fill="#5C7070" opacity={0.16} />
          <rect x={BAG_PLAN.x - 5} y={BAG_PLAN.y - 3} width={BAG_PLAN.w + 10}
            height={BAG_PLAN.h + 6} rx={12} fill={C.accentDim} opacity={0.55} />
          <rect x={BAG_PLAN.x} y={BAG_PLAN.y} width={BAG_PLAN.w} height={BAG_PLAN.h} rx={10}
            fill={C.panel} stroke={C.ink2} strokeWidth={2.4} />
          {/* 包内（敞篷打开后看得见） */}
          <rect x={BAG_PLAN.x + 5} y={BAG_PLAN.y + 5} width={BAG_PLAN.w - 10}
            height={CANOPY_PLAN.hingeY - BAG_PLAN.y - 7} rx={7}
            fill={C.lineSoft} stroke={C.line} strokeWidth={1} opacity={canOpen} />
          {canOpen > 0.35 && (
            <g transform={`translate(${PLAN.cx} ${BAG_PLAN.y + BAG_PLAN.h * 0.46})`}
              opacity={(canOpen - 0.35) / 0.65}>
              <CatTop t={t} r={12.4} />
            </g>
          )}
          {/* 敞篷盖板：绕车尾沿翻起，俯视里投影长度 = len·cosθ；翻过 90° 后落到车尾侧 */}
          <rect x={BAG_PLAN.x + 2} y={lidProj >= 0 ? CANOPY_PLAN.hingeY - lidProj : CANOPY_PLAN.hingeY}
            width={BAG_PLAN.w - 4} height={Math.max(2.5, Math.abs(lidProj))} rx={7}
            fill={lidProj >= 0 ? C.accentWash : C.accentDim}
            stroke={C.ink3} strokeWidth={1.5} />
          <line x1={BAG_PLAN.x + 2} y1={CANOPY_PLAN.hingeY} x2={BAG_PLAN.x + BAG_PLAN.w - 2}
            y2={CANOPY_PLAN.hingeY} stroke={C.ink2} strokeWidth={2} />
        </g>
      )}

      {/* 第三章：主副驾可及扇形（实际臂展范围，裁到座舱内） */}
      {c3 && rk > 0.01 && (
        <g>
          <defs>
            <clipPath id={`cab-${uid}`}>
              <rect x={CABIN.x0} y={CABIN.y0 - 30} width={CABIN.x1 - CABIN.x0}
                height={CABIN.y1 - CABIN.y0 + 30} rx={22} />
            </clipPath>
          </defs>
          <g clipPath={`url(#cab-${uid})`}>
            {SECTORS.map((sec, i) => {
              const mid = (sec.a0 + sec.a1) / 2, half = ((sec.a1 - sec.a0) / 2) * rk;
              const a0 = (mid - half) * Math.PI / 180, a1 = (mid + half) * Math.PI / 180;
              const p0 = {x: sec.c.x + REACH_R * Math.cos(a0), y: sec.c.y + REACH_R * Math.sin(a0)};
              const p1 = {x: sec.c.x + REACH_R * Math.cos(a1), y: sec.c.y + REACH_R * Math.sin(a1)};
              return (
                <g key={sec.id}>
                  <path d={`M${N(sec.c.x)} ${N(sec.c.y)}L${N(p0.x)} ${N(p0.y)}A${N(REACH_R)} ${N(REACH_R)} 0 ${half > 90 ? 1 : 0} 1 ${N(p1.x)} ${N(p1.y)}Z`}
                    fill={i === 0 ? C.accent : C.ok} fillOpacity={0.14}
                    stroke={i === 0 ? C.accent : C.ok} strokeWidth={2} strokeDasharray="7 5" />
                </g>
              );
            })}
          </g>
        </g>
      )}

      {/* 第三章：三级固定的三条指向线（端点落在各自部位上） */}
      {c3 && LEVELS.map((l, i) => {
        const k = levelK(scene, t, i);
        if (k <= 0.01) return null;
        return (
          <g key={l.id} opacity={k}>
            <circle cx={l.at.x} cy={l.at.y} r={4.4} fill="none" stroke={C.accent} strokeWidth={1.8} />
            <circle cx={l.at.x} cy={l.at.y} r={1.8} fill={C.accent} />
          </g>
        );
      })}
    </g>
  );
};

/* ═══ 前排实拍舞台（视角 B）══════════════════════════════════════════════ */
/**
 * 包壳配色：**跟座舱内饰走**（用户定的硬规则：车内物件必须适配内饰配色）。
 * ES8 前排是米白/浅驼 + 深棕点缀，包体取同族暖色；
 * 主题色 teal 只留给「指引/状态」这类 UI 标注,不上包体。
 */
const BAGC = {
  shell: '#F5EFE4', edge: '#5C4E3D',
  inner0: '#F4ECDE', inner1: '#DFD0B9', inner2: '#BCA684',
  cushion: '#EADCC4', cushionEdge: '#C9B58F',
  band: '#DACAAE', lid: '#F1E9DA', lidInner: '#DBCBAF',
  handle: '#71604C', vent: '#EFE5D2', ventEdge: '#B1A07F',
  latch: '#6B5B47',
};
/** 包壳剖面轮廓：高墙在**车尾侧（右）**，舀口开向**车头（左）**——猫头朝车头 */
const bagShell = (X: number, Y: number, W: number, H: number, rim: number) =>
  `M${N(X)} ${N(Y - 10)}L${N(X)} ${N(rim - 26)}` +
  `C${N(X)} ${N(rim - 14)} ${N(X + W * 0.03)} ${N(rim)} ${N(X + W * 0.1)} ${N(rim)}` +
  `L${N(X + W * 0.55)} ${N(rim)}` +
  `C${N(X + W * 0.66)} ${N(rim)} ${N(X + W * 0.67)} ${N(Y - H)} ${N(X + W * 0.78)} ${N(Y - H)}` +
  `L${N(X + W - 12)} ${N(Y - H)}Q${N(X + W)} ${N(Y - H)} ${N(X + W)} ${N(Y - H + 12)}` +
  `L${N(X + W)} ${N(Y - 10)}Q${N(X + W)} ${N(Y)} ${N(X + W - 10)} ${N(Y)}` +
  `L${N(X + 10)} ${N(Y)}Q${N(X)} ${N(Y)} ${N(X)} ${N(Y - 10)}Z`;

const Hand: React.FC<{kind: 'grip' | 'press' | 'finger'; x: number; y: number; rot: number; op: number}> =
  ({kind, x, y, rot, op}) => {
    const skin = '#F2E7D8';
    return (
      <g opacity={op} transform={`translate(${N(x)} ${N(y)}) rotate(${N(rot)})`}>
        {kind === 'press' && (
          <g>
            <path d="M-30 -6 Q-32 -34 -12 -36 L20 -36 Q34 -34 34 -14 L34 8 Q34 22 18 22 L-12 22 Q-30 22 -30 -6Z"
              fill={skin} stroke={C.ink3} strokeWidth={1.6} strokeLinejoin="round" />
            {[-18, -6, 6, 18].map((dx, i) => (
              <rect key={i} x={dx - 4.6} y={6 - i * 0} width={9.2} height={20 - Math.abs(dx) * 0.22}
                rx={4.6} fill={skin} stroke={C.ink3} strokeWidth={1.4} />
            ))}
          </g>
        )}
        {kind === 'grip' && (
          <g>
            <path d="M-24 -10 Q-26 -30 -6 -30 L18 -30 Q30 -28 30 -12 L30 10 Q30 22 14 22 L-8 22 Q-24 22 -24 -10Z"
              fill={skin} stroke={C.ink3} strokeWidth={1.6} strokeLinejoin="round" />
            {[-12, -1, 10, 20].map((dy, i) => (
              <rect key={i} x={-22} y={dy - 4} width={26 - i * 1.5} height={8.4} rx={4.2}
                fill={skin} stroke={C.ink3} strokeWidth={1.3} />
            ))}
          </g>
        )}
        {kind === 'finger' && (
          <g>
            <path d="M-46 -4 Q-50 -26 -28 -26 L-6 -26 Q4 -24 4 -12 L4 6 Q4 20 -14 20 L-32 20 Q-46 20 -46 -4Z"
              fill={skin} stroke={C.ink3} strokeWidth={1.6} strokeLinejoin="round" />
            <rect x={-8} y={-8} width={26} height={11} rx={5.5} fill={skin}
              stroke={C.ink3} strokeWidth={1.5} />
          </g>
        )}
      </g>
    );
  };

const SideView: React.FC<{scene: BagKey; t: number; op: number; settle: number}> =
  ({scene, t, op, settle}) => {
    if (op <= 0.01) return null;
    const uid = `s-${scene}`;
    const st = stateAt(scene, t);
    const bagY = bagBottom(scene, t);
    const bagT = bagY - BAG.h;
    const rim = bagY - BAG.h * 0.79;
    const bOp = bagOp(scene, t);
    const lat = latchAt(scene, t);
    const deg = canopyDeg(scene, t);
    const openK = deg / CANOPY.openDeg;
    const cat = catAt(scene, t);
    const tv = tetherAt(scene, t);
    const hand = handAt(scene, t);
    const btn = buttonAt(scene, t);
    const lifted = Math.max(0, ISLAND_TOP - bagY);
    const hingeNow = {x: CANOPY.hinge.x, y: bagT};
    const clipP = catClip(cat.pose, cat.x0);
    const arcOp = scene === 'c2' ? win(t, 7.3, 7.9) : 0;
    const tautK = scene === 'c2'
      ? Math.max(0, 1 - (TETHER.len - Math.hypot(clipP.x - TETHER.anchor.x, clipP.y - TETHER.anchor.y)) / 8)
      : 0;

    const world = (
      <g transform={SIDE_XF}>
          <defs>
            <linearGradient id={`inner-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BAGC.inner0} />
              <stop offset="62%" stopColor={BAGC.inner1} />
              <stop offset="100%" stopColor={BAGC.inner2} />
            </linearGradient>
            <clipPath id={`bagIn-${uid}`}>
              <path d={bagShell(BAG.x + 4, bagY - 4, BAG.w - 8, BAG.h - 8, rim + 4)} />
            </clipPath>
            <clipPath id={`reach-${uid}`}>
              <rect x={REACH_CLIP.x0} y={REACH_CLIP.y0} width={REACH_CLIP.x1 - REACH_CLIP.x0}
                height={REACH_CLIP.y1 - REACH_CLIP.y0} />
            </clipPath>
          </defs>

          {/* 岛台/地板/座舱全部由照片承担，矢量只画「机构」：固定点插槽（照片台面上的概念接口） */}
          {LATCH_X.map((x, i) => (
            <g key={i}>
              <rect x={x - SLOT_W / 2 - 2.2} y={ISLAND_TOP - 2.2} width={SLOT_W + 4.4} height={5}
                rx={2.4} fill="#FFFFFF" opacity={0.55} />
              <rect x={x - SLOT_W / 2} y={ISLAND_TOP + 1} width={SLOT_W} height={16} rx={3}
                fill={C.ink4} opacity={0.88} />
            </g>
          ))}

          {/* 岛台储物开关（实车按键，用户指定固定/解锁共用）：台面上的槽形拨扣。
              不再画概念圆键——按压时内芯下沉 + 微光,解锁/落锁的涟漪从槽心散开 */}
          <g>
            <rect x={BUTTON.x - BUTTON.w / 2 - 2} y={BUTTON.y - 2.6} width={BUTTON.w + 4}
              height={BUTTON.h + 4} rx={(BUTTON.h + 4) / 2} fill="#CBBBA0" opacity={0.9} />
            <rect x={BUTTON.x - BUTTON.w / 2} y={BUTTON.y - 0.8} width={BUTTON.w}
              height={BUTTON.h} rx={BUTTON.h / 2} fill="#8F8069" />
            <rect x={BUTTON.x - BUTTON.w / 2 + 3} y={BUTTON.y + 0.6 + 1.6 * btn.push}
              width={BUTTON.w - 6} height={BUTTON.h - 3.4} rx={(BUTTON.h - 3.4) / 2}
              fill={btn.push > 0.35 ? '#FFF6E2' : '#EFE4CF'} stroke="#6E5F4B" strokeWidth={0.9} />
            {btn.ripple > 0 && btn.ripple < 1 && (
              <circle cx={BUTTON.x} cy={BUTTON.y + BUTTON.h / 2} r={8 + 26 * btn.ripple}
                fill="none" stroke={st === 'released' ? C.warn : C.ok} strokeWidth={2.4}
                opacity={1 - btn.ripple} />
            )}
            <text x={BUTTON.x} y={BUTTON.y + BUTTON.h + 22} textAnchor="middle" fontFamily={F_UI}
              fontSize={15} fill={C.ink2} stroke="#FFFFFF" strokeWidth={4} strokeOpacity={0.82}
              paintOrder="stroke">岛台储物开关 · 固定/解锁共用</text>
          </g>

          {/* ── 宠物包 ── */}
          <g opacity={bOp}>
            {/* 接地投影：提起后变淡变大 */}
            <ellipse cx={BAG.x + BAG.w / 2} cy={ISLAND_TOP + 3}
              rx={BAG.w * 0.46 + lifted * 0.22} ry={5.5}
              fill="#5C7070" opacity={0.16 * Math.max(0.25, 1 - lifted / 120)} />

            {/* 包壳实体打底：照片舞台上包必须是实的，否则照片透出来像鬼影 */}
            <path d={bagShell(BAG.x, bagY, BAG.w, BAG.h, rim)} fill={BAGC.shell} opacity={0.94} />
            {/* 舀口补板：敞篷合上时舀口不再透出照片（否则像包顶破了个洞）；开盖时淡出让猫头露出 */}
            <rect x={BAG.x + 2} y={bagT - 1} width={BAG.w * 0.7 - 3}
              height={rim - bagT + 1} fill={BAGC.shell} opacity={0.94 * (1 - openK)} />

            {/* 包内（剖面：看得见内部） */}
            <g clipPath={`url(#bagIn-${uid})`}>
              <rect x={BAG.x} y={bagT} width={BAG.w} height={BAG.h} fill={`url(#inner-${uid})`}
                opacity={0.5} />
              <rect x={BAG.x + 6} y={bagY - 13} width={BAG.w - 12} height={11} rx={5}
                fill={BAGC.cushion} stroke={BAGC.cushionEdge} strokeWidth={1} />
            </g>

            {/* 猫：真实照片剪纸（头朝 +x 镜像、前掌对齐矢量猫标定，见 PetsPhoto） */}
            <PhotoCat x0={cat.x0} gy={CAT_GROUND_Y + (bagY - ISLAND_TOP)} sit={CAT.sit}
              xf={catPhotoXf(scene, t)} op={cat.op} />

            {/* 活动范围：以锚点为心、绳长为半径的圆，被包体边界裁剪 —— 画在猫之上才看得见 */}
            {arcOp > 0.01 && (
              <g clipPath={`url(#reach-${uid})`} opacity={arcOp}>
                <circle cx={TETHER.anchor.x} cy={TETHER.anchor.y} r={TETHER.len}
                  fill={C.accent} opacity={0.13} />
                <circle cx={TETHER.anchor.x} cy={TETHER.anchor.y} r={TETHER.len}
                  fill="none" stroke={C.accent} strokeWidth={2.6} strokeDasharray="9 6" />
                <text x={BAG.x + 12} y={TETHER.anchor.y + TETHER.len * 0.62}
                  fontFamily={F_UI} fontSize={16} fontWeight={700} fill={C.accent}
                  stroke="#FFFFFF" strokeWidth={4} strokeOpacity={0.82} paintOrder="stroke">活动范围</text>
              </g>
            )}

            {/* 栓扣：锚点 + 绳（松弛时下垂，拉直时绷成直线）。
                锚点在包内壁上 —— 包被提起时整组跟着包位移（c4 修过的 bug：不跟会脱在半空） */}
            {tv.shown && (
              <g transform={`translate(0 ${N(bagY - ISLAND_TOP)})`}>
                <circle cx={TETHER.anchor.x} cy={TETHER.anchor.y} r={5.6} fill={C.panel}
                  stroke={C.ink2} strokeWidth={1.8} />
                <circle cx={TETHER.anchor.x} cy={TETHER.anchor.y} r={2.2} fill={C.ink3} />
                {(() => {
                  const a = TETHER.anchor, b = tv.end;
                  const d = Math.hypot(b.x - a.x, b.y - a.y);
                  const sag = Math.max(0, (TETHER.len * tv.pullK - d)) * 0.36;
                  return (
                    <path d={`M${N(a.x)} ${N(a.y)}Q${N((a.x + b.x) / 2)} ${N((a.y + b.y) / 2 + sag)} ${N(b.x)} ${N(b.y)}`}
                      fill="none" stroke={tautK > 0.5 ? C.warn : C.ink2}
                      strokeWidth={3.4} strokeLinecap="round" />
                  );
                })()}
                {tautK > 0.5 && (
                  <text x={BAG.x + 4} y={bagY - BAG.h - 13} textAnchor="start"
                    fontFamily={F_UI} fontSize={16} fontWeight={700}
                    fill={C.warn} opacity={tautK} stroke="#FFFFFF" strokeWidth={4}
                    strokeOpacity={0.82} paintOrder="stroke">绳已拉直 · 到头了</text>
                )}
              </g>
            )}

            {/* 包壳（剖面轮廓 + 通风孔） */}
            <path d={bagShell(BAG.x, bagY, BAG.w, BAG.h, rim)} fill="none"
              stroke={BAGC.edge} strokeWidth={2.2} strokeLinejoin="round" />
            <rect x={BAG.x + 2} y={bagY - 15} width={BAG.w - 4} height={13} rx={5}
              fill={BAGC.band} opacity={0.9} />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <circle key={i} cx={BAG.x + 26 + i * 15} cy={bagY - 32} r={3.1}
                fill={BAGC.vent} stroke={BAGC.ventEdge} strokeWidth={0.9} />
            ))}

            {/* 提手/肩带：合盖后才提得起来 */}
            <g opacity={0.35 + 0.65 * (1 - openK)}>
              <path d={`M${N(BAG.x + BAG.w * 0.55)} ${N(bagT - LID_TH + 2)}
                Q${N(BAG.x + BAG.w * 0.75)} ${N(bagT - LID_TH - 34)} ${N(BAG.x + BAG.w * 0.95)} ${N(bagT - LID_TH + 2)}`}
                fill="none" stroke={BAGC.handle} strokeWidth={5} strokeLinecap="round" />
            </g>

            {/* 敞篷盖板：铰链在包体**车尾**上沿，绕 hinge 向车尾上方翻开（openDeg = +108°）——
                前排的人从车头侧伸手，盖板往车头翻会挡手 */}
            <g transform={`rotate(${N(deg)} ${N(hingeNow.x)} ${N(hingeNow.y)})`}>
              <rect x={hingeNow.x - LID_LEN} y={hingeNow.y - LID_TH} width={LID_LEN} height={LID_TH} rx={5}
                fill={BAGC.lid} stroke={BAGC.edge} strokeWidth={2} />
              <rect x={hingeNow.x - LID_LEN + 8} y={hingeNow.y - LID_TH + 3.2} width={LID_LEN - 16}
                height={LID_TH - 6.4} rx={2.4} fill={BAGC.lidInner} opacity={0.8} />
              {/* 末端翻边唇口（盖子扣在包沿上的那一圈） */}
              <rect x={hingeNow.x - LID_LEN - 1} y={hingeNow.y - LID_TH - 2} width={7}
                height={LID_TH + 13} rx={3} fill={BAGC.lidInner} stroke={BAGC.edge} strokeWidth={1.8} />
            </g>
            <circle cx={hingeNow.x} cy={hingeNow.y} r={4.2} fill={BAGC.shell} stroke={BAGC.edge}
              strokeWidth={1.8} />
            {openK > 0.15 && (
              <text x={hingeNow.x - 62} y={hingeNow.y + 22} textAnchor="middle" fontFamily={F_UI}
                fontSize={15} fill={C.ink2} opacity={openK} stroke="#FFFFFF" strokeWidth={4}
                strokeOpacity={0.82} paintOrder="stroke">敞篷（已打开）</text>
            )}

            {/* 锁舌 ×2：向下伸出插进插槽，倒钩卡到顶板下面 */}
            {LATCH_X.map((x, i) => {
              const tip = bagY + LATCH_TRAVEL * lat.ext;
              const on = lat.ext > 0.9;
              const col = on ? C.ok : BAGC.latch;
              return (
                <g key={i}>
                  <rect x={x - 4.6} y={bagY - 4} width={9.2} height={Math.max(0.1, tip - bagY + 4)}
                    rx={2.4} fill={col} />
                  {lat.ext > 0.05 && (
                    <rect x={x - 4.6 - 5.2 * lat.ext} y={tip - 8}
                      width={9.2 + 10.4 * lat.ext} height={6} rx={2.4} fill={col} />
                  )}
                  {lat.ring > 0 && lat.ring < 1 && (
                    <circle cx={x} cy={ISLAND_TOP + 6} r={6 + 24 * lat.ring} fill="none"
                      stroke={C.ok} strokeWidth={2.6} opacity={1 - lat.ring} />
                  )}
                </g>
              );
            })}
            {/* 对准引导（放下前） */}
            {scene === 'c1' && win(t, 3.9, 4.3) * (1 - win(t, 6.9, 7.2)) > 0.01 && (
              <g opacity={win(t, 3.9, 4.3) * (1 - win(t, 6.9, 7.2))}>
                {LATCH_X.map((x, i) => (
                  <line key={i} x1={x} y1={bagY + 4} x2={x} y2={ISLAND_TOP + 18}
                    stroke={C.accent} strokeWidth={1.4} strokeDasharray="4 4" />
                ))}
              </g>
            )}
            {lat.ext > 0.9 && st !== 'released' && (
              <text x={LATCH_X[0] - 18} y={ISLAND_TOP + 36} textAnchor="middle"
                fontFamily={F_UI} fontSize={15} fontWeight={700} fill={C.ok} stroke="#FFFFFF"
                strokeWidth={4} strokeOpacity={0.82} paintOrder="stroke">锁舌 ×2 已咬合</text>
            )}
          </g>

          {/* 手 */}
          {hand && <Hand {...hand} />}
      </g>
    );

    return (
      <g opacity={op} transform={`translate(500 280) scale(${N(1 + 0.06 * settle)}) translate(-500 -280)`}>
        {/* ES8 前排实拍 = 舞台本体（用户指定：不画岛台剖面，直接在照片的真实岛台上演示）。
            不镜像——照片车头在 −x，与视角 B 方向约定一致；只罩一层极轻的纱让机构线条读得清。
            ⚠️ 透视照片，只锚定「台面接触线」这一条几何（SIDE_CAM 按它标定），
            毫米级主张（绳长/锁舌行程/可及范围）仍由矢量机构层承担 */}
        <image href={ES8_CABIN_SIDE_URI} x={-3} y={-6} width={1006} height={566} />
        {/* 照片轮毂中心盖不是蔚来标——盖一层深色盘 + 实测比例的 NioLogo(舞台坐标由轮毂放大读数标定) */}
        {/* 中心盖:圆心/半径按渲染帧放大复核定案(舞台 (53.4,515.6) r17.5)——
            第一次按原图网格读数偏了 20px,教训:标注类叠加要在**合成结果**上闭环校验。
            深色盘压掉照片里原有的白标,NioLogo 取盖径 ~58% 与参考实拍比例一致 */}
        <g transform="translate(66.5 536)">
          <circle r={22.2} fill="#232527" stroke="#3A3D40" strokeWidth={1.2} />
          <NioLogo r={12.8} fill="#EDEFF1" />
        </g>
        <rect x={-3} y={-6} width={1006} height={566} fill={C.panel} opacity={0.13} />

        {/* 虚实结合（用户要求）：被近侧座椅遮挡的区域不许生硬叠画。
            同一份世界内容画两层——「实」层用亮度遮罩剔除座椅区,「虚」层裁进座椅区、34% 透明,
            读作「在座椅后面透出来」。SEAT_OCC_POLY 来自照片逐点实测的座椅前缘。 */}
        <defs>
          <mask id={`seatvis-${uid}`}>
            <rect x={-3} y={-6} width={1006} height={566} fill="#FFFFFF" />
            <polygon points={SEAT_OCC_POLY} fill="#000000" />
          </mask>
          <clipPath id={`seatocc-${uid}`}>
            <polygon points={SEAT_OCC_POLY} />
          </clipPath>
        </defs>
        <g mask={`url(#seatvis-${uid})`}>{world}</g>
        <g clipPath={`url(#seatocc-${uid})`} opacity={0.34}>{world}</g>
      </g>
    );
  };

/* ═══ 主组件 ═════════════════════════════════════════════════════════════ */
export const BagStage: React.FC<{scene: BagKey}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = BAG_SCENES[scene];
  const t = Math.min(frame / fps, s.T - 0.001);
  const v = viewAt(scene, t);
  const ph = phaseOf(s, t);
  const cards = cardsAt(scene, t);
  const capK = win(t, phaseStart(s, ph), phaseStart(s, ph) + 0.4);

  return (
    <AbsoluteFill style={{background: C.stageBg, fontFamily: F_UI}}>
      <svg viewBox="0 0 1000 560" style={{position: 'absolute', inset: 0, width: 1920, height: 1075}}>
        {v.planOp > 0.01 && (
          <g transform={planXfStr(scene, t)}>
            <PlanView scene={scene} t={t} op={v.planOp} />
          </g>
        )}
        <SideView scene={scene} t={t} op={v.sideOp} settle={v.settle} />

        {/* 三级固定：三条指向线（从卡片各行拉到对应部位） */}
        {scene === 'c3' && cards.filter((c) => c.id === 'three').map((c) => (
          <g key="lv">
            {LEVELS.map((l, i) => {
              const k = levelK(scene, t, i) * c.op;
              if (k <= 0.01) return null;
              const a = planPt(scene, t, l.at);
              return (
                <line key={l.id} x1={c.x} y1={c.y + 48 + i * 20 - 5} x2={a.x} y2={a.y}
                  stroke={C.accent} strokeWidth={1.4} strokeDasharray="5 5" opacity={0.85 * k} />
              );
            })}
          </g>
        ))}

        {/* 贴主体信息卡 */}
        {cards.map((c) => (
          <InfoCard key={c.id} c={{...c, op: c.op * (c.big ? Math.max(0.35, capK) : 1)}}
            anchor={cardAnchorScreen(scene, t, c)} ph={ph} nph={s.ph.length} />
        ))}
      </svg>

      {/* 视角标签（非信息内容，允许留在角上） */}
      <div style={{
        position: 'absolute', top: 24, left: 32, fontFamily: F_DATA, fontSize: 20,
        letterSpacing: '0.12em', color: C.ink3,
      }}>
        {v.sideOp > 0.5 ? '前排实拍 · FRONT ROW' : '座舱俯视 · TOP VIEW'}
      </div>

      {/* 章节标签（开场短暂出现） */}
      <div style={{
        position: 'absolute', top: 22, left: 0, right: 0, display: 'flex', justifyContent: 'center',
        opacity: Math.min(win(t, 0.2, 0.7), 1 - win(t, 2.6, 3.2)),
      }}>
        <span style={{
          fontSize: 21, color: C.ink2, background: C.panel,
          border: `1.5px solid ${C.line}`, borderRadius: 999, padding: '8px 22px',
        }}>{s.chip}</span>
      </div>
    </AbsoluteFill>
  );
};

export const BAG_COMPOSITIONS = (['c1', 'c2', 'c3', 'c4'] as BagKey[]).map((k, i) => ({
  id: `Bag${'ABCD'[i]}`,
  scene: k,
  frames: Math.round(BAG_SCENES[k].T * 30),
}));
