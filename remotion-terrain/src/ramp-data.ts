// 宠物上下车斜坡架 · 场景配置 + 纯函数时间轴
//
// 几何常量一律来自 ./ramp-geo（已标定，只读）；本文件只负责「什么时候动到哪里」。
// 所有导出都是纯函数（只吃 t 秒），RampStage 与断言脚本共用同一套，
// 保证「画出来的」和「断言检查的」是同一组数字。
// 禁止 Math.random —— 需要重复图案时用等距/解析式生成。

import {CAR_BODY} from './data';
import {
  DOG, GATE_OPEN_DEG, GY, LIP, RAMP_DEG, RAMP_FOOT, RAMP_LEN, RAMP_THICK,
  TAILGATE_PHOTO, TAILGATE_STAGE, clamp01, mm, pathOf, px2sx, py2sy, rampPt, win,
} from './ramp-geo';

export {CAR_BODY} from './data';
export {
  DOG, GATE_OPEN_DEG, GY, HINGE, K, LIP, LIP_H_MM, MM_PER_PX, RAMP_DEG, RAMP_FOOT,
  RAMP_LEN, RAMP_LEN_MM, RAMP_THICK, TAILGATE_PHOTO, TAILGATE_STAGE, TX, TY,
  clamp01, easeOutBack, frac, mm, pathOf, px2sx, py2sy, rampPt, win,
  T_COLORS, F_UI, F_DATA,
} from './ramp-geo';

// ── 舞台 / 贴图 ──────────────────────────────────────────────────────────
/** 舞台 1000×560 → CSS 1920×1075 */
export const KX = 1.92;
export const KY = 1075 / 560;

/** 照片 → 舞台的摆位（车头朝右，车尾朝左）；mask/clip 的坐标都在这层之内 = 照片坐标 */
export const PLACE = 'translate(438 189.7) scale(0.58) translate(1020 0) scale(-1 1)';

const bodyPts = (CAR_BODY.match(/[\d.]+,[\d.]+/g) ?? []).map(
  (s) => s.split(',').map(Number) as [number, number],
);
/** 车身轮廓（照片坐标）拆成点列 —— 断言用它验证尾门轮廓与车身重合 */
export const CAR_BODY_PTS: [number, number][] = bodyPts;
/** 车身轮廓在舞台坐标下的包围盒（不含轮胎；轮胎在下方由照片自带） */
export const CAR_BOX = {
  x0: Math.min(...bodyPts.map(([x]) => px2sx(x))),
  x1: Math.max(...bodyPts.map(([x]) => px2sx(x))),
  y0: Math.min(...bodyPts.map(([, y]) => py2sy(y))),
  y1: GY,
};
/** 车顶（舞台 y）—— 车高 = GY − CAR_TOP_Y，用于核对「犬肩高 / 车高」 */
export const CAR_TOP_Y = CAR_BOX.y0;

/**
 * 车轮（照片坐标）：本动画车辆静止，不挖轮拱、不画矢量轮，
 * 直接把照片自己的轮子补进 mask（CAR_BODY 的下边缘在轮胎中部，只用它会把轮子切掉）。
 * 半径取放大网格实测胎圈：前 75 / 后 77。
 */
export const TIRES = [
  {cx: 196, cy: 318, r: 75},
  {cx: 770, cy: 318, r: 77},
] as const;
/** 轮胎接地点（舞台坐标），用来放轮下压暗投影 */
export const TIRE_GROUND = TIRES.map((w) => ({x: px2sx(w.cx), r: w.r * 0.58}));

export const TG_PATH_PHOTO = pathOf(TAILGATE_PHOTO);
export const TG_PATH_STAGE = pathOf(TAILGATE_STAGE);
export const CAR_MASK_TIRES = TIRES;

/** 装载口（洞）在舞台坐标下的包围盒 */
export const HOLE = {
  x0: Math.min(...TAILGATE_STAGE.map(([x]) => x)),
  x1: Math.max(...TAILGATE_STAGE.map(([x]) => x)),
  y0: Math.min(...TAILGATE_STAGE.map(([, y]) => y)),
  y1: Math.max(...TAILGATE_STAGE.map(([, y]) => y)),
};

// ── 缓动 ─────────────────────────────────────────────────────────────────
export const ease = (k: number) => {
  k = clamp01(k);
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
};
export const easeOut = (k: number) => 1 - Math.pow(1 - clamp01(k), 3);
export const easeIn = (k: number) => Math.pow(clamp01(k), 3);
/**
 * 阻尼弹簧（纯函数，等效 remotion spring damping≈14）。
 * 写成解析式而不是直接调 remotion 的 spring()，是为了让 node 断言脚本能跑同一条曲线。
 * k=0 → 0，k=1 → 1（末段用 k³ 权重收敛，保证端点精确）。
 */
export const springK = (k: number) => {
  k = clamp01(k);
  const raw = 1 - Math.exp(-5.6 * k) * Math.cos(6.0 * k);
  const w = k * k * k;
  return raw * (1 - w) + w;
};
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

// ── 犬 ───────────────────────────────────────────────────────────────────
export type Pose = 'walk' | 'stand' | 'sit' | 'lie' | 'crouch' | 'lookup';
export interface DogState {
  x: number; y: number; rot: number;
  pose: Pose; senior: boolean;
  /** 已进入装载口的程度 0→1（犬只画一份，被车身遮挡即为「走进车里」） */
  inside: number;
  /** 是否踩在坡面上（断言用） */
  onRamp: boolean;
}
/**
 * 四掌基准 x（犬局部坐标，单位 = 肩高 h）。取自 Dog.tsx 契约：
 * FORE_PAW0 = [+0.520, 0]，HIND_PAW0 = [−0.520, 0]，四足踩 y = 0。
 * walk 步态下还要叠 Dog 导出的 pawDX / pawY（摆动相会抬起，属正常步态）。
 */
export const PAW_BASE_U: Record<'FL' | 'FR' | 'HL' | 'HR', number> = {
  FL: 0.52, FR: 0.52, HL: -0.52, HR: -0.52,
};
/**
 * 犬外接框（局部坐标）拆成两块：躯干+头+尾在上，四肢在下。
 * 不能用一个大矩形 —— 犬在坡上整体旋转时，大矩形的空角会伸到坡面以下，
 * 让「信息卡压不压犬」的判定失真。
 */
export const DOG_PARTS = [
  {x0: -0.62 * DOG.bodyPx, x1: 0.68 * DOG.bodyPx, y0: -1.32 * DOG.witherPx, y1: -0.34 * DOG.witherPx},
  {x0: -0.72 * DOG.witherPx, x1: 0.72 * DOG.witherPx, y0: -0.34 * DOG.witherPx, y1: 0},
];

const rot2 = (px: number, py: number, deg: number) => {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return {x: px * c - py * s, y: px * s + py * c};
};

/** 犬局部坐标 → 舞台坐标（只有 translate + rotate，与渲染端完全一致） */
export const dogToStage = (d: DogState, lx: number, ly: number) => {
  const p = rot2(lx, ly, d.rot);
  return {x: d.x + p.x, y: d.y + p.y};
};

/** 四掌（站立基准位）在舞台坐标下的落点 */
export const pawPoints = (d: DogState) =>
  (['FL', 'FR', 'HL', 'HR'] as const).map((leg) =>
    dogToStage(d, PAW_BASE_U[leg] * DOG.witherPx, 0),
  );

/** 犬在舞台坐标下的轴对齐包围盒（两块局部框旋转后取并集） */
export const dogBox = (d: DogState) => {
  const cs = DOG_PARTS.flatMap((b) =>
    [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]].map(([px, py]) => dogToStage(d, px, py)),
  );
  return {
    x0: Math.min(...cs.map((c) => c.x)), x1: Math.max(...cs.map((c) => c.x)),
    y0: Math.min(...cs.map((c) => c.y)), y1: Math.max(...cs.map((c) => c.y)),
  };
};

// ── 坡道（折叠件）────────────────────────────────────────────────────────
export interface RampState {
  /** 是否已经出现在画面里 */
  on: boolean;
  /** 段一（上半段）的上端点 + 下坡角（度） */
  topX: number; topY: number; angA: number;
  /** 折叠角：180 = 完全折起（段二压在段一上），0 = 展平成一条直线 */
  fold: number;
  /** 单段长度 */
  segLen: number;
  /** 就位（坡面高亮 / 接地投影）程度 0→1 */
  seated: number;
}
export const SEG_LEN = RAMP_LEN / 2;

/** 段二的上端点（= 折叠铰链） */
export const rampJoint = (r: RampState) => {
  const a = (r.angA * Math.PI) / 180;
  return {x: r.topX - r.segLen * Math.cos(a), y: r.topY + r.segLen * Math.sin(a)};
};
/** 某一段的下端点（画板用：translate(下端点) rotate(−角度)，局部 +x 指向上坡） */
export const segLow = (topX: number, topY: number, deg: number, len: number) => {
  const a = (deg * Math.PI) / 180;
  return {x: topX - len * Math.cos(a), y: topY + len * Math.sin(a)};
};

/** 防滑横棱：等距解析生成，绝不用 Math.random */
export const CLEATS = Array.from({length: 15}, (_, i) => 13 + i * 12.4);

// ── 信息卡 ───────────────────────────────────────────────────────────────
export interface Rect {x: number; y: number; w: number; h: number}
/** 叙事卡尺寸（舞台单位）；x 随焦点轻微跟随并 clamp 在安全区 */
export const CARD_W = 330;
export const CARD_H = 126;
export const CARD_Y = 112;
export const cardBox = (focusX: number): Rect => ({
  x: Math.max(24, Math.min(62, focusX - 340)),
  y: CARD_Y, w: CARD_W, h: CARD_H,
});

// 各章的读数条（舞台单位）——渲染与断言共用，位置只写一次
export const PILL = {
  c1H: {x: 300, y: 290, w: 158, h: 42} as Rect,          // 装载口离地读数
  c2Lip: {x: 36, y: 300, w: 176, h: 30} as Rect,         // 装载口高度参考线标签
  c2Apex: {x: 36, y: 368, w: 200, h: 30} as Rect,        // 起跳最高点标签
  c3Len: {x: 272, y: 310, w: 154, h: 30} as Rect,        // 坡长
  c3Ang: {x: 244, y: 430, w: 100, h: 28} as Rect,        // 坡度
} as const;

// ── 场景 ─────────────────────────────────────────────────────────────────
export type RampKey = 'c1' | 'c2' | 'c3' | 'c4';

export interface RampScene {
  T: number;
  ph: number[];          // 相位分界（秒），phaseOf 返回 0..4
  caps: string[];        // 5 条字幕，与相位一一对应
  chip: string;
  sub: string;
  title: string;
}

export const RAMP_SCENES: Record<RampKey, RampScene> = {
  c1: {
    T: 10.0,
    ph: [1.6, 4.0, 5.6, 7.8, 10.0],
    caps: [
      '犬走到车尾 —— 上车前先要过这道坎',
      '电动尾门抬起，装载口打开',
      '犬抬头看：装载口高过它的肩',
      '从地面量到装载口下沿',
      '离地 ≈ 787mm，相当于要跨一整级台阶',
    ],
    chip: '第一章 · 打开后备箱 · 看清高度差',
    sub: '尾门抬起 72°，标出装载口离地高度',
    title: '打开后备箱 · 看清高度差',
  },
  c2: {
    T: 9.0,
    ph: [1.9, 3.5, 5.2, 6.6, 9.0],
    caps: [
      '不装架子：犬只能整只跳上去',
      '后腿蓄力，一次起跳',
      '最高点还差约 25%，前爪够不到装载口',
      '老年犬跳得更低，基本上不去',
      '落地冲击集中在前肢关节，反复跳会伤关节',
    ],
    chip: '第二章 · 不用架子会怎样',
    sub: '起跳够不到装载口，落地冲击伤关节',
    title: '不用架子会怎样',
  },
  c3: {
    T: 11.0,
    ph: [2.6, 4.8, 6.2, 8.6, 11.0],
    caps: [
      '斜坡架折叠收在后备箱里（收纳位置待定义）',
      '取出后放到车尾地面',
      '两段展开，顶端挂钩往门槛上一搭',
      '坡长 2000mm，装载口高 787mm',
      'sin 23° = 787 / 2000 —— 坡度就是这么来的',
    ],
    chip: '第三章 · 装上斜坡架',
    sub: '取出、展开、搭上门槛，坡度 23°',
    title: '装上斜坡架',
  },
  c4: {
    T: 12.0,
    ph: [2.6, 7.4, 9.2, 10.6, 12.0],
    caps: [
      '斜坡架就位，犬自己走到坡脚',
      '四足踩在坡面上，身体与坡面平行',
      '越过门槛，自己走进后备箱',
      '在装载口里趴下',
      '不用抱、不用跳',
    ],
    chip: '第四章 · 犬自己走上去',
    sub: '顺坡上车、进入装载口、趴下',
    title: '犬自己走上去',
  },
};

export const RAMP_KEYS: RampKey[] = ['c1', 'c2', 'c3', 'c4'];

export const phaseOf = (s: RampScene, t: number) => {
  for (let i = 0; i < s.ph.length; i++) if (t < s.ph[i]) return i;
  return s.ph.length - 1;
};
export const phaseStart = (s: RampScene, i: number) => (i === 0 ? 0 : s.ph[i - 1]);

// ── 时间轴：尾门 ─────────────────────────────────────────────────────────
/** 尾门开启角（照片坐标系下的度数；舞台里因为镜像要取负号）。0 → GATE_OPEN_DEG */
export const GATE_T0 = 1.6;
export const GATE_T1 = 3.8;   // 2.2s 开合
export const gateDegAt = (scene: RampKey, t: number) => {
  if (scene !== 'c1') return GATE_OPEN_DEG;         // 其余章节尾门已开
  return GATE_OPEN_DEG * ease(win(t, GATE_T0, GATE_T1));
};
/** 归一化开合度 0→1（内景 / 洞的显隐都用它） */
export const gateKAt = (scene: RampKey, t: number) => gateDegAt(scene, t) / GATE_OPEN_DEG;

// ── 时间轴：第二章的起跳抛物线 ───────────────────────────────────────────
/** 起跳最高点只能达到装载口高度的这个比例 —— 差 25% / 老年犬差 54% */
export const JUMP_REACH = 0.75;
export const JUMP_REACH_SR = 0.46;
export const LIP_H_PX = GY - LIP.y;                 // 79.5
export const JUMP_APEX_Y = GY - LIP_H_PX * JUMP_REACH;      // 360.375
export const JUMP_APEX_Y_SR = GY - LIP_H_PX * JUMP_REACH_SR;
const J1 = {t0: 1.9, t1: 3.05, x0: 356, x1: 398, apex: JUMP_APEX_Y};
const J2 = {t0: 5.0, t1: 6.0, x0: 356, x1: 382, apex: JUMP_APEX_Y_SR};
export const JUMPS = [J1, J2];

// ── 时间轴：犬 ───────────────────────────────────────────────────────────
/**
 * 上坡的参数区间：让「后掌不踩出坡脚」与「前掌不越过门槛」都成立。
 * 掌心到犬原点 = 0.52·h（Dog 契约 FORE_PAW0/HIND_PAW0），
 * 走起来还要再让出半个步幅 0.5×strideHind = 0.17·h（Dog.DOG_GAIT）。
 */
export const U_PAD = ((0.52 + 0.17) * DOG.witherPx) / RAMP_LEN;
export const U_LO = U_PAD;
export const U_HI = 1 - U_PAD;

export const dogAt = (scene: RampKey, t: number): DogState => {
  const base: DogState = {
    x: 0, y: GY, rot: 0, pose: 'stand', senior: false, inside: 0, onRamp: false,
  };
  if (scene === 'c1') {
    const k = ease(win(t, 0.15, 2.5));
    const x = lerp(118, 236, k);
    const pose: Pose = t < 2.5 ? 'walk' : t < 4.1 ? 'stand' : 'lookup';
    return {...base, x, pose};
  }
  if (scene === 'c2') {
    let x = 356, y = GY;
    let pose: Pose = 'stand';
    let senior = false;
    if (t < 0.9) pose = 'stand';
    else if (t < J1.t0) pose = 'crouch';
    else if (t < J1.t1) {
      const k = win(t, J1.t0, J1.t1);
      x = lerp(J1.x0, J1.x1, k);
      y = GY - (GY - J1.apex) * 4 * k * (1 - k);      // 抛物线：k=0.5 时到最高点
      pose = 'crouch';
    } else if (t < 4.2) { x = J1.x1; pose = 'stand'; }
    else if (t < J2.t0) { x = J1.x1; pose = 'crouch'; senior = true; }
    else if (t < J2.t1) {
      const k = win(t, J2.t0, J2.t1);
      x = lerp(J1.x1, J2.x1, k);
      y = GY - (GY - J2.apex) * 4 * k * (1 - k);
      pose = 'crouch'; senior = true;
    } else { x = J2.x1; pose = 'stand'; senior = true; }
    return {...base, x, y, pose, senior};
  }
  if (scene === 'c3') {
    const k = ease(win(t, 0.2, 1.6));
    const x = lerp(80, 140, k);
    const pose: Pose = t < 1.6 ? 'walk' : t < 6.6 ? 'stand' : 'sit';
    return {...base, x, pose};
  }
  // c4
  const WALK0 = 0.3, WALK1 = 2.3, STEP0 = 2.4, STEP1 = 3.1, CLIMB1 = 7.2, IN0 = 7.2, IN1 = 8.9;
  const onFoot = rampPt(U_LO);
  const X_ON = onFoot.x - 10;                       // 踏上坡面前的站位
  if (t < STEP0) {
    const x = lerp(96, X_ON, ease(win(t, WALK0, WALK1)));
    return {...base, x, pose: t < WALK1 ? 'walk' : 'stand'};
  }
  if (t < STEP1) {
    // 踏上坡面：身体从水平摆到与坡面平行（连续过渡，不是硬切）
    const k = ease(win(t, STEP0, STEP1));
    return {
      ...base, x: lerp(X_ON, onFoot.x, k), y: lerp(GY, onFoot.y, k),
      rot: lerp(0, -RAMP_DEG, k), pose: 'walk',
    };
  }
  if (t < IN0) {
    const u = lerp(U_LO, U_HI, ease(win(t, STEP1, CLIMB1)));
    const p = rampPt(u);
    return {...base, x: p.x, y: p.y, rot: -RAMP_DEG, pose: 'walk', onRamp: true};
  }
  // 跨过门槛：前掌先上载物平面，身体从坡角摆平，整只犬被车身遮住 = 走进车里
  const from = rampPt(U_HI);
  const k = ease(win(t, IN0, IN1));
  const x = lerp(from.x, 506, k);
  const y = lerp(from.y, LIP.y, clamp01(win(t, IN0, IN0 + (IN1 - IN0) * 0.6)));
  const rot = lerp(-RAMP_DEG, 0, clamp01(win(t, IN0, IN0 + (IN1 - IN0) * 0.7)));
  const pose: Pose = t < 9.2 ? 'walk' : 'lie';
  return {...base, x, y, rot, pose, inside: clamp01((x - LIP.x) / 22)};
};

// ── 时间轴：坡道 ─────────────────────────────────────────────────────────
export const RAMP_OUT0 = 0.7, RAMP_OUT1 = 2.4;     // 从洞里滑出
export const RAMP_TIP0 = 2.5, RAMP_TIP1 = 3.5;     // 立起到坡角
export const RAMP_UNF0 = 3.7, RAMP_UNF1 = 5.0;     // 展开
export const rampAt = (scene: RampKey, t: number): RampState => {
  const done: RampState = {
    on: true, topX: LIP.x, topY: LIP.y, angA: RAMP_DEG, fold: 0, segLen: SEG_LEN, seated: 1,
  };
  if (scene === 'c4') return done;
  if (scene !== 'c3') return {...done, on: false, seated: 0};
  if (t < RAMP_OUT0) return {...done, on: false, topX: 648, topY: 337, angA: 0, fold: 180, seated: 0};
  const outK = ease(win(t, RAMP_OUT0, RAMP_OUT1));
  const tipK = ease(win(t, RAMP_TIP0, RAMP_TIP1));
  const unfK = springK(win(t, RAMP_UNF0, RAMP_UNF1));
  return {
    on: true,
    topX: lerp(648, LIP.x, outK),
    topY: lerp(337, LIP.y, outK),
    angA: RAMP_DEG * tipK,
    fold: 180 * (1 - unfK),
    segLen: SEG_LEN,
    seated: clamp01(win(t, RAMP_UNF1 - 0.15, RAMP_UNF1 + 0.5)),
  };
};

// ── 焦点（引导线端点）─────────────────────────────────────────────────────
export const focusAt = (scene: RampKey, t: number) => {
  const d = dogAt(scene, t);
  if (scene === 'c1') return t < GATE_T1 ? {x: LIP.x + 8, y: 300} : {x: 452, y: 380};
  if (scene === 'c2') return {x: d.x - 26, y: d.y - DOG.witherPx * 0.8};
  if (scene === 'c3') {
    const r = rampAt(scene, t);
    if (t < RAMP_TIP0) return {x: r.topX - 40, y: r.topY + 10};
    return {x: rampPt(0.55).x, y: rampPt(0.55).y - 6};
  }
  return {x: d.x - 20, y: d.y - DOG.witherPx * 0.9};
};

/** 本帧所有「矩形信息块」（叙事卡 + 读数条）—— 断言检查出界 / 压主体用 */
export const infoRects = (scene: RampKey, t: number): (Rect & {id: string})[] => {
  const f = focusAt(scene, t);
  const out: (Rect & {id: string})[] = [{...cardBox(f.x), id: 'caption'}];
  if (scene === 'c1' && t >= 6.0) out.push({...PILL.c1H, id: 'c1H'});
  if (scene === 'c2' && t >= 2.2) out.push({...PILL.c2Lip, id: 'c2Lip'});
  if (scene === 'c2' && t >= 3.0) out.push({...PILL.c2Apex, id: 'c2Apex'});
  if (scene === 'c3' && t >= 6.4) {
    out.push({...PILL.c3Len, id: 'c3Len'}, {...PILL.c3Ang, id: 'c3Ang'});
  }
  if (scene === 'c4' && t >= 0) out.push({...PILL.c3Ang, id: 'c3Ang'});
  return out;
};

// ── 读数文案 ─────────────────────────────────────────────────────────────
export const RAMP_DEG_TXT = RAMP_DEG.toFixed(0);
export const REACH_MM = Math.round(LIP_H_PX * JUMP_REACH * 9.9);
export const SHORT_PCT = Math.round((1 - JUMP_REACH) * 100);

/** 演示说明（待确认）—— 与 ramp-manifest.json 的 conceptualItems 一致 */
export const CONCEPTUAL: string[] = [
  '斜坡架外观 —— 长度、宽度、折叠/伸缩方式、防滑面材质、与门槛的固定方式均未定义，动画用中性概念件表现',
  '承重上限与适用体型区间未定义',
  '收纳位置未定义（动画从后备箱侧壁取出，仅为示意）',
  '装载口离地高度按官方侧视照片推算约 787mm，非实车标定值',
  '推荐坡度与坡长为按 asin(装载口高/坡长) 反推的概念值（2000mm 坡长 ⇒ 23°），非产品规格',
  '是否配合空气悬架「装载模式」降低尾部未定义 —— 若可降 60mm，同样坡长可缓到约 21°',
  '尾门开启后的装载口内景为概念示意，非实拍内饰',
  '犬只为中大型犬概念形象（肩高 570mm / 体长 950mm），非特定犬种',
];

export const RAMP_THICK_PX = RAMP_THICK;
export const MM_TXT = (px: number) => `${Math.round(px * 9.9)}mm`;
export const mmPx = mm;
