// 平移泊入动画 · 常量、四轮转向运动学与场景配置
// 视觉资产：ES9 正俯视照片（用户上传 PDF 第 2 页截帧；已纵向归正到 长/宽 = 5365/2029）
// 教育点：
//   场景一 —— 前轮 40° / 后轮同向 8°，前后转角不等 ⇒ 车身横摆（yaw），把翘在位外的车头摆正
//   场景二 —— 前后轮同为 8°，转角相等 ⇒ 横摆为零，车身纯平移，碎步净横移入位

export {T_COLORS, F_UI, F_DATA, clamp01, win, easeOutBack, frac} from './data';

// 车身轮廓（贴图 342×704 坐标系，车头朝上；含后视镜，已内缩 2px 防背景渗出）
// 车头按斜置灯带外缘描线：ES9 车头没有圆角，两侧灯带的斜线本身就是轮廓
export const CAR_TOP_BODY =
  'M147.2,11.6L162.0,11.6L176.9,11.6L191.7,12.6L206.6,15.4L221.4,18.2L228.1,21.0L236.9,25.7L244.6,32.1L251.5,39.7L258.4,48.2L265.3,57.7L271.3,67.2L276.2,76.6L280.1,88.0L284.1,99.5L288.1,111.0L292.0,123.3L292.0,146.8L291.0,170.7L291.0,195.0L290.0,219.1L292.4,227.7L302.9,234.0L311.5,240.3L315.0,246.9L313.5,253.1L302.5,257.2L290.6,259.7L289.0,266.9L289.0,295.5L289.0,324.9L288.0,353.3L288.0,381.7L287.0,415.2L287.0,448.7L286.0,483.2L286.0,516.6L285.0,550.0L284.0,578.4L283.0,601.0L285.0,619.9L280.2,636.6L272.3,650.5L264.5,660.4L256.7,669.4L247.2,676.2L231.5,680.1L214.6,685.1L199.9,686.1L179.9,687.1L160.0,688.1L140.1,687.1L120.2,686.1L105.4,684.1L92.5,681.1L80.7,678.1L71.0,673.2L61.4,667.4L53.8,654.7L47.9,641.8L42.9,624.7L39.0,609.6L36.0,590.5L36.0,573.5L36.0,545.1L36.0,511.6L36.0,478.1L36.0,444.6L36.0,411.1L36.0,376.6L36.0,343.2L36.0,309.7L37.0,281.3L37.0,266.9L35.4,259.7L23.5,257.2L12.5,253.1L11.0,246.9L14.5,240.3L23.1,234.0L33.4,227.9L37.9,219.4L38.0,195.0L38.0,170.7L38.0,146.8L39.0,123.0L39.0,109.5L40.0,98.2L42.0,86.8L44.9,75.5L47.8,66.1L52.7,56.7L58.6,47.3L65.5,38.8L73.3,31.3L81.0,25.8L90.6,22.1L102.4,19.3L117.3,16.4L132.3,14.5Z';

export const CAR_SRC = {w: 342, h: 704};

// 车身包围盒：不含后视镜的车体外廓 —— 256 × 676 ↔ 2029mm × 5365mm（比例 2.641 : 实车 2.644）
export const CAR_BBOX = {x0: 36, y0: 12, x1: 292, y1: 688};

// 语义锚点（归一化 0–1，基于 CAR_BBOX，即车体外廓）
// 俯视照片看不到车轮：轮位按实车推算（前悬 1000 / 轴距 3250 / 后悬 1115；轮距 1730）
export const TOP_ANCHORS = {
  'vehicle.center': {x: 0.5, y: 0.5},
  'wheel.fl': {x: 0.074, y: 0.186},
  'wheel.fr': {x: 0.926, y: 0.186},
  'wheel.rl': {x: 0.074, y: 0.792},
  'wheel.rr': {x: 0.926, y: 0.792},
  'roof.sensor': {x: 0.5, y: 0.27},
} as const;

/** 舞台像素 → 毫米（车长 5365mm 对应 CAR_H=236px） */
export const MM_PER_PX = 5365 / 236;

// ---------------------------------------------------------------------------
// 车身显示尺寸与轴距
// ---------------------------------------------------------------------------
export const CAR_H = 236;                                        // 车长（舞台 px）↔ 5365mm
export const CAR_SCALE = CAR_H / (CAR_BBOX.y1 - CAR_BBOX.y0);    // 贴图 → 舞台
export const CAR_W = (CAR_BBOX.x1 - CAR_BBOX.x0) * CAR_SCALE;    // ≈ 89.37px ↔ 2031mm

/** 轴距（舞台 px）：3250mm / 22.733 ≈ 142.96 —— 与 TOP_ANCHORS 前后轮间距 143.0 一致 */
export const L_WB = 3250 / MM_PER_PX;
/** 后轴中心相对车身中心的偏移（沿车头方向为负；此处取标量：后轴在中心之后 REAR_OFF px） */
export const REAR_OFF = (TOP_ANCHORS['wheel.rl'].y - 0.5) * CAR_H;   // 68.912
export const FRONT_OFF = (0.5 - TOP_ANCHORS['wheel.fl'].y) * CAR_H;  // 74.104

// 转向物理（用户给定的真实约束）
export const F_MAX = 40;   // 前轮最大转角
export const R_MAX = 8;    // 后轮同向最大转角

// 舞台 1000×560；路边平行车位竖排在右侧，开口（临车道）在左边虚线、右侧封闭
// 车位 112 × 250px ↔ 2546mm × 5683mm（车体 2029mm，两侧各留约 250mm，符合标准车位）
export const SLOT = {x: 600, y: 280, w: 112, h: 250};
export const SLOT_L = SLOT.x - SLOT.w / 2;   // 544 —— 开口虚线
export const SLOT_R = SLOT.x + SLOT.w / 2;   // 656 —— 封闭实线
export const NEIGHBORS = [
  {x: 600, y: 10},    // 前车（上）
  {x: 600, y: 550},   // 后车（下）
];

const RAD = Math.PI / 180;

// ---------------------------------------------------------------------------
// 四轮转向运动学（自行车模型，参考点 = 后轴中心）
//   dψ/ds = cos(δr)·(tanδf − tanδr)/L        ψ：航向（rad，math 约定，ψ=−90° ⇒ 车头朝 −y）
//   dx/ds = cos(ψ + δr)，dy/ds = sin(ψ + δr)  s：后轴点带符号路程（s>0 前进，s<0 倒车）
// 校验：δr=0 ⇒ dψ/ds = tanδf/L（经典自行车模型）；δf=δr ⇒ dψ/ds = 0（纯平移）
// SVG 呈现角 θ = ψ + 90°（θ=0 车头朝上），dθ = dψ
// ---------------------------------------------------------------------------

/** 单位路程横摆率（rad/px） */
export const yawRate = (df: number, dr: number) =>
  (Math.cos(dr * RAD) * (Math.tan(df * RAD) - Math.tan(dr * RAD))) / L_WB;

/** 沿一段常转角轨迹解析积分后轴点位姿；s 带符号 */
export function integrate(
  rx: number, ry: number, psi: number, s: number, df: number, dr: number,
): [number, number, number] {
  const k = yawRate(df, dr);
  const d = dr * RAD;
  if (Math.abs(k) < 1e-12) {
    return [rx + s * Math.cos(psi + d), ry + s * Math.sin(psi + d), psi];
  }
  const p1 = psi + k * s;
  return [
    rx + (Math.sin(p1 + d) - Math.sin(psi + d)) / k,
    ry + (-Math.cos(p1 + d) + Math.cos(psi + d)) / k,
    p1,
  ];
}

/** 后轴点 + 航向 → 车身中心 */
export const centerOf = (rx: number, ry: number, psi: number): [number, number] =>
  [rx + REAR_OFF * Math.cos(psi), ry + REAR_OFF * Math.sin(psi)];

/** 车身旋转矩形四角（舞台坐标） */
export function carCorners(cx: number, cy: number, thDeg: number): [number, number][] {
  const c = Math.cos(thDeg * RAD), s = Math.sin(thDeg * RAD);
  return ([[-CAR_W / 2, -CAR_H / 2], [CAR_W / 2, -CAR_H / 2], [CAR_W / 2, CAR_H / 2], [-CAR_W / 2, CAR_H / 2]] as const)
    .map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c] as [number, number]);
}

/** 旋转后车身包围盒半宽 / 半高（用于信息卡避让与出界判断） */
export const halfSpan = (thDeg: number) => {
  const c = Math.abs(Math.cos(thDeg * RAD)), s = Math.abs(Math.sin(thDeg * RAD));
  return {w: (CAR_W * c + CAR_H * s) / 2, h: (CAR_H * c + CAR_W * s) / 2};
};

// ---------------------------------------------------------------------------
// 分段序列
// ---------------------------------------------------------------------------
// 场景一：6 段「前进(+40/+8) → 倒车(−40/−8)」交替。
// 前进时 ds>0、dψ/ds>0；倒车时 ds<0、dψ/ds<0 —— 两段横摆同号，车头单调摆正。
// 每段路程 = 总横摆 / (κ · 段数)，κ = cos8°·(tan40°−tan8°)/L ≈ 0.2772 °/px。
const A_YAW0 = 22;      // 初始偏航角（°，车头朝开口方向翘出）
const A_SEGS = 6;
const A_PER = (A_YAW0 * RAD) / yawRate(F_MAX, R_MAX) / A_SEGS;   // ≈ 13.23px
const A_STEPS = Array.from({length: A_SEGS}, (_, i) => (i % 2 === 0 ? A_PER : -A_PER));

// 场景二：前后同为 8° ⇒ 横摆恒为 0，行进方向 = 车头 ± 8°。
// 每对「前进 d + 倒车 d」净横移 2d·sin8°；首尾各取半段，使纵向摆幅关于车位中心对称、且首尾等高。
const B_PAIRS = 8;
const B_LAT = 56;                                                 // 需要的净横移（车心 544 → 600）
const B_D = B_LAT / (2 * B_PAIRS * Math.sin(R_MAX * RAD));        // ≈ 25.15px
const B_STEPS = [
  B_D / 2,
  ...Array.from({length: B_PAIRS - 1}, () => [-B_D, B_D]).flat(),
  -B_D,
  B_D / 2,
];

export interface PkScene {
  chip: string;
  sub: string;
  caps: string[];
  /** 展示用前轮转角 */
  df: number;
  /** 展示用后轮转角（同向） */
  dr: number;
  /** 初始偏航角（SVG rotate 度；负号 = 车头朝车位开口方向翘出） */
  yaw0: number;
  /** 带符号路程序列（px，>0 前进 / <0 倒车） */
  steps: number[];
  /** 时序（秒） */
  tIdle: number;
  tTap: number;
  tSteerIn: number;
  tHold: number;
  tMove: number;
  tTurn: number;
  tOut: number;
  tEnd: number;
}

export const PK_SCENES: Record<'a' | 'b', PkScene> = {
  a: {
    chip: '场景一 · 车尾已入位 · 摆正车头',
    sub: '前轮 40°、后轮同向 8°，前后不等产生横摆，把翘在外的车头摆进车位',
    caps: [
      '人工泊入：车尾已进车位，车头还斜翘在位外',
      '点按开启，方向盘与后轮同时交给系统',
      '前轮 40° · 后轮同向 8° —— 前后不等 ⇒ 车身横摆，车头往里摆',
      '前进 · 倒车碎步交替，两个方向都在往同一侧摆正车头',
      '偏航归零，车身正落车位中心，车轮回正',
    ],
    df: F_MAX,
    dr: R_MAX,
    yaw0: -A_YAW0,
    steps: A_STEPS,
    tIdle: 1.3, tTap: 1.0, tSteerIn: 0.5, tHold: 1.2,
    tMove: 0.5, tTurn: 0.32, tOut: 0.6, tEnd: 1.7,
  },
  b: {
    chip: '场景二 · 车身已摆正 · 平移入位',
    sub: '前后轮同为 8°、转角一致，横摆为零，碎步把最后半个车身整体平移进去',
    caps: [
      '人工泊入：车身已与车位平行，还有半个车身在位外',
      '点按开启，四个车轮同步接管',
      '前后轮同为 8° · 转角一致 ⇒ 车身不转，整体平移',
      '斜向前挪 · 反向后挪，纵向抵消、横向累积，车身始终摆正',
      '横移到位，车身正落车位中心，车轮回正',
    ],
    df: R_MAX,
    dr: R_MAX,
    yaw0: 0,
    steps: B_STEPS,
    tIdle: 1.3, tTap: 1.0, tSteerIn: 0.5, tHold: 1.2,
    tMove: 0.26, tTurn: 0.22, tOut: 0.6, tEnd: 1.7,
  },
};

// ---------------------------------------------------------------------------
// 时间轴
// ---------------------------------------------------------------------------
export type Seg =
  | {type: 'still'; t0: number; dur: number; rx: number; ry: number; psi: number; f: number; r: number; ph: number; tap?: boolean}
  | {type: 'steer'; t0: number; dur: number; rx: number; ry: number; psi: number; f0: number; f1: number; r0: number; r1: number; ph: number}
  | {type: 'move'; t0: number; dur: number; rx: number; ry: number; psi: number; s: number; f: number; r: number; ph: number};

export interface Built {
  segs: Seg[];
  phStarts: number[];
  T: number;
  plan: string;
  tTap: number;
  tDone: number;
  start: {x: number; y: number; th: number};
}

const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

/**
 * 生成时间轴：先从 (0,0,ψ0) 正向积分整条分段序列得到累计位移与终态，
 * 再把起点反推为「目标位姿 − 累计位移」—— 终点天然精确落在 (SLOT.x, SLOT.y, θ=0)。
 */
export function buildPark(s: PkScene): Built {
  const psi0 = (-90 + s.yaw0) * RAD;

  // 1) 正向积分求累计位移
  let ax = 0, ay = 0, ap = psi0;
  for (const st of s.steps) {
    const df = st > 0 ? s.df : -s.df;
    const dr = st > 0 ? s.dr : -s.dr;
    [ax, ay, ap] = integrate(ax, ay, ap, st, df, dr);
  }
  // 2) 反推起点后轴位置：终态 ψ = −90° ⇒ 目标后轴 = 车位中心 + (0, REAR_OFF)
  let rx = SLOT.x - ax;
  let ry = SLOT.y + REAR_OFF - ay;
  let psi = psi0;

  const segs: Seg[] = [];
  let t = 0;
  const add = (o: any) => { segs.push({...o, t0: t}); t += o.dur; };

  // ph0 初始态 / ph1 点按开启
  add({type: 'still', dur: s.tIdle, rx, ry, psi, f: 0, r: 0, ph: 0});
  add({type: 'still', dur: s.tTap, rx, ry, psi, f: 0, r: 0, ph: 1, tap: true});

  // ph2 打角说明：0 → (df, dr)，然后保持一段时间读数
  add({type: 'steer', dur: s.tSteerIn, rx, ry, psi, f0: 0, f1: s.df, r0: 0, r1: s.dr, ph: 2});
  add({type: 'still', dur: s.tHold, rx, ry, psi, f: s.df, r: s.dr, ph: 2});

  // ph3 碎步执行
  const pts: [number, number][] = [[rx, ry]];
  for (let i = 0; i < s.steps.length; i++) {
    const st = s.steps[i];
    const df = st > 0 ? s.df : -s.df;
    const dr = st > 0 ? s.dr : -s.dr;
    if (i > 0) {
      const pf = s.steps[i - 1] > 0 ? s.df : -s.df;
      const pr = s.steps[i - 1] > 0 ? s.dr : -s.dr;
      add({type: 'steer', dur: s.tTurn, rx, ry, psi, f0: pf, f1: df, r0: pr, r1: dr, ph: 3});
    }
    add({type: 'move', dur: s.tMove, rx, ry, psi, s: st, f: df, r: dr, ph: 3});
    for (let j = 1; j <= 6; j++) {
      const [px, py] = integrate(rx, ry, psi, (st * j) / 6, df, dr);
      pts.push([px, py]);
    }
    [rx, ry, psi] = integrate(rx, ry, psi, st, df, dr);
  }

  // ph4 完成回正
  const lf = s.steps[s.steps.length - 1] > 0 ? s.df : -s.df;
  const lr = s.steps[s.steps.length - 1] > 0 ? s.dr : -s.dr;
  const tDone = t;
  add({type: 'steer', dur: s.tOut, rx, ry, psi, f0: lf, f1: 0, r0: lr, r1: 0, ph: 4});
  add({type: 'still', dur: s.tEnd, rx, ry, psi, f: 0, r: 0, ph: 4});

  const phStarts: number[] = [];
  for (const sg of segs) if (phStarts[sg.ph] === undefined) phStarts[sg.ph] = sg.t0;

  const [sx, sy] = centerOf(segs[0].rx, segs[0].ry, segs[0].psi);
  return {
    segs,
    phStarts,
    T: t,
    plan: pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '),
    tTap: segs[1].t0,
    tDone,
    start: {x: sx, y: sy, th: segs[0].psi / RAD + 90},
  };
}

export interface Pose {
  /** 车身中心（舞台 px） */
  x: number;
  y: number;
  /** SVG 呈现角（°，0 = 车头朝上） */
  th: number;
  /** 前轮 / 后轮转角（°） */
  f: number;
  r: number;
  /** 后轴点 */
  rx: number;
  ry: number;
  ph: number;
  seg: Seg;
  k: number;
}

/** 时间 → 位姿（ParkingStage 与断言共用同一份求值逻辑） */
export function poseAt(b: Built, t: number): Pose {
  let seg = b.segs[b.segs.length - 1];
  for (const sg of b.segs) if (t < sg.t0 + sg.dur) { seg = sg; break; }
  const k = Math.max(0, Math.min(1, (t - seg.t0) / seg.dur));
  const ke = easeInOut(k);

  let rx = seg.rx, ry = seg.ry, psi = seg.psi, f = 0, r = 0;
  if (seg.type === 'move') {
    [rx, ry, psi] = integrate(seg.rx, seg.ry, seg.psi, seg.s * ke, seg.f, seg.r);
    f = seg.f; r = seg.r;
  } else if (seg.type === 'steer') {
    f = seg.f0 + (seg.f1 - seg.f0) * ke;
    r = seg.r0 + (seg.r1 - seg.r0) * ke;
  } else {
    f = seg.f; r = seg.r;
  }
  const [x, y] = centerOf(rx, ry, psi);
  return {x, y, th: psi / RAD + 90, f, r, rx, ry, ph: seg.ph, seg, k};
}

// 信息卡几何（贴车身左下方，随车移动；禁止放画面边角）
export const CARD_W = 274;
export const CARD_H = 176;
/** 卡片右边缘 / 竖直中心（舞台坐标）——避开旋转后的车身包围盒，且不越过车位开口虚线 */
export function cardBox(x: number, y: number, th: number) {
  const hw = halfSpan(th).w;
  const right = Math.min(Math.max(x - hw - 26, 210), 496);
  const cy = Math.min(Math.max(y + 142, 132), 452);
  return {right, left: right - CARD_W, top: cy - CARD_H / 2, bottom: cy + CARD_H / 2};
}
/** 引导线落点：车身左侧偏后的一点（跟随车身旋转） */
export function leadPoint(x: number, y: number, th: number): [number, number] {
  const c = Math.cos(th * RAD), s = Math.sin(th * RAD);
  const bx = -CAR_W / 2 - 4, by = CAR_H * 0.2;
  return [x + bx * c - by * s, y + bx * s + by * c];
}
