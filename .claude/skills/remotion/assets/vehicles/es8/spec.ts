// ES8 实车规格常量与「一把尺子」换算助手
//
// 用途：任何舞台尺寸（车位宽、车距、障碍间隙、轮辋半径）都必须用同一把 mm/px 尺子换算，
//       不允许「手感缩放」。断言里也用它把像素换回毫米，问题才能在数值层暴露。
//
// ⚠️ **三围是待确认值**：这里填的是 2025 款 ES8 的常见公布数据，**尚未拿官方数据核对**。
//    动手做 ES8 动画前先确认，并把结论写进 photos/es8/approved-asset-manifest.json。
//    这几个数字会一路传导到车位尺寸、车距、坡度换算，错了整条动画的数都是错的。

/** 官方数据（mm）。⚠️ 待官方核对 */
export const ES8_SPEC = {
  lengthMM: 5280,
  widthMM: 1989,
  heightMM: 1801,
  wheelbaseMM: 3130,
  /** ⚠️ 轮辋/轮胎规格未确认，做侧视或矢量轮之前必须补 */
  rimInch: null as number | null,
  tireSpec: null as string | null,
  confirmed: false,
} as const;

/** 长宽比 2.655——判定一张「俯视图」是不是正投影时拿它当基准 */
export const ES8_RATIOS = {
  lengthOverWidth: ES8_SPEC.lengthMM / ES8_SPEC.widthMM,
  wheelbaseOverLength: ES8_SPEC.wheelbaseMM / ES8_SPEC.lengthMM,
} as const;

/** 舞台车长（px）→ mm/px。两种车同屏时必须共用同一把尺子，不能各缩各的 */
export const mmPerPx = (carLenPx: number) => ES8_SPEC.lengthMM / carLenPx;
export const pxPerMM = (carLenPx: number) => carLenPx / ES8_SPEC.lengthMM;
