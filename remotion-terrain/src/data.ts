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

export const SPEED = 130; // 地面滚动 px/s
export const WHEEL_R = 48.95; // 前轮滚动半径（显示坐标，= 照片实测胎圈 86 × 0.55）

export const CAR_CLIP =
  'M40,235L46,200L70,192L110,178L160,166L210,160L255,155L288,152L312,137L336,123L360,109L380,96L394,86L404,78L416,73L430,71L450,70L470,69L520,67L570,66L620,66L670,67L720,69L770,71L786,72L790,66L800,63L815,62L826,64L832,73L840,76L856,79L875,81L895,83L905,85L912,120L922,133L934,147L945,166L954,180L960,196L962,215L959,250L953,285L946,308L937,320L925,327L905,334L880,341L860,344L700,346L350,346L146,344L120,344L90,340L60,334L46,320L40,290ZM120,304a94,94 0 1,0 188,0a94,94 0 1,0 -188,0ZM685,304a90,90 0 1,0 180,0a90,90 0 1,0 -180,0Z';

// 车身轮廓（不含轮拱）——配合 <mask> 使用；轮拱用 ARCHES 挖黑，
// 不能用 clipPath+evenodd：圆形超出车身底边的部分会被判为「在裁剪区内」，导致照片原轮子漏出
export const CAR_BODY =
  'M40,235L46,200L70,192L110,178L160,166L210,160L255,155L288,152L312,137L336,123L360,109L380,96L394,86L404,78L416,73L430,71L450,70L470,69L520,67L570,66L620,66L670,67L720,69L770,71L786,72L790,66L800,63L815,62L826,64L832,73L840,76L856,79L875,81L895,83L905,85L912,120L922,133L934,147L945,166L954,180L960,196L962,215L959,250L953,285L946,308L937,320L925,327L905,334L880,341L860,344L700,346L350,346L146,344L120,344L90,340L60,334L46,320L40,290Z';

// 轮拱开口（照片坐标）：半径略大于胎圈，留出轮眉与轮胎之间的机械缝隙
export const ARCHES = [
  { cx: 214, cy: 304, r: 94 },  // 前轮（舞台上镜像后在右）
  { cx: 775, cy: 304, r: 90 },  // 后轮
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
