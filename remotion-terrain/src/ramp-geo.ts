// 宠物上下车斜坡架 · 几何常量（实测标定，勿凭手感改）
//
// 视角：车外正侧视，车头朝右、车尾朝左（照片已镜像），舞台 1000×560。
// 贴图：ES9 官方侧视照片（photo.ts，1020×460），用 <mask> + CAR_BODY 抠形。
//   本动画车辆静止，不挖轮拱、不画矢量轮 —— 直接用照片自己的轮子。
//
// 照片 → 舞台映射：translate(TX TY) scale(K) translate(1020 0) scale(-1 1)
//   stage_x = TX + K * (1020 - photo_x)
//   stage_y = TY + K * photo_y

export {T_COLORS, F_UI, F_DATA, clamp01, win, easeOutBack, frac} from './data';

export const K = 0.58;
export const TX = 438;
export const TY = 189.7;

export const px2sx = (px: number) => TX + K * (1020 - px);
export const py2sy = (py: number) => TY + K * py;

/** 地面线（舞台 y）。照片地面 y=397 —— 与全地形动画的 GY 对齐 */
export const GY = 420;

// ── 标尺 ────────────────────────────────────────────────────────────────
// 车长 5365mm ↔ photo x 40→962（922px）× K = 534.8 舞台px ⇒ 10.03 mm/px（水平）
// 车高 1870mm ↔ photo y 66→397（331px）× K = 192.0 舞台px ⇒  9.74 mm/px（垂直）
// 照片为轻微透视，两轴差约 3%；统一取 9.9 mm/px，误差在演示可接受范围内并已标注
export const MM_PER_PX = 9.9;
export const mm = (v: number) => v / MM_PER_PX;   // 毫米 → 舞台px

// ── 车尾关键点（照片坐标 → 舞台坐标）────────────────────────────────────
/** 装载口下沿（后保险杠上台阶），斜坡架搭在这里 */
export const LIP = {x: px2sx(958), y: py2sy(260)};        // ≈ (474.0, 340.5)
/** 尾门铰链（车顶后缘） */
export const HINGE = {x: px2sx(856), y: py2sy(82)};       // ≈ (533.1, 237.3)
/** 装载口离地高度：420 − 340.5 = 79.5px ↔ 787mm（概念推算，实车数据待确认） */
export const LIP_H_MM = Math.round((GY - py2sy(260)) * MM_PER_PX);

// 尾门 / 装载口轮廓（照片坐标，顺时针；开启时整块绕 HINGE 抬起，关闭时它就是车身的一部分）
export const TAILGATE_PHOTO: [number, number][] = [
  [856, 82], [875, 82], [895, 83], [905, 85],
  [909, 120], [919, 133], [931, 147], [943, 166], [951, 180],
  [957, 196], [957, 215], [956, 232], [957, 248], [958, 258],
  [940, 262], [900, 264], [866, 262], [852, 258],
  [849, 215], [848, 175], [849, 140], [852, 108],
];

/** 同一轮廓换算到舞台坐标（镜像已在此处理，可直接当 path 用） */
export const TAILGATE_STAGE: [number, number][] =
  TAILGATE_PHOTO.map(([x, y]) => [px2sx(x), py2sy(y)]);

export const pathOf = (pts: [number, number][]) =>
  'M' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L') + 'Z';

/** 尾门开启角（度，绕 HINGE 逆时针抬起）。电动尾门全开约 72° */
export const GATE_OPEN_DEG = -72;

// ── 斜坡架（概念产品，外观/长度/折叠方式均待产品定义）────────────────────
/** 坡长 2000mm ↔ 202px；坡度 asin(79.5/202) = 23.2° */
export const RAMP_LEN_MM = 2000;
export const RAMP_LEN = mm(RAMP_LEN_MM);
export const RAMP_DEG = (Math.asin((GY - LIP.y) / RAMP_LEN) * 180) / Math.PI;
/** 坡脚着地点 */
export const RAMP_FOOT = {
  x: LIP.x - RAMP_LEN * Math.cos((RAMP_DEG * Math.PI) / 180),
  y: GY,
};
/** 坡面宽度 400mm ↔ 40px（俯视宽度，侧视里表现为板厚 + 侧沿） */
export const RAMP_THICK = mm(90);

/** 坡面上参数 u∈[0,1]（0=坡脚，1=装载口）对应的舞台坐标 */
export const rampPt = (u: number) => ({
  x: RAMP_FOOT.x + (LIP.x - RAMP_FOOT.x) * u,
  y: RAMP_FOOT.y + (LIP.y - RAMP_FOOT.y) * u,
});

// ── 犬只尺寸（中大型犬，如金毛/拉布拉多；概念值，非某一犬种规格）────────
export const DOG = {
  witherMM: 570,          // 肩高
  bodyMM: 950,            // 胸前到臀后
  get witherPx() { return mm(this.witherMM); },   // ≈ 57.6
  get bodyPx() { return mm(this.bodyMM); },       // ≈ 96.0
};

/** 不用架子时，犬要跳上装载口需要抬升的高度（用于第 1 章讲痛点） */
export const JUMP_MM = LIP_H_MM;
