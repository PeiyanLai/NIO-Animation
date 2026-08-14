// 平移泊入动画 · 常量与场景配置
// 视觉资产：ET9 俯拍照片（高位斜俯视，非正投影俯视——见 approved-asset-manifest.json）
// 教育点：前轮上限 40°、后轮同向上限 8°，车身全程不旋转，小幅斜挪碎步横移入位

export {T_COLORS, F_UI, F_DATA, clamp01, win, easeOutBack, frac} from './data';

// 车身轮廓（裁切图 650×1150 坐标系，车头朝上）
export const CAR_TOP_BODY =
  'M100,92L150,56L220,36L300,26L380,28L450,42L510,66L552,96L578,150L596,230L606,330L612,430L614,530L612,630L606,730L597,830L584,910L570,980L546,1045L498,1095L428,1120L340,1128L252,1126L172,1108L112,1078L83,1035L62,970L48,890L40,790L43,690L46,590L45,490L43,390L40,300L30,220L46,150L72,115Z';

export const CAR_SRC = {w: 650, h: 1150};

// 车身包围盒（用于定位与缩放）
export const CAR_BBOX = {x0: 30, y0: 26, x1: 614, y1: 1128};

// 语义锚点（归一化 0–1，基于裁切图；俯视照片看不到车轮，轮位为按轴距推算的示意位置）
export const TOP_ANCHORS = {
  'vehicle.center': {x: 0.495, y: 0.502},
  'wheel.fl': {x: 0.135, y: 0.255},
  'wheel.fr': {x: 0.855, y: 0.255},
  'wheel.rl': {x: 0.120, y: 0.760},
  'wheel.rr': {x: 0.868, y: 0.760},
  'roof.sensor': {x: 0.495, y: 0.175},
} as const;

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
export const SLOT = {x: 600, y: 280, w: 150, h: 250};   // 目标车位（中心 x,y）
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
