// 灵动宠物包 · 场景配置 + 纯函数时间轴
//
// 几何常量一律来自 ./bag-geo（已标定，只读）。本文件只负责「什么时候动到哪里」，
// BagStage 与断言脚本共用同一份求值函数，保证「画出来的」和「断言检查的」是同一组数字。
// 禁止 Math.random。
//
// ⚠️ 侧视方向约定（由 bag-geo 常量自洽性推定，全工程只此一处写死）：
//   视角 B = 前排实拍舞台（ES8 前排照片不镜像铺底，机构画在照片岛台上），
//   **车头在 −x（左）、二排在 +x（右）**——照片车头朝左，与此约定一致。依据：
//     · SIDE.frontTrayMM 从 x0 起算 —— 托盘/杯架在最前，其后是软包段，最后是二排屏；
//     · BUTTON.x = PAD_X0 − smm(40) 落在软包段「前缘」之前，只有 −x 为前才成立。
//   于是：猫（头朝 +x）朝向二排；CANOPY.hinge 在包体**前**上沿，开盖时向前上方翻起
//   （已手算：远端点旋转 −108° 后落在铰链的左上方 = 向车头方向掀开，符合直觉）。

import {
  BAG, BUTTON, CANOPY, CAT, ISLAND_LEN, ISLAND_PLAN, ISLAND_PLAN_W, ISLAND_TOP,
  LATCH_X, PAD_LEN, PAD_X0, PLAN, PLAN_INNER_W, PLAN_SEAT_L, PLAN_SEAT_W,
  REACH_MM, REACH_R, SHOULDER, SIDE, TETHER, TETHER_MM, BAG_MM, CAT_MM,
  clamp01, easeOutBack, pmm, planRowY, smm, win, type LatchState,
} from './bag-geo';

export {
  BAG, BAG_MM, BUTTON, CANOPY, CAT, CAT_MM, ISLAND_LEN, ISLAND_PLAN, ISLAND_PLAN_W,
  ISLAND_TOP, LATCH_X, PAD_LEN, PAD_X0, PLAN, PLAN_INNER_W, PLAN_SEAT_L, PLAN_SEAT_W,
  REACH_MM, REACH_R, SHOULDER, SIDE, TETHER, TETHER_MM,
  T_COLORS, F_UI, F_DATA, clamp01, easeOutBack, pmm, planRowY, smm, win,
} from './bag-geo';
export type {LatchState} from './bag-geo';

export type Pt = {x: number; y: number};
export type Rect = {x: number; y: number; w: number; h: number};

// ── 缓动（纯函数）────────────────────────────────────────────────────────
export const easeOut = (k: number) => 1 - Math.pow(1 - clamp01(k), 3);
export const easeIn = (k: number) => Math.pow(clamp01(k), 3);
export const ease = (k: number) => {
  const c = clamp01(k);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
};
export const smooth = (k: number) => {const c = clamp01(k); return c * c * (3 - 2 * c);};
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

// ── 舞台 / 相机 ──────────────────────────────────────────────────────────
export const STAGE = {w: 1000, h: 560};
/** 安全区（屏幕坐标）——所有信息卡必须落在里面 */
export const SAFE = {x0: 18, y0: 18, x1: 982, y1: 542};
/** 四角禁区（屏幕坐标）：信息卡整体不得落在任一角块之内 */
export const CORNERS = [
  {x0: 0, y0: 0, x1: 190, y1: 105},
  {x0: 810, y0: 0, x1: 1000, y1: 105},
  {x0: 0, y0: 455, x1: 190, y1: 560},
  {x0: 810, y0: 455, x1: 1000, y1: 560},
];

/**
 * 视角 B 相机：screen = world * s + (tx, ty)。
 *
 * **由 ES8 前排实拍照片标定**（用户指定：直接在照片的真实岛台上演示，不画剖面）。
 * 照片按 (x=-3, y=-6, 1006×566) 铺满舞台后，岛台可见台面段（方向盘之后、
 * 前排座椅椅背遮挡之前）实测为舞台 x 418…647、台面接触线 y≈314
 * （照片 px：x 700…1080、近侧沿 y≈537，×0.6017）。
 * 解出：ISLAND_TOP(218.667)→314 且包体(世界 x 425…616.7)落在台面段内、
 * 右移 8px 让包左沿基本让开方向盘轮缘（目检定案）→ s=0.95, tx=45.2, ty=106.27。
 * 敞篷开到 −108° 时世界 y 最高 ≈ −82 → 舞台 y≈28，仍在画面内（断言里有这条）。
 * ⚠️ 换照片或挪包位必须重量台面段再解一次，不许目测凑数。
 */
export const SIDE_CAM = {s: 0.95, tx: 45.2, ty: 106.27};
export const sideX = (x: number) => x * SIDE_CAM.s + SIDE_CAM.tx;
export const sideY = (y: number) => y * SIDE_CAM.s + SIDE_CAM.ty;
export const sidePt = (p: Pt): Pt => ({x: sideX(p.x), y: sideY(p.y)});
export const SIDE_XF =
  `translate(${SIDE_CAM.tx} ${SIDE_CAM.ty}) scale(${SIDE_CAM.s})`;

// ── 视角 A 派生几何（座舱俯视平面，车头朝上）────────────────────────────
export const CABIN = {
  x0: PLAN.cx - PLAN_INNER_W / 2,   // ≈ 347.27
  x1: PLAN.cx + PLAN_INNER_W / 2,   // ≈ 592.73
  y0: PLAN.yDash + 23,              // 座舱地板前沿（仪表台之后）
  y1: 548,
};
/** 车身外廓（去顶俯视）*/
export const BODY = {x0: 336, y0: 40, x1: 604, y1: 556};
/** 仪表台带 */
export const DASH = {y0: 84, y1: CABIN.y0};
/** 三排 H 点 */
export const ROW_Y = [planRowY(0), planRowY(1), planRowY(2)];
/** 前排座椅中心 x —— 由 ES8 俯视照片标定：照片座椅中心 x 360/660 → 舞台 ±61.5（≈±406mm） */
export const SEAT_DX = 61.5;
export const SEAT_X = {l: PLAN.cx - SEAT_DX, r: PLAN.cx + SEAT_DX};

/**
 * 中央岛台（俯视）—— **由 ES8 全舱俯视照片标定**（es8-cabin-photo.ts 里的变换）：
 * 照片岛台 x 445–570、杯架段前沿 y300、软包段 y 390–560、console 尾端 y660，
 * 经 s=0.41 / tx=261.72 / ty=−5 变换成下面这些舞台数。
 * ⚠️ 改照片或改变换时这里必须跟着重标——这些数不再来自 ISLAND_PLAN 概念值。
 */
export const PLAN_PHOTO = {s: 0.41, tx: 261.72, ty: -5, w: 1023, h: 1537} as const;
export const ISL = {x0: 444.2, x1: 495.4, y0: 118.0, y1: 265.6};
export const ISL_SEG = [118.0, 154.9, 224.6, 265.6];
/** 软包扶手段（宠物包放这里）= 照片软包段 y 390–560 */
export const PAD_PLAN = {y0: ISL_SEG[1], y1: ISL_SEG[2]};

/** 宠物包（俯视）：长 = BAG_MM.w、宽 = BAG_MM.d，居中落在软包段 */
export const BAG_PLAN = (() => {
  const l = pmm(BAG_MM.w), w = pmm(BAG_MM.d);
  const cy = (PAD_PLAN.y0 + PAD_PLAN.y1) / 2;
  return {x: PLAN.cx - w / 2, y: cy - l / 2, w, h: l};
})();
/** 俯视敞篷：铰链在包体**前**沿（小 y），与侧视 CANOPY.hinge 的 8% 位置一致 */
export const CANOPY_PLAN = {
  // 俯视里车头朝上（−y），车尾在 +y：铰链取包体**车尾**一端，盖板向车尾翻开，不挡前排的手
  hingeY: BAG_PLAN.y + BAG_PLAN.h * 0.92,
  len: BAG_PLAN.h * 0.92,
};

// ── 视角 B 派生几何（前排实拍舞台）──────────────────────────────────────
/**
 * 照片岛台的世界坐标占位盒：卡片避让/贴主体断言用。
 * 岛台本体不再用矢量画（照片就是岛台），但「卡片不许压在岛台照片上」仍要成立。
 * top = ISLAND_TOP 与照片台面接触线严格对齐（SIDE_CAM 就是按这条解的）。
 */
export const ISL_S = {
  x0: SIDE.x0,
  x1: SIDE.x0 + ISLAND_LEN,
  top: ISLAND_TOP,
  floor: SIDE.FLOOR,
  trayX1: PAD_X0,
  padX0: PAD_X0,
  padX1: PAD_X0 + PAD_LEN,
};
/** 岛台顶板厚度（锁舌的倒钩要卡到它下面）*/
export const TOP_PLATE = 8;
/** 固定点插槽（岛台顶面上的两个孔）*/
export const SLOT_W = 15;
/** 锁舌行程 */
export const LATCH_TRAVEL = 22;
/** 包体开口（舀口）下沿：让猫头/肩真正露在包外 */
export const BAG_RIM_Y = BAG.y - BAG.h * 0.79;   // ≈ 113.4
/** 敞篷盖板长度（从铰链量到包体尾沿）*/
export const LID_LEN = BAG.w * 0.92;
export const LID_TH = 15;
/** 包底两处锁舌相对包左沿的偏移（跟着包一起走）*/
export const LATCH_DX = LATCH_X.map((x) => x - BAG.x);

// ── 猫的位姿表（1u = CAT.sit；原点 = 坐骨着地点，头朝 +x）────────────────
export type CatPose = 'sit' | 'lookout' | 'turn' | 'curl';
export type CatPoseDef = {
  hip: [number, number]; hipR: [number, number];
  sh: [number, number];
  head: [number, number]; headR: number;
  earTip: number;
  fPaw: [number, number]; hPaw: [number, number];
  /** 胸背带扣点（栓扣扣在这里）*/
  clip: [number, number];
  tail: [number, number][];
  nose: number;
  top: number;
};
export const CAT_POSE: Record<CatPose, CatPoseDef> = {
  sit: {
    hip: [0.0, -0.26], hipR: [0.265, 0.3],
    sh: [0.32, -0.63],
    head: [0.425, -0.825], headR: 0.152, earTip: -1.0,
    fPaw: [0.4, -0.015], hPaw: [0.2, -0.02],
    clip: [0.3545, -0.66],
    tail: [[-0.14, -0.16], [-0.3, -0.1], [-0.32, -0.01], [-0.12, 0.015], [0.14, 0.02]],
    nose: 0.6, top: -1.0,
  },
  lookout: {
    hip: [-0.01, -0.26], hipR: [0.265, 0.3],
    sh: [0.34, -0.66],
    head: [0.5, -0.87], headR: 0.15, earTip: -1.04,
    fPaw: [0.42, -0.015], hPaw: [0.2, -0.02],
    clip: [0.375, -0.69],
    tail: [[-0.15, -0.17], [-0.31, -0.13], [-0.34, -0.03], [-0.14, 0.012], [0.12, 0.02]],
    nose: 0.68, top: -1.04,
  },
  turn: {
    hip: [-0.03, -0.3], hipR: [0.27, 0.29],
    sh: [0.38, -0.56],
    head: [0.555, -0.655], headR: 0.148, earTip: -0.82,
    fPaw: [0.54, -0.015], hPaw: [0.12, -0.02],
    clip: [0.42, -0.53],
    tail: [[-0.19, -0.28], [-0.33, -0.44], [-0.3, -0.6], [-0.19, -0.7]],
    nose: 0.72, top: -0.82,
  },
  curl: {
    hip: [-0.02, -0.2], hipR: [0.3, 0.225],
    sh: [0.2, -0.26],
    head: [0.3, -0.285], headR: 0.145, earTip: -0.44,
    fPaw: [0.34, -0.015], hPaw: [0.06, -0.02],
    clip: [0.235, -0.3],
    tail: [[-0.22, -0.16], [-0.28, -0.05], [-0.1, 0.01], [0.16, 0.01], [0.34, -0.02]],
    nose: 0.45, top: -0.44,
  },
};
/** 体长 / 坐高 —— 由 bag-geo 的 CAT 直接算，Cat.tsx 只按 sit 缩放 */
export const CAT_BODY_RATIO = CAT.body / CAT.sit;      // ≈ 1.3636
/** 猫坐在包内软垫上：坐骨着地点的 y */
export const CAT_GROUND_Y = BAG.y - 5;
/** 猫的静止 x（坐骨着地点）——包内偏后，头朝 +x 开口一侧 */
export const CAT_X0 = 472;

/** 胸背带扣点的世界坐标 */
export const catClip = (pose: CatPose, x0: number, groundY = CAT_GROUND_Y): Pt => ({
  x: x0 + CAT_POSE[pose].clip[0] * CAT.sit,
  y: groundY + CAT_POSE[pose].clip[1] * CAT.sit,
});
/** 猫的外接盒（世界坐标）——断言用它检查信息卡不压主体 */
export const catBox = (pose: CatPose, x0: number, groundY = CAT_GROUND_Y): Rect => {
  const p = CAT_POSE[pose];
  const left = x0 + Math.min(p.hip[0] - p.hipR[0], ...p.tail.map((q) => q[0])) * CAT.sit;
  const right = x0 + p.nose * CAT.sit;
  const top = groundY + Math.min(p.top, ...p.tail.map((q) => q[1])) * CAT.sit;
  return {x: left, y: top, w: right - left, h: groundY + 0.03 * CAT.sit - top};
};
/**
 * 绳长约束：给定位姿，坐骨 x 的上限 —— 保证胸背带扣点到锚点的距离 ≤ len − margin。
 * 「绳不许被拉长」是硬约束，所以限位在数据层解析求出，不靠画的时候凑。
 */
export const catX0Max = (pose: CatPose, margin = 0.8): number => {
  const c = CAT_POSE[pose].clip;
  const dy = CAT_GROUND_Y + c[1] * CAT.sit - TETHER.anchor.y;
  const R = TETHER.len - margin;
  const dx = Math.sqrt(Math.max(0, R * R - dy * dy));
  return TETHER.anchor.x - c[0] * CAT.sit + dx;
};

// ── 场景配置 ─────────────────────────────────────────────────────────────
export const BAG_KEYS = ['c1', 'c2', 'c3', 'c4'] as const;
export type BagKey = (typeof BAG_KEYS)[number];

export type BagScene = {
  T: number;
  /** 相位边界（秒，严格递增，末位 = T，均为整帧）*/
  ph: number[];
  chip: string;
  sub: string;
  title: string;
  caps: string[];
};

export const BAG_SCENES: Record<BagKey, BagScene> = {
  c1: {
    T: 11.0,
    ph: [2.6, 4.0, 6.0, 7.6, 11.0],
    chip: '第一章 · 放上岛台 · 一按固定',
    sub: '车固定包',
    title: '放上岛台 · 一按固定',
    caps: [
      '前排中央岛台贯通仪表台到二排，中段软包扶手就是宠物包的位置',
      '视角切到前排实拍 —— 包就固定在岛台台面上',
      '把包放到软包段上，包底两处锁舌对准岛台固定点',
      '往下一按 —— 锁舌伸出、倒钩卡进岛台顶板',
      '已锁定：车固定包，行驶中不会乱动',
    ],
  },
  c2: {
    T: 10.0,
    ph: [1.6, 3.4, 4.6, 7.2, 10.0],
    chip: '第二章 · 栓扣拴住宠物',
    sub: '包固定宠物',
    title: '栓扣拴住宠物',
    caps: [
      '猫已经在包里，包内栓扣还没连上',
      '从包内锚点把栓扣拉出来',
      '扣在猫的胸背带上 —— 包固定宠物',
      '想往外走？绳一拉直就走不动了',
      '活动范围 = 以锚点为心、绳长 260mm 的一片区域，出不去',
    ],
  },
  c3: {
    T: 12.0,
    ph: [2.0, 4.2, 6.2, 9.0, 12.0],
    chip: '第三章 · 行驶中三级固定',
    sub: '车-包-宠物',
    title: '行驶中三级固定',
    caps: [
      '行驶中 —— 岛台上的包纹丝不动',
      '三级固定：车固定包 · 包固定宠物 · 宠物在包内可活动',
      '打开敞篷（与固定/解锁互不相干），猫头露出来',
      '主副驾单臂可及 700mm —— 两边都够得着',
      '不影响驾驶，伸手就能摸到',
    ],
  },
  c4: {
    T: 11.0,
    ph: [1.8, 4.2, 6.6, 9.2, 11.0],
    chip: '第四章 · 按键解锁 · 提走',
    sub: '拆装携带',
    title: '按键解锁 · 提走',
    caps: [
      '到达目的地，包仍然是固定状态',
      '先合上敞篷 —— 这一步不解锁',
      '再按岛台侧面的物理按键 —— 锁舌缩回，解锁',
      '提起提手，整只包带走',
      '车内固定 / 车外便携，两个动作各管各的',
    ],
  },
};

export const phaseOf = (s: BagScene, t: number) => {
  for (let i = 0; i < s.ph.length; i++) if (t < s.ph[i]) return i;
  return s.ph.length - 1;
};
export const phaseStart = (s: BagScene, i: number) => (i === 0 ? 0 : s.ph[i - 1]);

// ── 状态机：free → placed → locked → released（严格单向）─────────────────
export const STATE_ORDER: LatchState[] = ['free', 'placed', 'locked', 'released'];
export const stateIdx = (s: LatchState) => STATE_ORDER.indexOf(s);
export const STATE_LABEL: Record<LatchState, string> = {
  free: '未固定', placed: '已就位 · 未锁', locked: '已锁定', released: '已解锁',
};

export const T_PLACE = 5.4;
export const T_LOCK = 7.0;
export const T_RELEASE = 5.0;

export const stateAt = (scene: BagKey, t: number): LatchState => {
  if (scene === 'c1') return t < T_PLACE ? 'free' : t < T_LOCK ? 'placed' : 'locked';
  if (scene === 'c4') return t < T_RELEASE ? 'locked' : 'released';
  return 'locked';
};

/** 用户动作窗口 —— 每一次状态跃迁都必须落在其中一个里面（不许自动跳）*/
export type Action = {id: string; label: string; t0: number; t1: number};
export const ACTIONS: Record<BagKey, Action[]> = {
  c1: [
    {id: 'place', label: '把包放到软包段', t0: 4.1, t1: 5.4},
    {id: 'press', label: '往下一按', t0: 5.9, t1: 7.4},
  ],
  c2: [
    {id: 'pull', label: '拉出栓扣', t0: 1.9, t1: 3.4},
    {id: 'clip', label: '扣上胸背带', t0: 3.4, t1: 4.6},
  ],
  c3: [{id: 'canopy', label: '打开敞篷', t0: 4.4, t1: 5.6}],
  c4: [
    {id: 'canopy', label: '合上敞篷', t0: 1.9, t1: 3.8},
    {id: 'press', label: '按下解锁键', t0: 4.4, t1: 6.0},
    {id: 'lift', label: '提起带走', t0: 6.9, t1: 9.0},
  ],
};
export const TRANSITIONS: Record<BagKey, {at: number; to: LatchState; action: string}[]> = {
  c1: [
    {at: T_PLACE, to: 'placed', action: 'place'},
    {at: T_LOCK, to: 'locked', action: 'press'},
  ],
  c2: [],
  c3: [],
  c4: [{at: T_RELEASE, to: 'released', action: 'press'}],
};

// ── 敞篷（与固定/解锁完全独立的第二个状态）──────────────────────────────
export const canopyDeg = (scene: BagKey, t: number): number => {
  const O = CANOPY.openDeg;
  if (scene === 'c1') return 0;
  if (scene === 'c2') return O;
  if (scene === 'c3') return O * ease(win(t, 4.4, 5.6));
  return O * (1 - ease(win(t, 1.9, 3.8)));    // c4：先合上
};
export const canopyOpenK = (scene: BagKey, t: number) => canopyDeg(scene, t) / CANOPY.openDeg;

// ── 包体（侧视）─────────────────────────────────────────────────────────
export const BAG_DROP_Y0 = 86;
export const BAG_LIFT_Y1 = 118;

/** 包底 y（世界坐标）—— 锁定期间恒等于 ISLAND_TOP */
export const bagBottom = (scene: BagKey, t: number): number => {
  if (scene === 'c1') {
    return BAG_DROP_Y0 + (ISLAND_TOP - BAG_DROP_Y0) * easeOut(win(t, 4.1, T_PLACE));
  }
  if (scene === 'c4') {
    return ISLAND_TOP - (ISLAND_TOP - BAG_LIFT_Y1) * ease(win(t, 6.9, 9.0));
  }
  return ISLAND_TOP;
};
export const bagRect = (scene: BagKey, t: number): Rect => ({
  x: BAG.x, y: bagBottom(scene, t) - BAG.h, w: BAG.w, h: BAG.h,
});
/** 包出现/消失（第一章跟着侧视一起淡入）*/
export const bagOp = (scene: BagKey, t: number) => (scene === 'c1' ? win(t, 3.5, 4.05) : 1);

// ── 锁舌 ─────────────────────────────────────────────────────────────────
export const latchAt = (scene: BagKey, t: number) => {
  let ext = 1;
  let ring = 0;
  if (scene === 'c1') {
    ext = ease(win(t, 6.95, 7.45));
    ring = win(t, T_LOCK, 7.7);
    if (t < T_PLACE) ext = 0;
  } else if (scene === 'c4') {
    ext = 1 - ease(win(t, T_RELEASE, 5.5));
  }
  return {ext: clamp01(ext), ring: clamp01(ring), state: stateAt(scene, t)};
};
/** 锁舌当前世界坐标（跟着包走）*/
export const latchPts = (scene: BagKey, t: number): Pt[] => {
  const y = bagBottom(scene, t);
  return LATCH_DX.map((dx) => ({x: BAG.x + dx, y}));
};

// ── 猫 ───────────────────────────────────────────────────────────────────
export const catAt = (scene: BagKey, t: number): {pose: CatPose; x0: number; op: number} => {
  if (scene === 'c1') return {pose: 'sit', x0: CAT_X0, op: 0};
  if (scene === 'c2') {
    const pose: CatPose = t < 4.6 ? 'sit' : t < 7.6 ? 'turn' : 'lookout';
    // 想往外走 → 绳拉直 → 被限住 → 回退 → 再试 → 放弃
    let k = 0;
    if (t >= 4.6) {
      k = ease(win(t, 4.6, 6.0)) - 0.32 * ease(win(t, 6.0, 6.5))
        + 0.3 * ease(win(t, 6.5, 7.0)) - 0.72 * ease(win(t, 7.4, 8.4));
    }
    const dMax = catX0Max(pose) - CAT_X0;
    return {pose, x0: CAT_X0 + dMax * clamp01(k), op: 1};
  }
  if (scene === 'c3') return {pose: t < 5.0 ? 'curl' : 'sit', x0: CAT_X0, op: 1};
  // c4：合盖前先蜷起来（盖板落下时猫头必须已经收回包内）
  return {pose: t < 1.6 ? 'sit' : 'curl', x0: CAT_X0, op: 1};
};

// ── 照片猫的剪纸位姿（PhotoCat 用）────────────────────────────────────────
// 照片是单一坐姿抠图,位姿差异用整体 平移/倾角/压缩 表达(剪纸偶),
// 切换时刻与 catAt 的离散位姿切换一致,但这里做 0.5s 平滑过渡。
export type PetXf = {dy: number; rot: number; sx: number; sy: number};
const CAT_PXF: Record<CatPose, PetXf> = {
  sit: {dy: 0, rot: 0, sx: 1, sy: 1},
  lookout: {dy: -5, rot: -4, sx: 1, sy: 1.02},
  turn: {dy: 2, rot: 7, sx: 1, sy: 0.97},
  curl: {dy: 0, rot: 0, sx: 1.08, sy: 0.72},
};
const mixXf = (a: PetXf, b: PetXf, k: number): PetXf => ({
  dy: lerp(a.dy, b.dy, k), rot: lerp(a.rot, b.rot, k),
  sx: lerp(a.sx, b.sx, k), sy: lerp(a.sy, b.sy, k),
});
export const catPhotoXf = (scene: BagKey, t: number): PetXf => {
  let xf: PetXf;
  if (scene === 'c2') {
    xf = mixXf(
      mixXf(CAT_PXF.sit, CAT_PXF.turn, smooth(win(t, 4.6, 5.1))),
      CAT_PXF.lookout, smooth(win(t, 7.6, 8.1)));
  } else if (scene === 'c3') {
    xf = mixXf(CAT_PXF.curl, CAT_PXF.sit, smooth(win(t, 5.0, 5.5)));
  } else if (scene === 'c4') {
    xf = mixXf(CAT_PXF.sit, CAT_PXF.curl, smooth(win(t, 1.6, 2.1)));
  } else {
    xf = CAT_PXF.sit;
  }
  // 呼吸(以地线为轴,肉眼可感但不抢戏)
  return {...xf, sy: xf.sy + 0.008 * Math.sin((2 * Math.PI * t) / 2.6)};
};

// ── 栓扣 ─────────────────────────────────────────────────────────────────
export const tetherAt = (scene: BagKey, t: number) => {
  const cat = catAt(scene, t);
  const clip = catClip(cat.pose, cat.x0);
  if (scene !== 'c2') return {shown: scene === 'c3' || scene === 'c4', connected: 1, end: clip, clip, pullK: 1};
  const pullK = ease(win(t, 1.9, 3.4));
  const connected = smooth(win(t, 3.4, 4.2));
  const coil = {x: TETHER.anchor.x + 9, y: TETHER.anchor.y + 12};
  const end = {
    x: lerp(coil.x, clip.x, pullK * 0.86 + connected * 0.14),
    y: lerp(coil.y, clip.y, pullK * 0.86 + connected * 0.14),
  };
  return {shown: true, connected, end: connected > 0.99 ? clip : end, clip, pullK};
};
/** 活动范围（以锚点为心、TETHER.len 为半径），被包体边界裁剪 */
export const REACH_CLIP = {
  x0: BAG.x + 5, x1: BAG.x + BAG.w - 5,
  y0: BAG.y - BAG.h - 42, y1: BAG.y - 5,
};

// ── 手 ───────────────────────────────────────────────────────────────────
export type HandSpec = {kind: 'grip' | 'press' | 'finger'; x: number; y: number; rot: number; op: number};
export const handAt = (scene: BagKey, t: number): HandSpec | null => {
  if (scene === 'c1') {
    const gripOp = win(t, 3.6, 4.0) * (1 - win(t, 5.35, 5.75));
    if (gripOp > 0.01) {
      const y = bagBottom(scene, t) - BAG.h - LID_TH - 30;
      return {kind: 'grip', x: BAG.x + BAG.w * 0.52, y, rot: 0, op: gripOp};
    }
    const pressOp = win(t, 5.9, 6.25) * (1 - win(t, 7.5, 7.9));
    if (pressOp > 0.01) {
      const down = ease(win(t, 6.15, 6.95)) - ease(win(t, 7.3, 7.7));
      const top = BAG.y - BAG.h - LID_TH;
      return {kind: 'press', x: BAG.x + BAG.w * 0.58, y: top - 62 + 56 * down, rot: 0, op: pressOp};
    }
    return null;
  }
  if (scene === 'c2') {
    const op = win(t, 1.75, 2.1) * (1 - win(t, 4.2, 4.6));
    if (op < 0.01) return null;
    const e = tetherAt(scene, t).end;
    return {kind: 'finger', x: e.x - 26, y: e.y + 4, rot: -8, op};
  }
  if (scene === 'c4') {
    const pressOp = win(t, 4.35, 4.7) * (1 - win(t, 6.2, 6.6));
    if (pressOp > 0.01) {
      const push = ease(win(t, 4.75, T_RELEASE)) - ease(win(t, 5.6, 5.95));
      return {kind: 'finger', x: BUTTON.x - BUTTON.r - 30 + 26 * push, y: BUTTON.y, rot: 0, op: pressOp};
    }
    const gripOp = win(t, 6.55, 6.95);
    if (gripOp > 0.01) {
      const y = bagBottom(scene, t) - BAG.h - LID_TH - 30;
      return {kind: 'grip', x: BAG.x + BAG.w * 0.52, y, rot: 0, op: gripOp};
    }
    return null;
  }
  return null;
};
/** 按键：按压位移 + 涟漪 */
export const buttonAt = (scene: BagKey, t: number) => {
  if (scene !== 'c4') return {push: 0, ripple: 0};
  const push = ease(win(t, 4.75, T_RELEASE)) - ease(win(t, 5.6, 5.95));
  return {push: clamp01(push), ripple: win(t, T_RELEASE, 5.9)};
};

// ── 视角切换（第一章：平面 → 推近 → 剖面）───────────────────────────────
export const viewAt = (scene: BagKey, t: number) => {
  if (scene === 'c3') return {planOp: 1, sideOp: 0, zoom: 0, settle: 0};
  if (scene !== 'c1') return {planOp: 0, sideOp: 1, zoom: 0, settle: 0};
  return {
    planOp: 1 - win(t, 3.0, 3.7),
    sideOp: win(t, 3.4, 4.1),
    zoom: ease(win(t, 2.6, 3.9)),
    settle: 1 - ease(win(t, 3.4, 4.3)),
  };
};
/** 平面视推近变换（绕软包段中心，同时把它推到画面中心）*/
export const planXf = (scene: BagKey, t: number) => {
  const p = viewAt(scene, t).zoom;
  const k = 1 + 1.3 * p;
  const zx = PLAN.cx, zy = (PAD_PLAN.y0 + PAD_PLAN.y1) / 2;
  const cx = zx + (500 - zx) * p, cy = zy + (280 - zy) * p;
  return {k, cx, cy, zx, zy};
};
export const planXfStr = (scene: BagKey, t: number) => {
  const x = planXf(scene, t);
  return `translate(${x.cx.toFixed(3)} ${x.cy.toFixed(3)}) scale(${x.k.toFixed(4)}) translate(${(-x.zx).toFixed(3)} ${(-x.zy).toFixed(3)})`;
};
export const planPt = (scene: BagKey, t: number, p: Pt): Pt => {
  const x = planXf(scene, t);
  return {x: x.cx + (p.x - x.zx) * x.k, y: x.cy + (p.y - x.zy) * x.k};
};

// ── 主副驾可及扇形（视角 A）─────────────────────────────────────────────
export const SECTORS = [
  {id: 'driver', c: SHOULDER.driver, a0: -15, a1: 105, label: '驾驶位单臂可及'},
  {id: 'front', c: SHOULDER.front, a0: 75, a1: 195, label: '副驾单臂可及'},
] as const;
export const reachK = (scene: BagKey, t: number) =>
  scene === 'c3' ? smooth(win(t, 6.4, 7.6)) : 0;
/** 扇形（按当前展开比例）是否与矩形相交 —— 断言与绘制共用同一个判定 */
export const sectorHitsRect = (
  c: Pt, a0: number, a1: number, R: number, r: Rect, n = 41,
): boolean => {
  const mid = (a0 + a1) / 2, half = (a1 - a0) / 2;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const px = r.x + (r.w * i) / (n - 1);
      const py = r.y + (r.h * j) / (n - 1);
      const dx = px - c.x, dy = py - c.y;
      if (Math.hypot(dx, dy) > R) continue;
      let d = (Math.atan2(dy, dx) * 180) / Math.PI - mid;
      while (d > 180) d -= 360;
      while (d < -180) d += 360;
      if (Math.abs(d) <= half) return true;
    }
  }
  return false;
};

// ── 行驶感（视角 A）─────────────────────────────────────────────────────
export const steerDeg = (t: number) => 2.6 * Math.sin((2 * Math.PI * t) / 3.2);
export const roadPhase = (t: number) => (t * 130) % 34;

// ── 三级固定的三个指向点（视角 A，世界坐标）─────────────────────────────
export const LEVELS = [
  {id: 'L1', tag: '① 车固定包', note: '岛台锁舌 ×2', at: {x: ISL.x0 + 4, y: BAG_PLAN.y + BAG_PLAN.h * 0.86}},
  {id: 'L2', tag: '② 包固定宠物', note: '包内栓扣', at: {x: PLAN.cx - 4, y: BAG_PLAN.y + BAG_PLAN.h * 0.5}},
  {id: 'L3', tag: '③ 宠物可活动', note: '绳长 260mm 内自由', at: {x: PLAN.cx + 10, y: BAG_PLAN.y + BAG_PLAN.h * 0.2}},
] as const;
export const levelK = (scene: BagKey, t: number, i: number) =>
  scene === 'c3' ? smooth(win(t, 2.2 + i * 0.55, 2.8 + i * 0.55)) : 0;

// ── 信息卡（屏幕坐标；anchor 为世界坐标 + 所属视角）─────────────────────
export type CardSide = 'left' | 'right' | 'top' | 'bottom';
export type Card = {
  id: string;
  view: 'plan' | 'side';
  x: number; y: number; w: number; h: number;
  op: number;
  anchor: Pt;
  edge: CardSide;
  kicker?: string;
  lines: string[];
  /** 大卡 = 叙事字幕卡（带相位圆点）*/
  big?: boolean;
  tone: 'accent' | 'ok' | 'warn' | 'ink';
};

const CAP_BOX = {x: 36, y: 142, w: 270, h: 130};
const CAP_BOX_C3 = {x: 36, y: 280, w: 270, h: 130};

/** 叙事卡指向的焦点（世界坐标）*/
export const focusAt = (scene: BagKey, t: number): {p: Pt; view: 'plan' | 'side'} => {
  const s = BAG_SCENES[scene];
  const ph = phaseOf(s, t);
  if (scene === 'c1') {
    if (ph <= 1) return {p: {x: PLAN.cx, y: (PAD_PLAN.y0 + PAD_PLAN.y1) / 2}, view: 'plan'};
    if (ph === 2) return {p: {x: BAG.x + BAG.w * 0.2, y: bagBottom(scene, t) - 12}, view: 'side'};
    return {p: {x: LATCH_X[0], y: ISLAND_TOP + 10}, view: 'side'};
  }
  if (scene === 'c2') {
    const c = catAt(scene, t);
    if (ph === 0) return {p: {x: c.x0 + 0.42 * CAT.sit, y: CAT_GROUND_Y - 0.86 * CAT.sit}, view: 'side'};
    if (ph === 1) return {p: TETHER.anchor, view: 'side'};
    if (ph === 2) return {p: catClip(c.pose, c.x0), view: 'side'};
    if (ph === 3) {
      const cl = catClip(c.pose, c.x0);
      return {p: {x: (TETHER.anchor.x + cl.x) / 2, y: (TETHER.anchor.y + cl.y) / 2 - 4}, view: 'side'};
    }
    return {p: {x: TETHER.anchor.x + TETHER.len * 0.72, y: TETHER.anchor.y + 46}, view: 'side'};
  }
  if (scene === 'c3') {
    if (ph === 2) return {p: {x: PLAN.cx, y: CANOPY_PLAN.hingeY - 8}, view: 'plan'};
    if (ph === 3) return {p: SHOULDER.driver, view: 'plan'};
    return {p: {x: PLAN.cx, y: BAG_PLAN.y + BAG_PLAN.h * 0.5}, view: 'plan'};
  }
  const ph4 = phaseOf(s, t);
  if (ph4 === 1) return {p: {x: CANOPY.hinge.x - LID_LEN * 0.6, y: CANOPY.closedY - 6}, view: 'side'};
  if (ph4 === 2) return {p: {x: BUTTON.x, y: BUTTON.y}, view: 'side'};
  if (ph4 >= 3) return {p: {x: BAG.x + BAG.w * 0.5, y: bagBottom(scene, t) - BAG.h - 24}, view: 'side'};
  return {p: {x: BAG.x + BAG.w * 0.2, y: ISLAND_TOP - 10}, view: 'side'};
};

export const cardsAt = (scene: BagKey, t: number): Card[] => {
  const s = BAG_SCENES[scene];
  const ph = phaseOf(s, t);
  const out: Card[] = [];
  const f = focusAt(scene, t);
  const box = scene === 'c3' ? CAP_BOX_C3 : CAP_BOX;
  out.push({
    id: 'cap', view: f.view, ...box, op: 1, anchor: f.p, edge: 'right',
    kicker: s.title, lines: [s.caps[ph]], big: true,
    tone: ph === s.ph.length - 1 ? 'ok' : 'accent',
  });

  if (scene === 'c1') {
    const hereOp = win(t, 1.0, 1.5) * (1 - win(t, 2.6, 3.0));
    if (hereOp > 0.01) {
      out.push({
        id: 'here', view: 'plan', x: 640, y: 212, w: 196, h: 56, op: hereOp,
        anchor: {x: ISL.x1, y: (PAD_PLAN.y0 + PAD_PLAN.y1) / 2}, edge: 'left',
        lines: ['包放这里 · 软包扶手段'], tone: 'accent',
      });
    }
    const stOp = win(t, 4.05, 4.5);
    if (stOp > 0.01) {
      const st = stateAt(scene, t);
      out.push({
        id: 'state', view: 'side', x: 660, y: 70, w: 220, h: 88, op: stOp,
        anchor: {x: BAG.x + BAG.w, y: bagBottom(scene, t) - BAG.h * 0.42}, edge: 'left',
        kicker: '固定状态', lines: [STATE_LABEL[st]],
        tone: st === 'locked' ? 'ok' : 'accent',
      });
    }
  }

  if (scene === 'c2') {
    const stOp = win(t, 0.5, 1.0);
    if (stOp > 0.01) {
      const tv = tetherAt(scene, t);
      const lines = ph >= 4
        ? ['活动范围 · 半径 260mm']
        : [tv.connected > 0.99 ? '已连接 · 绳长 260mm' : '未连接'];
      out.push({
        id: 'tether', view: 'side', x: 660, y: 70, w: 220, h: 88, op: stOp,
        anchor: {x: BAG.x + BAG.w, y: BAG_RIM_Y + 10}, edge: 'left',
        kicker: '包内栓扣', lines, tone: tv.connected > 0.99 ? 'ok' : 'accent',
      });
    }
  }

  if (scene === 'c3') {
    const threeOp = smooth(win(t, 2.1, 2.6));
    if (threeOp > 0.01) {
      out.push({
        id: 'three', view: 'plan', x: 644, y: 286, w: 278, h: 150, op: threeOp,
        anchor: LEVELS[0].at, edge: 'left',
        kicker: '三级固定', lines: LEVELS.map((l) => `${l.tag} · ${l.note}`), tone: 'accent',
      });
    }
    const rk = reachK(scene, t);
    if (rk > 0.01) {
      out.push({
        id: 'reachL', view: 'plan', x: 76, y: 176, w: 230, h: 58, op: rk,
        anchor: {x: CABIN.x0 + 6, y: SHOULDER.driver.y + 34}, edge: 'right',
        lines: ['驾驶位单臂可及 700mm'], tone: 'accent',
      });
      out.push({
        id: 'reachR', view: 'plan', x: 644, y: 176, w: 230, h: 58, op: rk,
        anchor: {x: CABIN.x1 - 6, y: SHOULDER.front.y + 34}, edge: 'left',
        lines: ['副驾单臂可及 700mm'], tone: 'accent',
      });
    }
  }

  if (scene === 'c4') {
    const st = stateAt(scene, t);
    out.push({
      id: 'state', view: 'side', x: 660, y: 70, w: 220, h: 88, op: 1,
      anchor: {x: BAG.x + BAG.w, y: bagBottom(scene, t) - BAG.h * 0.42}, edge: 'left',
      kicker: '固定状态', lines: [STATE_LABEL[st]],
      tone: st === 'released' ? 'warn' : 'ok',
    });
  }

  return out;
};

/** 信息卡指向的锚点 → 屏幕坐标 */
export const cardAnchorScreen = (scene: BagKey, t: number, c: Card): Pt =>
  c.view === 'plan' ? planPt(scene, t, c.anchor) : sidePt(c.anchor);

/** 主体外接矩形（屏幕坐标）—— 断言「卡片不压主体」用 */
export const subjectsAt = (scene: BagKey, t: number): Rect[] => {
  const out: Rect[] = [];
  const v = viewAt(scene, t);
  // 推近转场那 1.3s 里平面视是「正在离场的过渡画面」，不作为需要避让的主体
  if (v.planOp > 0.02 && v.zoom < 0.02) {
    const a = planPt(scene, t, {x: BODY.x0, y: BODY.y0});
    const b = planPt(scene, t, {x: BODY.x1, y: BODY.y1});
    out.push({x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y});
  }
  if (v.sideOp > 0.02) {
    // 照片岛台区域（含其下的座椅/中控带）：卡片不许压上去
    out.push({
      x: sideX(ISL_S.x0), y: sideY(ISL_S.top),
      w: (ISL_S.x1 - ISL_S.x0) * SIDE_CAM.s, h: (ISL_S.floor - ISL_S.top) * SIDE_CAM.s,
    });
    const br = bagRect(scene, t);
    out.push({x: sideX(br.x), y: sideY(br.y), w: br.w * SIDE_CAM.s, h: br.h * SIDE_CAM.s});
    const c = catAt(scene, t);
    if (c.op > 0.02) {
      const cb = catBox(c.pose, c.x0);
      out.push({x: sideX(cb.x), y: sideY(cb.y), w: cb.w * SIDE_CAM.s, h: cb.h * SIDE_CAM.s});
    }
  }
  return out;
};

// ── 演示说明（待确认）—— 来自 bag-manifest.json 的 conceptualItems ───────
export const CONCEPTUAL: string[] = [
  '宠物包外观 —— 尺寸、材质、开口形式、敞篷是否可开合均未定义，动画用中性概念件表现',
  '敞篷开合方式未定义 —— 内部文档提到「到达目的地～关闭敞篷」，动画按「行驶中打开、下车前合上」表现，具体铰接与锁止形式待定',
  '岛台固定接口形式未定义（卡扣/磁吸/滑轨/锁舌？），动画以「固定点 + 落锁」概念表现',
  '物理解锁按键的位置、形态、是否需要长按/双击均未定义，动画放在岛台侧面并标注为概念键位',
  '栓扣形式未定义（挂钩/D 环/伸缩绳？）、绳长与限位范围未定义',
  '适用宠物体型区间未定义（文档只写「小型动物，比如猫」）',
  '承重与碰撞工况下的固定强度未定义',
  '行驶中是否有车机侧提示/状态卡未定义，动画中的状态卡为概念 UI',
  '座舱底图为 ES8 官方实拍（俯视 + 前排侧视），侧视为透视照片：只锚定台面接触线，毫米级几何主张由矢量机构层承担；固定插槽/按键画在照片上为概念示意',
  '猫/狗为真实宠物照片抠图的剪纸式动效（单一姿态整体运动），非逐帧动物动画',
  '「车外便携」形态（手提/肩背/单肩带长度）未定义，动画只表现「提起带走」这一步',
];
