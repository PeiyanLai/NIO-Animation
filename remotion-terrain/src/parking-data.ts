// 平移泊入动画 · 常量与场景配置
// 视觉资产：ES9 正俯视照片（用户上传 PDF 第 2 页截帧；已纵向归正到 长/宽 = 5365/2029）
// 教育点：前轮上限 40°、后轮同向上限 8°，车身全程不旋转，小幅斜挪碎步横移入位

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
