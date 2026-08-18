// ES9 实车规格常量与「一把尺子」换算助手
//
// 出处：全地形动画 remotion-terrain/src/data.ts 的 ES9_SPEC（官方三围 + 轮胎标识）。
// 用途：任何舞台尺寸（车位宽、车距、障碍间隙、轮辋半径）都必须用同一把 mm/px 尺子换算，
//       不允许「手感缩放」。断言里也用它把像素换回毫米，问题才能在数值层暴露。
//
// ⚠️ 换车型时：只改 ES9_SPEC 里的数字 + 重新核对 CROSS_RATIOS，其它函数都不用动。

/** 官方数据（mm）。lengthMM / widthMM / heightMM / wheelbaseMM 为实车公布值 */
export const ES9_SPEC = {
  lengthMM: 5365,
  widthMM: 2029,
  heightMM: 1870,
  wheelbaseMM: 3250,
  rimInch: 23, // 轮辋 23" = 584mm
  rimMM: 584,
  tireODMM: 804, // HL275/40R23（官方图轮胎标识）外径 ≈ 584 + 2 × 110
  tireSpec: '275/40R23',
  /** 轮辋直径 / 轮胎外径 = 584/804。矢量轮必须遵守；侧视照片实测 0.747，吻合 */
  rimToTireRatio: 0.727,
} as const;

/**
 * 推算值（⚠️ 非官方公布数据，由「车长 − 轴距」按常规比例拆分推得，仅用于摆放车轮/锚点）。
 * 前悬 + 轴距 + 后悬 = 1000 + 3250 + 1115 = 5365 ✓ 与车长自洽。
 * 轮距 1730 由车宽 2029 减去两侧轮胎外露与翼子板厚度估得。
 * 如果拿到官方数据，替换这里并同步 side.ts / top.ts 的锚点。
 */
export const ES9_DERIVED = {
  frontOverhangMM: 1000,
  rearOverhangMM: 1115,
  trackMM: 1730,
  isEstimate: true,
} as const;

/**
 * 交叉验证比值（不依赖标尺，最能暴露贴图被拉伸的问题）。
 * 拿到新照片先量这两个比值，和这里对不上就说明图被非等比拉伸过，必须先归正再用。
 *   lengthOverHeight —— 侧视图用（实测 2.89，差 <1%）
 *   lengthOverWidth  —— 俯视图用（俯视贴图实测 2.641）
 */
export const CROSS_RATIOS = {
  lengthOverHeight: ES9_SPEC.lengthMM / ES9_SPEC.heightMM, // 2.869
  lengthOverWidth: ES9_SPEC.lengthMM / ES9_SPEC.widthMM, // 2.644
  wheelbaseOverLength: ES9_SPEC.wheelbaseMM / ES9_SPEC.lengthMM, // 0.606
} as const;

// ---------------------------------------------------------------------------
// 标尺换算：舞台上车长占多少 px，就决定了整个场景的 mm/px
// ---------------------------------------------------------------------------

/** 舞台标尺：1 舞台 px = 多少 mm。carLenPx = 舞台上车身外廓的长度（不含后视镜） */
export const mmPerPx = (carLenPx: number) => ES9_SPEC.lengthMM / carLenPx;

/** 反向标尺：1 mm = 多少舞台 px */
export const pxPerMM = (carLenPx: number) => carLenPx / ES9_SPEC.lengthMM;

/** 舞台 px → mm */
export const toMM = (px: number, carLenPx: number) => px * mmPerPx(carLenPx);

/** mm → 舞台 px（车位宽、车距、障碍间隙都用它算，别拍脑袋） */
export const toPx = (mm: number, carLenPx: number) => mm * pxPerMM(carLenPx);

/**
 * 按当前标尺给出整车关键尺寸（舞台 px）。
 * 例：carLenPx=236（泊车动画）⇒ width 89.3 / wheelbase 143.0 / tireOD 35.4
 */
export function vehicleMetrics(carLenPx: number) {
  const k = pxPerMM(carLenPx);
  return {
    mmPerPx: mmPerPx(carLenPx),
    lengthPx: carLenPx,
    widthPx: ES9_SPEC.widthMM * k,
    heightPx: ES9_SPEC.heightMM * k,
    wheelbasePx: ES9_SPEC.wheelbaseMM * k,
    trackPx: ES9_DERIVED.trackMM * k,
    frontOverhangPx: ES9_DERIVED.frontOverhangMM * k,
    rearOverhangPx: ES9_DERIVED.rearOverhangMM * k,
    /** 轮胎外径 / 半径（侧视矢量轮的外圈） */
    tireODPx: ES9_SPEC.tireODMM * k,
    tireRPx: (ES9_SPEC.tireODMM * k) / 2,
    /** 轮辋外径 / 半径（必须 = 胎半径 × 0.727，否则胎壁太薄一眼假） */
    rimODPx: ES9_SPEC.rimMM * k,
    rimRPx: (ES9_SPEC.rimMM * k) / 2,
  };
}

/**
 * 归一化车轮锚点（0–1，基于「不含后视镜的车体外廓」包围盒，车头朝上/朝右都通用）。
 * 沿车长方向：前轴 = 前悬 / 车长，后轴 = (前悬 + 轴距) / 车长。
 * 横向：轮距 / 车宽 决定左右轮的 x。
 */
export function wheelAnchors() {
  const {lengthMM, widthMM} = ES9_SPEC;
  const fy = ES9_DERIVED.frontOverhangMM / lengthMM; // 0.1864
  const ry = (ES9_DERIVED.frontOverhangMM + ES9_SPEC.wheelbaseMM) / lengthMM; // 0.7922
  const lx = 0.5 - ES9_DERIVED.trackMM / widthMM / 2; // 0.0736
  const rx = 1 - lx; // 0.9264
  return {
    'wheel.fl': {x: lx, y: fy},
    'wheel.fr': {x: rx, y: fy},
    'wheel.rl': {x: lx, y: ry},
    'wheel.rr': {x: rx, y: ry},
  } as const;
}

/**
 * 比例自检：把实测值丢进来，偏差 >tol 就返回失败原因（用于断言脚本，不要目测）。
 * 例：checkProportions({lengthPx: 922, heightPx: 319}) —— 侧视照片实测长/高
 */
export function checkProportions(
  m: {lengthPx?: number; heightPx?: number; widthPx?: number; rimPx?: number; tirePx?: number},
  tol = 0.02,
): string[] {
  const bad: string[] = [];
  const cmp = (name: string, got: number, want: number) => {
    if (Math.abs(got - want) / want > tol) {
      bad.push(`${name} 实测 ${got.toFixed(3)} vs 实车 ${want.toFixed(3)}（偏差 ${((got / want - 1) * 100).toFixed(1)}%）`);
    }
  };
  if (m.lengthPx && m.heightPx) cmp('长/高', m.lengthPx / m.heightPx, CROSS_RATIOS.lengthOverHeight);
  if (m.lengthPx && m.widthPx) cmp('长/宽', m.lengthPx / m.widthPx, CROSS_RATIOS.lengthOverWidth);
  if (m.rimPx && m.tirePx) cmp('轮辋/轮胎', m.rimPx / m.tirePx, ES9_SPEC.rimToTireRatio);
  return bad;
}
