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
// 车身轮廓（照片坐标 1020x460）—— **整条都是从这张白车照片实测重描的**，
// 不是从旧金车轮廓平移过来的。两张照片的机位略有差别，旧轮廓套上来处处差 5–12px：
// 机盖上沿削掉 8–12px、尾部斜面裹进 10px 背景（正侧视里会看成扰流板里嵌了一块灰三角）、
// 前脸走成近乎直线（实车是有起伏的曲线）。
//
// 测法：边界陡的段逐行扫（前脸、尾缘），边界平的段逐列扫（机盖、车顶）——
// 弄反了会在近水平处得到毫无意义的数值。判据是「偏离该行/列背景基线 ±（亮9/暗25）
// 且连续两像素」，白车对浅灰底只差 10~15 级，单侧绝对阈值不成立。
// 扫完做移动平均再抽样，否则 ±1px 抖动会在轮廓上留下锯齿。
//
// **轮胎下缘量不出来**：影棚地面是深色反光的，胎面和地面反光连成一片，没有可见边界。
// 所以底边在两个轮位按已知胎圈半径 r=75（照片 px）补圆弧。这段是推的不是测的。
//
// 全轮廓已沿内法线内缩 3px。
export const CAR_BODY =
  'M67.2,195.8L83.0,191.6L99.0,184.4L114.7,179.9L130.5,177.0L146.4,175.0L162.3,173.0L178.2,171.8L194.1,171.2L210.0,170.8L226.1,170.8L242.1,169.8L258.7,169.2L307.3,146.7L323.5,138.6L339.6,127.8L355.6,117.5L371.5,107.9L387.8,98.7L403.9,83.0L418.8,72.9L433.9,73.7L450.2,73.7L466.3,71.7L482.3,70.3L498.3,68.7L514.2,67.3L530.1,67.0L546.1,66.7L562.1,66.0L578.0,66.0L594.1,65.7L610.0,65.0L626.0,65.3L641.9,65.0L657.9,66.3L673.9,66.3L689.8,67.0L705.8,68.3L721.9,69.0L737.8,69.7L753.8,70.7L770.2,71.7L786.7,67.9L802.4,64.0L817.3,63.2L832.7,71.7L849.2,78.2L865.6,80.7L881.6,82.7L896.4,84.0L899.0,88.5L897.4,95.5L896.2,104.3L899.6,113.5L906.6,122.0L914.2,130.0L921.4,138.0L928.4,146.0L935.6,154.1L943.7,162.1L951.2,169.8L955.2,177.0L956.6,184.3L956.4,191.8L955.6,199.7L955.0,207.9L955.0,211.5L954.1,214.4L953.0,232.0L954.0,248.4L957.0,262.4L958.0,276.0L957.0,287.7L956.1,298.4L953.3,307.7L947.7,316.0L940.2,322.6L931.7,328.3L925.1,330.3L918.2,332.5L911.4,334.1L904.4,335.5L897.5,336.8L890.6,337.9L883.6,338.9L876.6,339.9L869.7,340.6L862.7,341.2L855.8,341.9L849.0,342.0L840.6,342.5L832.5,353.7L825.7,363.6L819.0,370.8L812.2,376.3L805.5,380.6L798.8,384.0L792.1,386.5L785.4,388.4L778.6,389.5L771.9,390.0L765.2,389.8L758.5,389.0L751.8,387.7L745.1,385.5L738.3,382.6L731.6,378.9L724.9,374.1L718.2,367.9L711.5,359.9L704.1,347.4L695.7,343.1L688.0,343.0L681.0,343.0L674.0,343.0L667.0,343.0L660.0,343.0L653.0,343.0L646.0,343.0L639.0,343.0L632.0,343.0L625.0,343.0L618.0,343.0L611.0,343.0L604.0,343.0L597.0,343.0L590.0,343.0L583.0,343.0L576.0,343.0L569.0,343.0L562.0,343.0L555.0,343.0L548.0,343.0L541.0,343.0L534.0,343.0L527.0,343.0L520.0,343.0L513.0,343.0L506.0,343.0L499.0,343.0L492.0,343.0L485.0,343.0L478.0,343.0L471.0,343.0L464.0,343.0L457.0,343.0L450.0,343.0L443.0,343.0L436.0,343.0L429.0,343.0L422.0,343.0L415.0,343.0L408.0,343.0L401.0,343.0L394.0,343.0L387.0,343.0L380.0,343.0L373.0,343.0L366.0,343.0L359.0,343.0L352.0,343.0L345.0,343.1L338.0,343.2L331.0,343.3L324.0,343.4L317.0,343.5L310.0,343.6L303.0,343.7L296.0,343.8L289.0,343.9L281.9,344.0L274.9,344.2L266.9,344.5L258.7,351.6L251.6,362.5L244.9,369.8L238.2,375.6L231.5,380.1L224.8,383.6L218.0,386.3L211.3,388.1L204.6,389.3L197.9,389.9L191.1,389.9L184.4,389.2L177.7,387.9L171.0,385.9L164.3,383.1L157.6,379.5L150.8,374.8L144.1,369.0L137.4,361.2L130.0,349.5L121.8,345.2L114.1,344.7L107.1,344.4L100.3,344.0L93.3,343.2L86.4,342.4L79.5,341.4L72.6,340.2L65.8,338.7L59.4,336.4L54.0,333.5L58.1,328.8L57.6,315.8L56.8,303.8L55.7,291.8L55.1,280.0L55.8,268.2L56.9,256.2L57.7,244.0L56.7,232.0L57.6,220.5L60.3,208.8L63.5,197.8Z';

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
