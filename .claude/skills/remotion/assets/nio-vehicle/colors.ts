// NIO（NIOFlow）浅色系配色 token —— 资产库统一色源
// 完整规范见 .claude/skills/feature-animation/references/nio-colors.md
//
// 硬规则（照抄自 SKILL.md，改动前先回去看）：
//   · 大面积背景仅限 #FFFFFF / #F0FAFA / #E8FAFA，背景必须纯色、无网格无纹理
//   · 主色 #00bebe / #00D4D4 只做强调：单块面积 ≤15%，每屏 ≤3 处
//   · 中性色一律青调灰，禁止纯灰 #888/#666；正文不浅于 #5C7070
//   · 浅底上的主体必须有接地投影（ink3 + opacity .14~.16 的扁椭圆）
//
// 本文件是资产库里唯一允许出现裸色值的地方。side.ts / top.ts / Wheel.tsx /
// terrain-props.tsx / FollowCard.tsx 全部从这里取色，换品牌时只改这一份。

export const NIO = {
  /** 舞台底 / 大面积背景 */
  stageBg: '#E8FAFA',
  ground: '#F0FAFA',
  panel: '#FFFFFF',

  /** 分割线 */
  line: '#D8EEEE',
  lineSoft: '#E8FAFA',

  /** 中性色（青调灰）：标题 → 说明 */
  ink: '#1A1F1F',
  ink2: '#2E3D3D',
  ink3: '#5C7070',
  ink4: '#8AABAB',

  /** 主色（强调） */
  accent: '#00bebe',
  accentHi: '#00D4D4',
  accentDim: '#B8DEDE',
  accentWash: '#D0F5F5',

  /** 语义色 */
  ok: '#00AAAA',
  okWash: '#D0F5F5',
  warn: '#D49922',
  negative: '#D14545',

  /** 分类色（多类别区分时才用） */
  catCyan: '#00D4D4',
  catPurple: '#5D4DD4',
  catAmber: '#D49922',

  /** 资产内部用的深色（车胎/轮腔/灯罩——属于「实物本色」，不是品牌色） */
  tireBlack: '#141619',
  tireEdge: '#2A2E33',
  rimLip: '#1B2222',
  caliper: '#54696B',
  cavity: '#151A1A',
  rimHighlight: '#F4FCFC',
  rimSilver: '#A9C4C4',
  lampHousing: '#0E1414',
  lampWarm: '#FFF6E2',
  white: '#FFFFFF',
} as const;

/** 地形/环境色（base = 地面底色，dk = 该地形的暗色细节） */
export const TERRA = {
  asphalt: {base: '#AEB9C2', dk: '#96A3AD', label: '柏油'},
  mud: {base: '#A5794F', dk: '#876140', label: '泥地'},
  sand: {base: '#E3CE9C', dk: '#C4A96E', label: '沙地'},
  snow: {base: '#EEF4F9', dk: '#BFD3E2', label: '雪地'},
  wet: {base: '#9FC9DD', dk: '#7BADC6', label: '湿地'},
  gravel: {base: '#C6C0B4', dk: '#A39C8C', label: '碎石'},
} as const;

export type TerrKey = keyof typeof TERRA;

/** 雪花的冷色描边（雪地专用，属于环境色不属于品牌色） */
export const SNOW_STROKE = '#9BBDD2';
export const SNOWFLAKE_STROKE = '#8FB6CE';

export const F_UI =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif";
export const F_DATA =
  "ui-monospace, 'SF Mono', SFMono-Regular, 'Roboto Mono', 'DejaVu Sans Mono', Menlo, Consolas, monospace";
