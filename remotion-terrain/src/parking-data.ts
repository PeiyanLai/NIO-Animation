// 平移泊入动画 · 常量与场景配置
// 视觉资产：ES9 正俯视照片（用户上传 PDF 第 2 页截帧；已纵向归正到 长/宽 = 5365/2029）
// 教育点：前轮上限 40°、后轮同向上限 8°，车身全程不旋转，小幅斜挪碎步横移入位

export {T_COLORS, F_UI, F_DATA, clamp01, win, easeOutBack, frac} from './data';

// 车身轮廓（贴图 342×698 坐标系，车头朝上；含后视镜，已内缩 2px 防背景渗出）
export const CAR_TOP_BODY =
  'M151.9,11.0L171.9,12.4L191.9,13.4L212.0,13.8L231.8,14.3L246.6,16.2L261.4,19.9L273.0,24.9L281.5,31.6L287.2,40.5L290.0,51.5L292.0,65.4L292.0,92.0L292.0,125.0L292.0,148.5L291.0,172.0L291.0,196.0L290.0,219.7L292.4,228.2L302.9,234.4L311.5,240.6L315.0,247.1L313.5,253.2L302.5,257.3L290.6,259.7L289.0,266.8L289.0,295.0L289.0,324.0L288.0,352.0L288.0,380.0L287.0,413.0L287.0,446.0L286.0,480.0L286.0,513.0L285.0,545.9L284.0,573.9L283.0,596.1L285.0,614.8L280.2,631.2L272.3,644.9L264.5,654.7L256.7,663.5L247.2,670.2L231.5,674.1L214.6,679.0L199.9,680.0L179.9,681.0L160.0,682.0L140.1,681.0L120.2,680.0L105.4,678.0L92.5,675.1L80.7,672.1L71.0,667.2L61.4,661.6L53.8,649.1L47.9,636.3L42.9,619.5L39.0,604.6L36.0,585.8L36.0,569.0L36.0,541.0L36.0,508.0L36.0,475.0L36.0,442.0L36.0,409.0L36.0,375.0L36.0,342.0L36.0,309.0L37.0,281.0L37.0,266.8L35.4,259.7L23.5,257.3L12.5,253.2L11.0,247.1L14.5,240.6L23.1,234.4L33.4,228.4L37.9,220.0L38.0,196.0L38.0,172.0L38.0,148.5L39.0,125.0L39.0,101.1L40.0,82.1L41.0,70.2L42.0,59.0L43.9,48.8L47.7,39.8L53.4,32.6L61.0,27.2L70.8,22.6L82.6,18.0L97.4,14.3L114.2,11.9L132.0,11.2Z';

export const CAR_SRC = {w: 342, h: 698};

// 车身包围盒：不含后视镜的车体外廓 —— 256 × 671 ↔ 2029mm × 5365mm（比例 2.62 : 实车 2.64）
export const CAR_BBOX = {x0: 36, y0: 11, x1: 292, y1: 682};

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

// 转向物理（用户给定的真实约束）
export const F_MAX = 40;          // 前轮最大转角
export const R_MAX = 8;           // 后轮同向最大转角
export const TH = 24;             // 斜挪方向角（前40°/后8°同向时，车身实际爬行方向约 24°）

export interface PkScene {
  T: number;
  ph: number[];
  tDone: number;
  startX: number;       // 起始横坐标（舞台）
  cycles: number;       // 碎步循环数
  idle: number;
  caps: string[];
  chip: string;
  sub: string;
}

// 舞台 1000×560；车位列在右侧，车头朝上，横向平移入位
// 车位 112 × 250px ↔ 2546mm × 5683mm（车体 2029mm，两侧各留约 250mm，符合标准车位）
export const SLOT = {x: 600, y: 280, w: 112, h: 250};
export const NEIGHBORS = [
  {x: 600, y: 10},    // 前车（上）
  {x: 600, y: 550},   // 后车（下）
];

export const PK_SCENES: Record<'a' | 'b', PkScene> = {
  a: {
    T: 14.4,
    ph: [1.2, 3.0, 5.2, 12.4, 14.4],
    tDone: 12.4,
    startX: 415,
    cycles: 10,
    idle: 1.2,
    chip: '场景一 · 车位旁一键泊入',
    sub: '前后已停满，全程小幅碎步横移入位',
    caps: [
      '车身与车位平行，停在车位旁（前后已停满）',
      '点按开启，全程无需操作',
      '前轮打角 40° · 后轮同向 8° —— 车身保持摆正',
      '小幅斜向前挪 · 反向后挪，匀步横移入位',
      '泊入完成，车轮回正',
    ],
  },
  b: {
    T: 9.6,
    ph: [1.4, 3.0, 4.6, 7.6, 9.6],
    tDone: 7.6,
    startX: 528,
    cycles: 5,
    idle: 1.4,
    chip: '场景二 · 泊车中途解围',
    sub: '自己泊到一半车身已正，碎步补完最后一段',
    caps: [
      '自己泊到一半：车身已正，仍有一截在位外',
      '点按开启，全程无需操作',
      '前轮打角 40° · 后轮同向 8° —— 车身保持摆正',
      '小幅斜向前挪 · 反向后挪，匀步横移入位',
      '泊入完成，车轮回正',
    ],
  },
};

export type Seg =
  | {type: 'idle' | 'tap' | 'done'; t0: number; dur: number; x: number; y: number; a: number; ph: number}
  | {type: 'steer'; t0: number; dur: number; x: number; y: number; from: number; to: number; ph: number}
  | {type: 'move'; t0: number; dur: number; a: number; fx: number; fy: number; tx: number; ty: number; ph: number};

const RAD = Math.PI / 180;

/** 生成碎步时间轴：全程等幅「斜向前挪 → 反向后挪」，纵向位移相互抵消，净效果是每步横移一小段 */
export function buildPark(s: PkScene): {segs: Seg[]; phStarts: number[]; T: number; plan: string; tTap: number; tDone: number} {
  const segs: Seg[] = [];
  let t = 0;
  let x = s.startX;
  let y = SLOT.y;
  const latPer = (SLOT.x - s.startX) / s.cycles;
  const d = latPer / 2 / Math.sin(TH * RAD);
  const pts: [number, number][] = [[x, y]];
  const add = (o: Omit<Seg, 't0'> & {dur: number}) => {
    segs.push({...(o as any), t0: t});
    t += o.dur;
  };

  add({type: 'idle', dur: s.idle, x, y, a: 0, ph: 0} as any);
  add({type: 'tap', dur: 1.0, x, y, a: 0, ph: 1} as any);

  const n = s.cycles * 2;
  for (let i = 0; i < n; i++) {
    const up = i % 2 === 0;
    const ang = up ? F_MAX : -F_MAX;
    const prev = i ? (up ? -F_MAX : F_MAX) : 0;
    add({type: 'steer', dur: i ? 0.22 : 0.4, from: prev, to: ang, x, y, ph: i ? 3 : 2} as any);
    let tx = x + d * Math.sin(TH * RAD);
    let ty = y + (up ? -1 : 1) * d * Math.cos(TH * RAD);
    if (i === n - 1) { tx = SLOT.x; ty = SLOT.y; }
    add({type: 'move', dur: 0.30, a: ang, fx: x, fy: y, tx, ty, ph: i === 0 ? 2 : 3} as any);
    x = tx; y = ty;
    pts.push([x, y]);
  }
  add({type: 'steer', dur: 0.6, from: -F_MAX, to: 0, x, y, ph: 4} as any);
  add({type: 'done', dur: 1.4, x, y, a: 0, ph: 4} as any);

  const phStarts: number[] = [];
  for (const sg of segs) if (phStarts[sg.ph] === undefined) phStarts[sg.ph] = sg.t0;

  return {
    segs,
    phStarts,
    T: t,
    plan: pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '),
    tTap: segs[1].t0,
    tDone: segs[segs.length - 2].t0,
  };
}
