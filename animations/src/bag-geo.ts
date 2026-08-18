// 灵动宠物包 · 几何常量
//
// ⚠️ 素材合规：用户提供的两张座舱参考图（es9-cabin-topdown-ref / es9-front-island-ref）
//    右下角带第三方水印与账号号码，按 approved-asset-manifest.json 标为 reference-only ——
//    **只用来校正画法，不得内联进交付页**。因此本动画的座舱是比例化概念图
//    （visualFidelity: proportional-concept），不是实拍、也不是 CAD。
//
// 两个视角：
//   A 座舱俯视平面（第 1、3 章）—— 讲「包在哪、谁够得着」
//   B 岛台侧视剖面（第 1、2、4 章）—— 讲「怎么固定、栓扣怎么用、按键在哪」

export {T_COLORS, F_UI, F_DATA, clamp01, win, easeOutBack, frac} from './data';

// ── 视角 A：座舱俯视平面 ─────────────────────────────────────────────────
// 舞台 1000×560，车头朝上。左舵：驾驶位在左、副驾在右。
// 尺寸来源：ES9 车宽 2029mm 为唯一实车依据，其余座舱包装尺寸为概念值（见 conceptualItems）
export const PLAN = {
  mmPerPx: 6.6,                 // 座舱内宽 1620mm ↔ 245px
  cx: 470,                      // 座舱中线（舞台 x）
  yDash: 92,                    // 仪表台前沿
  innerWmm: 1620,               // 座舱内宽（概念值）
  rowPitchMM: [0, 1050, 2000],  // 一/二/三排 H 点纵向间距（概念值）
  yRow1: 200,                   // 一排 H 点（舞台 y）
  seatWmm: 520,                 // 单座宽（概念值）
  seatLmm: 560,                 // 单座进深（概念值）
} as const;

export const pmm = (v: number) => v / PLAN.mmPerPx;      // 毫米 → 平面视 px
export const PLAN_INNER_W = pmm(PLAN.innerWmm);          // ≈ 245.5
export const PLAN_SEAT_W = pmm(PLAN.seatWmm);            // ≈ 78.8
export const PLAN_SEAT_L = pmm(PLAN.seatLmm);            // ≈ 84.8
export const planRowY = (i: 0 | 1 | 2) => PLAN.yRow1 + pmm(PLAN.rowPitchMM[i]);

/** 中央岛台（俯视）：从仪表台一直贯通到二排前沿，宠物包固定在中段软包上 */
export const ISLAND_PLAN = {
  wmm: 300,                                  // 岛台宽（概念值）
  y0: PLAN.yRow1 - pmm(560),                 // 前端（接仪表台）
  y1: PLAN.yRow1 + pmm(900),                 // 后端（二排屏所在面）
  /** 三段分界（相对 y0 的比例）：托盘/杯架 → 软包扶手（放包）→ 后端屏 */
  seg: [0.0, 0.34, 0.78, 1.0] as const,
};
export const ISLAND_PLAN_W = pmm(ISLAND_PLAN.wmm);       // ≈ 45.5

/** 前排乘员肩点（俯视），用于画「伸手可及」范围 */
export const SHOULDER = {
  driver: {x: PLAN.cx - pmm(370), y: PLAN.yRow1 - pmm(120)},
  front:  {x: PLAN.cx + pmm(370), y: PLAN.yRow1 - pmm(120)},
};
/** 坐姿单臂可及半径（肩到掌心）概念值 700mm —— 用来证明「主副驾都能摸到」 */
export const REACH_MM = 700;
export const REACH_R = pmm(REACH_MM);                    // ≈ 106.1

// ── 视角 B：前排实拍舞台 ────────────────────────────────────────────────
// 舞台 1000×560，**车头在 −x（左）**——与 ES8 前排实拍照片方向一致（bag-data 顶部有推定）。
// 高度基准：座舱地板 = FLOOR，向上为负 y。
export const SIDE = {
  mmPerPx: 2.4,                 // 岛台段特写，比平面视放大约 2.75 倍
  FLOOR: 452,                   // 地板线（舞台 y）
  x0: 250,                      // 岛台前端（靠仪表台一侧）
  topMM: 560,                   // 岛台上表面离地高（概念值：坐垫 300 + 扶手 260）
  lenMM: 1150,                  // 岛台总长（概念值）
  frontTrayMM: 390,             // 前段托盘/杯架长度
  padMM: 520,                   // 中段软包扶手长度（宠物包放这里）
} as const;

export const smm = (v: number) => v / SIDE.mmPerPx;      // 毫米 → 侧视 px
export const ISLAND_TOP = SIDE.FLOOR - smm(SIDE.topMM);  // ≈ 218.7
export const ISLAND_LEN = smm(SIDE.lenMM);               // ≈ 479.2
export const PAD_X0 = SIDE.x0 + smm(SIDE.frontTrayMM);   // 软包段起点 ≈ 412.5
export const PAD_LEN = smm(SIDE.padMM);                  // ≈ 216.7

/** 宠物包（概念件：尺寸/材质/开口形式均未定义） */
export const BAG_MM = {w: 460, h: 320, d: 330};
export const BAG = {
  w: smm(BAG_MM.w),                                      // ≈ 191.7
  h: smm(BAG_MM.h),                                      // ≈ 133.3
  /** 固定后包底所在 x（居中落在软包段上） */
  x: PAD_X0 + (PAD_LEN - smm(BAG_MM.w)) / 2,             // ≈ 425.0
  y: ISLAND_TOP,                                         // 包底贴岛台上表面
};

/** 岛台固定点（概念接口）：包底两处锁舌，落锁后与岛台咬合 */
export const LATCH_X = [BAG.x + BAG.w * 0.26, BAG.x + BAG.w * 0.74];

/** 固定/解锁开关 = **岛台储物空间的物理开关**（用户指定共用，不再画概念圆键）。
 *  ⚠️ 这是**照片锚定**的控件：真实槽形开关在照片托盘前段（舞台 (442, 315.5)），
 *  这里的世界坐标由 SIDE_CAM 反解得来（(442−tx)/s, (315.5−ty)/s）——
 *  **换相机必须重反解**，否则开关会飘离照片里的真实按键。 */
export const BUTTON = {
  x: 398.3, y: 222,
  w: smm(70), h: smm(16),
};

/** 包内栓扣：固定端在包内**车尾侧**壁（+x）——猫朝车头（−x），往车头走绳才会拉直 */
export const TETHER_MM = 260;                            // 绳长（概念值，待产品定义）
export const TETHER = {
  anchor: {x: BAG.x + BAG.w * 0.84, y: BAG.y - BAG.h * 0.62},
  len: smm(TETHER_MM),                                   // ≈ 108.3
};

/** 猫（小型宠物）概念尺寸：体长 450mm、坐高 330mm —— 坐姿高于包高，头露在敞篷外可被抚摸 */
export const CAT_MM = {bodyMM: 450, sitMM: 330};
export const CAT = {body: smm(CAT_MM.bodyMM), sit: smm(CAT_MM.sitMM)};

/** 敞篷（内部需求文档提到「到达目的地～关闭敞篷」）：行驶中打开露出宠物头部，下车前合上再提走。
 *  ⚠️ 铰链必须在**朝车尾**的那一侧，盖板向车尾方向翻开 ——
 *  前排的人是从车头侧伸手过来摸宠物的，盖板往车头翻会直接挡住手。
 *  本视角车头在 −x，所以铰链取包体 +x（车尾）一端，openDeg 取正（顺时针 = 向车尾上方翻起）。 */
export const CANOPY = {
  /** 合上时的顶面 y */
  closedY: BAG.y - BAG.h,
  openDeg: 108,
  hinge: {x: BAG.x + BAG.w * 0.92, y: BAG.y - BAG.h},
};

// ── 状态机：固定 ↔ 解锁（两个方向都必须由用户动作触发，不许自动切换）────
export type LatchState = 'free' | 'placed' | 'locked' | 'released';
