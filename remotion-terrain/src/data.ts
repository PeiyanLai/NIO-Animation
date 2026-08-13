// 全地形动画 · 常量与场景配置（自 terrain-mode.html 移植，几何/时序完全一致）

export const T_COLORS = {
  // 夜间主题 token（视频固定夜间版）
  ground: '#0A0E0E',
  panel: '#121A1A',
  line: '#243737',
  lineSoft: '#1B2A2A',
  ink: '#E4F0F0',
  ink2: '#90A9A9',
  ink3: '#5F7878',
  accent: '#00D4D4',
  accentDim: '#1D6F6F',
  accentWash: '#0E3232',
  ok: '#4FD1A0',
  okWash: '#0D2B22',
  warn: '#E8B947',
  stageBg: '#080C0C',
  nvRoof: '#101014',
};

export const TERRA = {
  asphalt: { base: '#252D33', dk: '#39444C', label: '柏油' },
  mud: { base: '#4A3722', dk: '#62492E', label: '泥地' },
  sand: { base: '#6E5B33', dk: '#8A7444', label: '沙地' },
  snow: { base: '#B9CBD9', dk: '#90A9BE', label: '雪地' },
  wet: { base: '#274F63', dk: '#3A697F', label: '湿地' },
  gravel: { base: '#413E37', dk: '#59544A', label: '碎石' },
} as const;

export type TerrKey = keyof typeof TERRA;

export const SPEED = 130; // 地面滚动 px/s
export const WHEEL_R = 52.3; // 轮胎滚动半径（显示坐标）

export const CAR_CLIP =
  '46,200 70,192 110,178 160,166 210,160 255,155 288,152 316,143 350,112 378,97 390,89 394,86 400,82 414,82 418,87 450,85 520,83 600,84 680,87 740,90 785,93 806,73 812,64 826,64 832,72 850,78 878,83 905,89 908,93 891,107 900,118 920,140 945,166 953,173 958,186 961,208 958,250 950,295 944,330 930,348 880,348 872,288 850,250 820,230 785,224 750,230 718,248 696,282 684,320 680,346 336,346 331,302 316,264 289,240 252,230 215,234 185,252 163,284 152,318 146,340 120,344 90,340 60,334 46,320 40,290 40,235';

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
