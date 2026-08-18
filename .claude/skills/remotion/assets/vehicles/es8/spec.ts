// ES8 实车规格常量与「一把尺子」换算助手
//
// 用途：任何舞台尺寸（车位宽、车距、障碍间隙、轮辋半径）都必须用同一把 mm/px 尺子换算，
//       不允许「手感缩放」。断言里也用它把像素换回毫米，问题才能在数值层暴露。
//
// 数据来源：用户提供的官方车型参数表（2026-08-18）。长/宽/高/轴距/前后轮距/接近离去角
// 均为公布值。**轮辋与轮胎规格未给**，做侧视或矢量轮之前必须补。

/** 官方公布数据（mm / 度） */
export const ES8_SPEC = {
  lengthMM: 5280,
  widthMM: 2010,
  heightMM: 1800,
  wheelbaseMM: 3130,
  frontTrackMM: 1720,
  rearTrackMM: 1733,
  approachAngleDeg: 17,
  departureAngleDeg: 18,
  /** ⚠️ 未给：做侧视或矢量轮之前必须补 */
  rimInch: null as number | null,
  tireSpec: null as string | null,
  confirmed: true,
} as const;

/**
 * 判定「一张俯视图是不是正投影」时拿这两个比值当基准。
 * 两条都要过；只有第一条偏是非均匀缩放（可归正），两条都偏就是透视（判废）。
 * 详见 scripts/assert-orthographic.py。
 */
export const ES8_RATIOS = {
  lengthOverWidth: ES8_SPEC.lengthMM / ES8_SPEC.widthMM,        // 2.627
  wheelbaseOverLength: ES8_SPEC.wheelbaseMM / ES8_SPEC.lengthMM, // 0.593
} as const;

/** 舞台车长（px）→ mm/px。两种车同屏时必须共用同一把尺子，不能各缩各的 */
export const mmPerPx = (carLenPx: number) => ES8_SPEC.lengthMM / carLenPx;
export const pxPerMM = (carLenPx: number) => carLenPx / ES8_SPEC.lengthMM;
