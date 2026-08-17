// 全地形动画 · 常量与场景配置（自 terrain-mode.html 移植，几何/时序完全一致）

export const T_COLORS = {
  // NIOFlow 浅色 token（见 .claude/skills/feature-animation/references/nio-colors.md）
  // 大面积背景仅限 #FFFFFF / #F0FAFA / #E8FAFA；主色 #00bebe 只做强调；背景纯色无网格
  ground: '#F0FAFA',
  panel: '#FFFFFF',
  line: '#D8EEEE',
  lineSoft: '#E8FAFA',
  ink: '#1A1F1F',
  ink2: '#2E3D3D',
  ink3: '#5C7070',
  ink4: '#8AABAB',
  accent: '#00bebe',
  accentDim: '#B8DEDE',
  accentWash: '#D0F5F5',
  ok: '#00AAAA',
  okWash: '#D0F5F5',
  warn: '#D49922',
  stageBg: '#E8FAFA',
  nvRoof: '#1A1F1F',
};

export const TERRA = {
  asphalt: { base: '#AEB9C2', dk: '#96A3AD', label: '柏油' },
  mud: { base: '#A5794F', dk: '#876140', label: '泥地' },
  sand: { base: '#E3CE9C', dk: '#C4A96E', label: '沙地' },
  snow: { base: '#EEF4F9', dk: '#BFD3E2', label: '雪地' },
  wet: { base: '#9FC9DD', dk: '#7BADC6', label: '湿地' },
  gravel: { base: '#C6C0B4', dk: '#A39C8C', label: '碎石' },
} as const;;

export type TerrKey = keyof typeof TERRA;

// ES9 实车尺寸（mm）——用于核对动画比例
// 舞台标尺：车身轮廓 photo x 40→962（922px）× 0.55 = 507 舞台px 对应车长 5365mm ⇒ 10.58 mm/舞台px
// 已核对：长/高 = 5365/1870 = 2.87，照片实测 2.89（差 <1%）；轴距/车长 = 0.606，照片 0.63
// （照片为轻微透视，前轮比后轮略大，故非严格正投影等比）
export const ES9_SPEC = {
  lengthMM: 5365, widthMM: 2029, heightMM: 1870, wheelbaseMM: 3250,
  rimInch: 23,            // 轮辋 23" = 584mm
  tireODMM: 804,          // HL275/40R23（官方图轮胎标识）外径 ≈ 584 + 2×110
  rimToTireRatio: 0.727,  // 584/804 —— 矢量轮必须遵守；照片实测 0.747，吻合
} as const;

export const SPEED = 130; // 地面滚动 px/s
export const WHEEL_R = 40.7; // 前轮滚动半径（舞台px）= 实测胎圈 74px × 0.55

export const CAR_CLIP =
  'M40,235L46,200L70,192L110,178L160,166L210,160L255,155L288,152L312,137L336,123L360,109L380,96L394,86L404,78L416,73L430,71L450,70L470,69L520,67L570,66L620,66L670,67L720,69L770,71L786,72L790,66L800,63L815,62L826,64L832,73L840,76L856,79L875,81L895,83L905,85L909,120L919,133L931,147L943,166L951,180L957,196L957,215L959,250L953,285L946,308L937,320L925,327L905,334L880,341L860,344L700,346L350,346L146,344L120,344L90,340L60,334L46,320L40,290ZM120,304a94,94 0 1,0 188,0a94,94 0 1,0 -188,0ZM685,304a90,90 0 1,0 180,0a90,90 0 1,0 -180,0Z';

// 车身轮廓（不含轮拱）——配合 <mask> 使用；轮拱用 ARCHES 挖黑，
// 不能用 clipPath+evenodd：圆形超出车身底边的部分会被判为「在裁剪区内」，导致照片原轮子漏出
// 车身轮廓（照片坐标 1020x460）。**已沿内法线整体内缩 3px**——
// 白车身与影棚浅灰底的明度差只有 25 左右，边缘抗锯齿过渡带会把背景灰带进来，
// 合成到强饱和底色上一眼可见（见 skill「白/银主体的抠图体检」）。
export const CAR_BODY =
  'M55.7,206.4L63.5,200.6L70.8,197.9L110.5,191.0L160.4,184.0L210.3,179.0L255.3,174.0L289.3,169.7L298.2,161.1L306.1,152.2L315.9,144.3L327.8,134.4L341.7,124.5L357.6,113.5L373.6,103.5L387.7,94.5L399.8,85.4L409.4,78.6L418.8,74.9L432.3,73.0L450.2,72.0L470.1,71.0L520.1,70.0L570.0,69.0L620.0,69.0L669.9,70.0L719.9,72.0L769.8,74.0L787.3,74.7L791.8,68.4L800.5,66.0L814.8,65.0L824.4,66.5L830.1,75.4L839.2,78.9L855.6,82.0L874.7,84.0L894.6,86.0L902.8,87.0L906.2,121.1L916.7,134.9L928.6,148.8L940.4,167.5L948.3,181.3L954.0,196.5L954.0,214.9L953.0,232.0L954.0,248.4L957.0,262.4L958.0,276.0L957.0,287.7L956.1,298.4L953.3,307.7L947.7,316.0L940.2,322.6L931.7,328.3L916.3,333.1L896.5,337.0L875.6,340.0L854.8,342.0L700.0,343.0L350.0,343.0L219.9,345.0L190.0,346.0L160.0,346.0L140.1,346.0L120.1,345.0L100.2,344.0L82.4,342.0L66.8,339.1L56.6,335.5L50.6,329.5L48.0,317.7L48.0,302.1L49.0,285.2L51.0,265.3L53.0,245.3L55.0,225.2Z';

// 轮拱开口（照片坐标）：半径略大于胎圈，留出轮眉与轮胎之间的机械缝隙
export const ARCHES = [
  { cx: 196, cy: 318, r: 85 },  // 前轮（放大网格实测：胎圈 r=75，开口留 10px 缝隙）
  { cx: 770, cy: 318, r: 86 },  // 后轮（胎圈 r=77）
] as const;


export type Band = { terr: TerrKey; x: number; w: number };

export interface SceneCfg {
  T: number;
  ph: number[];
  tDone: number;
  startTerr: TerrKey;
  startMode: TerrKey | null | 'auto';
  bounds: { t: number; terr: TerrKey }[];
  pressAt?: number;
  activateAt?: number;
  modeTerr?: TerrKey;
  bub?: [string, string];
  pill: string;
  caps: string[];
  bands: Band[];
  chip: string;
}

export const SCENES: Record<'a' | 'b' | 'c', SceneCfg> = {
  a: {
    T: 13.6,
    ph: [1.6, 4.6, 7.6, 11.0, 13.6],
    tDone: 11.0,
    startTerr: 'asphalt',
    startMode: null,
    bounds: [{ t: 3.2, terr: 'snow' }],
    pressAt: 7.6,
    activateAt: 8.4,
    modeTerr: 'snow',
    bub: ['已驶入雪地', '是否为您打开全地形模式？'],
    pill: '方向盘按键 · 一键开启',
    caps: [
      '柏油路行驶 · 标准模式',
      '驶入雪地——系统自动识别路面',
      '「已驶入雪地，是否为您打开全地形模式？」',
      '方向盘按键一键确认——雪地模式已开启',
      '自动识别 · 一键开启 · 无需进设置',
    ],
    bands: [
      { terr: 'asphalt', x: -80, w: 1045 },
      { terr: 'snow', x: 965, w: 2290 },
    ],
    chip: '场景一 · 自动识别 · 一键开启',
  },
  b: {
    T: 13.6,
    ph: [1.6, 4.6, 7.6, 11.0, 13.6],
    tDone: 11.0,
    startTerr: 'snow',
    startMode: 'snow',
    bounds: [{ t: 3.2, terr: 'sand' }],
    pressAt: 7.6,
    activateAt: 8.4,
    modeTerr: 'sand',
    bub: ['已驶入沙地', '是否为您切换到沙地模式？'],
    pill: '方向盘按键 · 一键切换',
    caps: [
      '全地形 · 雪地模式行驶中',
      '路面切换：雪地 → 沙地，系统主动识别',
      '「已驶入沙地，是否为您切换到沙地模式？」',
      '方向盘按键一键确认——沙地模式已开启',
      '场景切换自动提醒 · 模式始终匹配路面',
    ],
    bands: [
      { terr: 'snow', x: -80, w: 1045 },
      { terr: 'sand', x: 965, w: 2290 },
    ],
    chip: '场景二 · 行驶中场景切换',
  },
  c: {
    T: 14.0,
    ph: [2.0, 6.0, 10.0, 11.6, 14.0],
    tDone: 11.6,
    startTerr: 'asphalt',
    startMode: 'auto',
    bounds: [
      { t: 2.0, terr: 'mud' },
      { t: 4.0, terr: 'sand' },
      { t: 6.0, terr: 'snow' },
      { t: 8.0, terr: 'wet' },
      { t: 10.0, terr: 'gravel' },
    ],
    pill: '全地形模式 · 逐段识别',
    caps: [
      '柏油路 · 标准模式',
      '泥地模式 → 沙地模式',
      '雪地模式 → 湿地模式',
      '碎石模式',
      '全地形模式：泥地 · 沙地 · 雪地 · 湿地 · 碎石',
    ],
    bands: [
      { terr: 'asphalt', x: -80, w: 889 },
      { terr: 'mud', x: 809, w: 260 },
      { terr: 'sand', x: 1069, w: 260 },
      { terr: 'snow', x: 1329, w: 260 },
      { terr: 'wet', x: 1589, w: 260 },
      { terr: 'gravel', x: 1849, w: 1300 },
    ],
    chip: '场景三 · 五种地形一览',
  },
};

export const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
export const win = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
export const easeOutBack = (k: number) => {
  k = clamp01(k);
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);
};
export const frac = (x: number) => x - Math.floor(x);

export const phaseOf = (s: SceneCfg, t: number) => {
  for (let i = 0; i < s.ph.length; i++) if (t < s.ph[i]) return i;
  return 4;
};
export const terrAt = (s: SceneCfg, t: number): TerrKey => {
  let terr = s.startTerr;
  for (const b of s.bounds) if (t >= b.t) terr = b.terr;
  return terr;
};
export const modeAt = (s: SceneCfg, t: number): TerrKey | null => {
  if (s.startMode === 'auto') {
    const terr = terrAt(s, t);
    return terr === 'asphalt' ? null : terr;
  }
  return t >= (s.activateAt ?? Infinity) ? s.modeTerr! : (s.startMode as TerrKey | null);
};

export const F_UI =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif";
export const F_DATA =
  "ui-monospace, 'SF Mono', SFMono-Regular, 'Roboto Mono', 'DejaVu Sans Mono', Menlo, Consolas, monospace";
