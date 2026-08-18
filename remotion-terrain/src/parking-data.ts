// 平移泊入动画 · 常量、四轮转向运动学与场景配置
// 视觉资产：ES9 正俯视照片（用户上传 PDF 第 2 页截帧；已纵向归正到 长/宽 = 5365/2029）
// 教育点：
//   场景一 —— 前轮 40° / 后轮同向 8°，前后转角不等 ⇒ 车身横摆（yaw），把翘在位外的车头摆正
//   场景二 —— 前后轮同为 8°，转角相等 ⇒ 横摆为零，车身纯平移，碎步净横移入位

export {T_COLORS, F_UI, F_DATA, clamp01, win, easeOutBack, frac} from './data';

// 车身轮廓（贴图 342×704 坐标系，车头朝上；含后视镜，已内缩 2px 防背景渗出）
// 车头按斜置灯带外缘描线：ES9 车头没有圆角，两侧灯带的斜线本身就是轮廓
// 车头段内缩仅 0.5px（其余 2px）——内缩多了会把灯条整个切掉
export const CAR_TOP_BODY =
  'M162.0,10.1L177.0,10.1L192.0,11.1L206.9,13.0L219.9,15.9L230.8,19.7L237.8,22.6L248.8,26.3L257.7,32.1L264.7,37.8L273.7,43.6L279.6,49.2L284.6,54.9L287.5,63.4L288.5,75.0L290.5,90.3L292.5,106.5L292.0,123.1L292.0,146.8L291.0,170.7L291.0,195.0L290.0,219.1L292.4,227.7L302.9,234.0L311.5,240.3L315.0,246.9L313.5,253.1L302.5,257.2L290.6,259.7L289.0,266.9L289.0,295.5L289.0,324.9L288.0,353.3L288.0,381.7L287.0,415.2L287.0,448.7L286.0,483.2L286.0,516.6L285.0,550.0L284.0,578.4L283.0,601.0L285.0,619.9L280.2,636.6L272.3,650.5L264.5,660.4L256.7,669.4L247.2,676.2L231.5,680.1L214.6,685.1L199.9,686.1L179.9,687.1L160.0,688.1L140.1,687.1L120.2,686.1L105.4,684.1L92.5,681.1L80.7,678.1L71.0,673.2L61.4,667.4L53.8,654.7L47.9,641.8L42.9,624.7L39.0,609.6L36.0,590.5L36.0,573.5L36.0,545.1L36.0,511.6L36.0,478.1L36.0,444.6L36.0,411.1L36.0,376.6L36.0,343.2L36.0,309.7L37.0,281.3L37.0,266.9L35.4,259.7L23.5,257.2L12.5,253.1L11.0,246.9L14.5,240.3L23.1,234.0L33.4,227.9L37.9,219.4L38.0,195.0L38.0,170.7L38.0,146.8L39.0,123.0L37.5,109.4L37.5,94.1L38.5,77.8L41.5,68.3L45.5,60.7L47.5,54.9L50.4,49.2L57.3,43.6L65.3,37.8L74.3,32.1L82.3,26.3L94.2,20.7L104.1,16.8L117.1,13.9L132.1,12.0L147.0,10.6Z';

export const CAR_SRC = {w: 342, h: 704};

// 车身包围盒：不含后视镜的车体外廓 —— 256 × 676 ↔ 2029mm × 5365mm（比例 2.641 : 实车 2.644）
export const CAR_BBOX = {x0: 36, y0: 12, x1: 292, y1: 688};

// 语义锚点（归一化 0–1，基于 CAR_BBOX，即车体外廓）
// 俯视照片看不到车轮：轮位按实车推算（前悬 1000 / 轴距 3250 / 后悬 1115；轮距 1730）
export const TOP_ANCHORS = {
  'vehicle.center': {x: 0.5, y: 0.5},
  'wheel.fl': {x: 0.074, y: 0.186},
  'wheel.fr': {x: 0.926, y: 0.186},
  'wheel.rl': {x: 0.074, y: 0.792},
  'wheel.rr': {x: 0.926, y: 0.792},
  'roof.sensor': {x: 0.5, y: 0.27},
} as const;

/**
 * 前大灯（照片坐标 342×704，车头朝上）。
 *
 * **不是等宽描边，是三层实心刀锋。** 实拍的 ES9 灯组是一条**带弧度、由内向外收窄**的
 * 刀锋：靠车头中线那端最宽（半宽 ~3.7px），往轮眉方向收到 ~2.0px，两端收成尖。
 * 早先画成一条等宽折线 + 11px 暗色描边，结果是「一根黑杠里嵌条细亮线」——
 * 而实车是**发亮的灯带**，暗色只是极窄的一圈灯壳。
 *
 * 几何来源：在俯视照片上逐行取亮度加权质心得到中心线，再沿法线量半宽。
 * 量半宽时**阈值不能取峰值的固定百分比**——灯周围有辉光，底值就有 155，
 * 取 45% 峰值永远够不到，宽度会一路触顶。要用「峰值与该点局部底值的中点」。
 *
 * 三层从下往上画：case（暗壳）→ warm（暖白灯体）→ core（高亮灯芯）。
 */
export const HEADLIGHTS = {
  left: {
    case: 'M93.3,20.0L90.3,19.9L88.5,20.4L87.2,20.8L86.1,21.1L85.0,21.8L83.7,22.6L82.3,23.5L80.9,24.4L79.5,25.3L78.2,26.1L76.8,27.0L75.4,27.8L73.9,28.8L72.5,29.7L71.1,30.6L69.7,31.5L68.3,32.4L66.9,33.3L65.4,34.3L64.0,35.3L62.6,36.2L61.2,37.2L59.8,38.2L58.4,39.2L57.0,40.3L55.6,41.4L54.3,42.5L53.1,43.7L51.9,44.9L50.7,46.1L49.5,47.4L48.3,48.8L47.1,50.3L46.0,51.9L45.1,53.7L44.6,55.7L44.5,57.8L44.9,59.9L46.2,62.0L46.2,62.0L48.3,60.9L49.7,59.8L50.9,59.0L52.0,58.2L53.1,57.3L54.1,56.3L55.2,55.4L56.3,54.5L57.5,53.5L58.7,52.4L60.0,51.4L61.2,50.4L62.4,49.4L63.6,48.4L64.8,47.4L66.0,46.4L67.3,45.4L68.5,44.4L69.8,43.5L71.1,42.5L72.4,41.6L73.7,40.7L75.1,39.8L76.5,38.9L77.8,38.1L79.2,37.2L80.6,36.4L82.0,35.6L83.5,34.7L84.9,33.8L86.3,32.9L87.7,32.0L89.1,31.1L90.6,30.1L92.1,28.9L93.5,27.1L94.4,25.0L94.5,22.8L93.3,20.0Z',
    warm: 'M93.3,20.0L90.8,20.3L89.3,21.0L88.0,21.6L86.9,22.1L85.7,22.8L84.3,23.7L83.0,24.6L81.6,25.5L80.2,26.3L78.8,27.2L77.4,28.0L76.0,28.9L74.6,29.8L73.2,30.7L71.8,31.6L70.4,32.6L69.0,33.5L67.5,34.4L66.1,35.3L64.7,36.3L63.3,37.3L61.9,38.2L60.6,39.2L59.2,40.2L57.8,41.2L56.4,42.3L55.1,43.5L53.9,44.7L52.7,45.9L51.5,47.1L50.4,48.3L49.2,49.6L48.1,51.1L47.0,52.7L46.2,54.4L45.6,56.2L45.4,58.2L45.5,60.1L46.2,62.0L46.2,62.0L47.7,60.7L48.8,59.5L49.9,58.4L51.0,57.5L52.1,56.5L53.1,55.5L54.3,54.6L55.4,53.6L56.7,52.5L57.9,51.5L59.2,50.5L60.4,49.4L61.6,48.4L62.8,47.4L64.0,46.4L65.3,45.4L66.5,44.4L67.8,43.4L69.1,42.4L70.4,41.5L71.7,40.6L73.0,39.7L74.4,38.8L75.8,37.9L77.2,37.0L78.6,36.2L80.0,35.3L81.4,34.5L82.8,33.6L84.2,32.7L85.6,31.8L87.1,30.9L88.5,30.0L89.9,29.1L91.4,27.9L92.7,26.3L93.6,24.4L94.0,22.5L93.3,20.0Z',
    core: 'M93.3,20.0L91.7,20.9L90.5,22.0L89.4,22.9L88.2,23.8L86.9,24.6L85.5,25.5L84.1,26.4L82.8,27.3L81.4,28.2L80.0,29.1L78.6,29.9L77.2,30.8L75.7,31.7L74.3,32.6L72.9,33.5L71.6,34.4L70.2,35.3L68.8,36.2L67.4,37.1L66.0,38.1L64.6,39.0L63.3,40.0L61.9,41.0L60.6,42.0L59.2,43.0L57.9,44.1L56.7,45.2L55.4,46.4L54.2,47.5L53.0,48.7L51.8,49.8L50.7,51.1L49.5,52.4L48.5,53.8L47.6,55.3L46.9,56.9L46.4,58.6L46.1,60.3L46.2,62.0L46.2,62.0L47.1,60.5L47.8,59.1L48.6,57.8L49.6,56.6L50.6,55.4L51.7,54.2L52.8,53.1L54.0,52.0L55.2,51.0L56.4,49.9L57.6,48.8L58.9,47.7L60.1,46.7L61.3,45.6L62.6,44.6L63.9,43.6L65.2,42.6L66.5,41.6L67.8,40.6L69.2,39.7L70.5,38.8L71.9,37.9L73.2,37.0L74.6,36.1L76.0,35.2L77.4,34.3L78.8,33.5L80.2,32.6L81.6,31.8L83.1,30.9L84.5,30.0L85.9,29.1L87.3,28.2L88.7,27.3L90.1,26.2L91.4,25.0L92.4,23.4L93.1,21.8L93.3,20.0Z',
  },
  right: {
    case: 'M238.1,20.0L236.6,22.9L236.6,25.1L237.2,27.3L238.4,29.2L239.8,30.6L241.2,31.7L242.6,32.7L243.9,33.7L245.3,34.6L246.6,35.6L248.0,36.5L249.4,37.4L250.8,38.3L252.2,39.2L253.6,40.1L255.0,41.0L256.3,41.8L257.7,42.7L259.1,43.6L260.4,44.6L261.7,45.5L263.0,46.4L264.2,47.3L265.4,48.2L266.6,49.2L267.8,50.2L268.9,51.1L270.0,52.1L271.2,53.1L272.3,54.1L273.5,55.2L274.7,56.2L275.8,57.3L276.9,58.3L277.9,59.2L279.1,59.9L280.4,60.6L282.0,61.4L284.7,62.0L284.7,62.0L286.2,59.6L286.5,57.5L286.2,55.3L285.5,53.4L284.5,51.7L283.3,50.3L282.2,49.0L281.1,47.7L280.0,46.4L278.8,45.2L277.6,43.9L276.2,42.7L274.9,41.6L273.5,40.5L272.1,39.5L270.7,38.4L269.3,37.4L267.9,36.5L266.5,35.6L265.1,34.6L263.8,33.7L262.4,32.8L261.1,31.8L259.7,30.9L258.4,30.0L257.0,29.0L255.7,28.1L254.4,27.2L253.1,26.3L251.8,25.3L250.5,24.4L249.2,23.5L247.9,22.6L246.7,21.7L245.6,21.0L244.4,20.7L243.1,20.4L241.2,19.9L238.1,20.0Z',
    warm: 'M238.1,20.0L237.2,22.5L237.3,24.6L238.1,26.5L239.2,28.3L240.6,29.6L242.0,30.7L243.3,31.7L244.6,32.7L246.0,33.6L247.4,34.6L248.7,35.5L250.1,36.4L251.5,37.3L252.9,38.2L254.3,39.1L255.7,39.9L257.0,40.8L258.4,41.7L259.8,42.6L261.1,43.5L262.4,44.4L263.7,45.3L265.0,46.3L266.2,47.2L267.4,48.2L268.6,49.2L269.7,50.2L270.9,51.2L272.0,52.2L273.2,53.3L274.4,54.3L275.6,55.4L276.7,56.4L277.8,57.5L278.9,58.4L280.0,59.2L281.2,60.1L282.6,61.1L284.7,62.0L284.7,62.0L285.6,59.8L285.6,57.9L285.2,55.9L284.6,54.1L283.5,52.6L282.4,51.2L281.3,49.8L280.2,48.6L279.1,47.3L277.9,46.1L276.7,44.8L275.4,43.7L274.1,42.6L272.7,41.5L271.4,40.5L270.0,39.4L268.6,38.5L267.2,37.5L265.8,36.6L264.4,35.7L263.1,34.8L261.7,33.8L260.4,32.9L259.0,31.9L257.7,31.0L256.4,30.1L255.0,29.2L253.7,28.2L252.4,27.3L251.1,26.4L249.8,25.4L248.5,24.5L247.2,23.6L245.9,22.7L244.8,22.0L243.6,21.5L242.3,20.9L240.7,20.3L238.1,20.0Z',
    core: 'M238.1,20.0L238.2,21.9L238.8,23.5L239.7,25.1L240.8,26.4L242.1,27.6L243.5,28.6L244.8,29.6L246.1,30.6L247.5,31.5L248.8,32.5L250.2,33.4L251.6,34.3L252.9,35.2L254.3,36.1L255.7,37.0L257.0,37.9L258.4,38.8L259.8,39.7L261.1,40.6L262.5,41.5L263.8,42.4L265.1,43.3L266.4,44.3L267.7,45.3L268.9,46.2L270.2,47.3L271.4,48.3L272.6,49.4L273.8,50.4L274.9,51.5L276.1,52.6L277.2,53.8L278.4,54.9L279.5,56.0L280.5,57.2L281.5,58.3L282.5,59.5L283.5,60.8L284.7,62.0L284.7,62.0L284.7,60.2L284.4,58.5L283.7,56.9L282.9,55.4L281.9,54.0L280.8,52.7L279.7,51.4L278.5,50.2L277.4,49.0L276.2,47.8L275.0,46.7L273.8,45.6L272.5,44.5L271.2,43.4L269.9,42.4L268.5,41.4L267.2,40.5L265.8,39.5L264.4,38.6L263.1,37.7L261.7,36.8L260.4,35.8L259.0,34.9L257.7,34.0L256.3,33.1L255.0,32.2L253.6,31.3L252.3,30.3L251.0,29.4L249.6,28.5L248.3,27.5L247.0,26.6L245.7,25.6L244.4,24.7L243.2,23.8L242.0,22.9L240.9,22.0L239.7,20.9L238.1,20.0Z',
  },
} as const;

/** 三层配色：暗壳只是极窄一圈，主体是发亮的灯带 */
export const HEADLIGHT_FILLS = [
  {key: 'case' as const, fill: '#0E1414', opacity: 0.92},
  {key: 'warm' as const, fill: '#FFF6E2', opacity: 1},
  {key: 'core' as const, fill: '#FFFFFF', opacity: 0.95},
] as const;

/** 舞台像素 → 毫米（车长 5365mm 对应 CAR_H=236px） */
export const MM_PER_PX = 5365 / 236;

// ---------------------------------------------------------------------------
// 车身显示尺寸与轴距
// ---------------------------------------------------------------------------
export const CAR_H = 236;                                        // 车长（舞台 px）↔ 5365mm
export const CAR_SCALE = CAR_H / (CAR_BBOX.y1 - CAR_BBOX.y0);    // 贴图 → 舞台
export const CAR_W = (CAR_BBOX.x1 - CAR_BBOX.x0) * CAR_SCALE;    // ≈ 89.37px ↔ 2031mm

/** 轴距（舞台 px）：3250mm / 22.733 ≈ 142.96 —— 与 TOP_ANCHORS 前后轮间距 143.0 一致 */
export const L_WB = 3250 / MM_PER_PX;
/** 后轴中心相对车身中心的偏移（沿车头方向为负；此处取标量：后轴在中心之后 REAR_OFF px） */
export const REAR_OFF = (TOP_ANCHORS['wheel.rl'].y - 0.5) * CAR_H;   // 68.912
export const FRONT_OFF = (0.5 - TOP_ANCHORS['wheel.fl'].y) * CAR_H;  // 74.104

// 转向物理（用户给定的真实约束）
export const F_MAX = 40;   // 前轮最大转角
export const R_MAX = 8;    // 后轮同向最大转角

// 舞台 1000×560；路边平行车位竖排在右侧，开口（临车道）在左边虚线、右侧封闭
// 车位 112 × 250px ↔ 2546mm × 5683mm（车体 2029mm，两侧各留约 250mm，符合标准车位）
export const SLOT = {x: 600, y: 280, w: 112, h: 250};
export const SLOT_L = SLOT.x - SLOT.w / 2;   // 544 —— 开口虚线
export const SLOT_R = SLOT.x + SLOT.w / 2;   // 656 —— 封闭实线
export const NEIGHBORS = [
  {x: 600, y: 10},    // 前车（上）
  {x: 600, y: 550},   // 后车（下）
];

const RAD = Math.PI / 180;

// ---------------------------------------------------------------------------
// 四轮转向运动学（自行车模型，参考点 = 后轴中心）
//   dψ/ds = cos(δr)·(tanδf − tanδr)/L        ψ：航向（rad，math 约定，ψ=−90° ⇒ 车头朝 −y）
//   dx/ds = cos(ψ + δr)，dy/ds = sin(ψ + δr)  s：后轴点带符号路程（s>0 前进，s<0 倒车）
// 校验：δr=0 ⇒ dψ/ds = tanδf/L（经典自行车模型）；δf=δr ⇒ dψ/ds = 0（纯平移）
// SVG 呈现角 θ = ψ + 90°（θ=0 车头朝上），dθ = dψ
// ---------------------------------------------------------------------------

/** 单位路程横摆率（rad/px） */
export const yawRate = (df: number, dr: number) =>
  (Math.cos(dr * RAD) * (Math.tan(df * RAD) - Math.tan(dr * RAD))) / L_WB;

/** 沿一段常转角轨迹解析积分后轴点位姿；s 带符号 */
export function integrate(
  rx: number, ry: number, psi: number, s: number, df: number, dr: number,
): [number, number, number] {
  const k = yawRate(df, dr);
  const d = dr * RAD;
  if (Math.abs(k) < 1e-12) {
    return [rx + s * Math.cos(psi + d), ry + s * Math.sin(psi + d), psi];
  }
  const p1 = psi + k * s;
  return [
    rx + (Math.sin(p1 + d) - Math.sin(psi + d)) / k,
    ry + (-Math.cos(p1 + d) + Math.cos(psi + d)) / k,
    p1,
  ];
}

/** 后轴点 + 航向 → 车身中心 */
export const centerOf = (rx: number, ry: number, psi: number): [number, number] =>
  [rx + REAR_OFF * Math.cos(psi), ry + REAR_OFF * Math.sin(psi)];

/** 车身旋转矩形四角（舞台坐标） */
export function carCorners(cx: number, cy: number, thDeg: number): [number, number][] {
  const c = Math.cos(thDeg * RAD), s = Math.sin(thDeg * RAD);
  return ([[-CAR_W / 2, -CAR_H / 2], [CAR_W / 2, -CAR_H / 2], [CAR_W / 2, CAR_H / 2], [-CAR_W / 2, CAR_H / 2]] as const)
    .map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c] as [number, number]);
}

/** 旋转后车身包围盒半宽 / 半高（用于信息卡避让与出界判断） */
export const halfSpan = (thDeg: number) => {
  const c = Math.abs(Math.cos(thDeg * RAD)), s = Math.abs(Math.sin(thDeg * RAD));
  return {w: (CAR_W * c + CAR_H * s) / 2, h: (CAR_H * c + CAR_W * s) / 2};
};

// ---------------------------------------------------------------------------
// 分段序列
// ---------------------------------------------------------------------------
// 场景一：6 段「前进(+40/+8) → 倒车(−40/−8)」交替。
// 前进时 ds>0、dψ/ds>0；倒车时 ds<0、dψ/ds<0 —— 两段横摆同号，车头单调摆正。
// 每段路程 = 总横摆 / (κ · 段数)，κ = cos8°·(tan40°−tan8°)/L ≈ 0.2772 °/px。
const A_YAW0 = 22;      // 初始偏航角（°，车头朝开口方向翘出）
const A_SEGS = 6;
const A_PER = (A_YAW0 * RAD) / yawRate(F_MAX, R_MAX) / A_SEGS;   // ≈ 13.23px
const A_STEPS = Array.from({length: A_SEGS}, (_, i) => (i % 2 === 0 ? A_PER : -A_PER));

// 场景二：前后同为 8° ⇒ 横摆恒为 0，行进方向 = 车头 ± 8°。
// 每对「前进 d + 倒车 d」净横移 2d·sin8°；首尾各取半段，使纵向摆幅关于车位中心对称、且首尾等高。
const B_PAIRS = 8;
const B_LAT = 56;                                                 // 需要的净横移（车心 544 → 600）
const B_D = B_LAT / (2 * B_PAIRS * Math.sin(R_MAX * RAD));        // ≈ 25.15px
const B_STEPS = [
  B_D / 2,
  ...Array.from({length: B_PAIRS - 1}, () => [-B_D, B_D]).flat(),
  -B_D,
  B_D / 2,
];

export interface PkScene {
  chip: string;
  sub: string;
  caps: string[];
  /** 展示用前轮转角 */
  df: number;
  /** 展示用后轮转角（同向） */
  dr: number;
  /** 初始偏航角（SVG rotate 度；负号 = 车头朝车位开口方向翘出） */
  yaw0: number;
  /** 带符号路程序列（px，>0 前进 / <0 倒车） */
  steps: number[];
  /** 时序（秒） */
  tIdle: number;
  tTap: number;
  tSteerIn: number;
  tHold: number;
  tMove: number;
  tTurn: number;
  tOut: number;
  tEnd: number;
}

export const PK_SCENES: Record<'a' | 'b', PkScene> = {
  a: {
    chip: '场景一 · 车尾已入位 · 摆正车头',
    sub: '前轮 40°、后轮同向 8°，前后不等产生横摆，把翘在外的车头摆进车位',
    caps: [
      '人工泊入：车尾已进车位，车头还斜翘在位外',
      '点按开启，方向盘与后轮同时交给系统',
      '前轮 40° · 后轮同向 8° —— 前后不等 ⇒ 车身横摆，车头往里摆',
      '前进 · 倒车碎步交替，两个方向都在往同一侧摆正车头',
      '偏航归零，车身正落车位中心，车轮回正',
    ],
    df: F_MAX,
    dr: R_MAX,
    yaw0: -A_YAW0,
    steps: A_STEPS,
    tIdle: 1.3, tTap: 1.0, tSteerIn: 0.5, tHold: 1.2,
    tMove: 0.5, tTurn: 0.32, tOut: 0.6, tEnd: 1.7,
  },
  b: {
    chip: '场景二 · 车身已摆正 · 平移入位',
    sub: '前后轮同为 8°、转角一致，横摆为零，碎步把最后半个车身整体平移进去',
    caps: [
      '人工泊入：车身已与车位平行，还有半个车身在位外',
      '点按开启，四个车轮同步接管',
      '前后轮同为 8° · 转角一致 ⇒ 车身不转，整体平移',
      '斜向前挪 · 反向后挪，纵向抵消、横向累积，车身始终摆正',
      '横移到位，车身正落车位中心，车轮回正',
    ],
    df: R_MAX,
    dr: R_MAX,
    yaw0: 0,
    steps: B_STEPS,
    tIdle: 1.3, tTap: 1.0, tSteerIn: 0.5, tHold: 1.2,
    tMove: 0.26, tTurn: 0.22, tOut: 0.6, tEnd: 1.7,
  },
};

// ---------------------------------------------------------------------------
// 时间轴
// ---------------------------------------------------------------------------
export type Seg =
  | {type: 'still'; t0: number; dur: number; rx: number; ry: number; psi: number; f: number; r: number; ph: number; tap?: boolean}
  | {type: 'steer'; t0: number; dur: number; rx: number; ry: number; psi: number; f0: number; f1: number; r0: number; r1: number; ph: number}
  | {type: 'move'; t0: number; dur: number; rx: number; ry: number; psi: number; s: number; f: number; r: number; ph: number};

export interface Built {
  segs: Seg[];
  phStarts: number[];
  T: number;
  plan: string;
  tTap: number;
  tDone: number;
  start: {x: number; y: number; th: number};
}

const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

/**
 * 生成时间轴：先从 (0,0,ψ0) 正向积分整条分段序列得到累计位移与终态，
 * 再把起点反推为「目标位姿 − 累计位移」—— 终点天然精确落在 (SLOT.x, SLOT.y, θ=0)。
 */
export function buildPark(s: PkScene): Built {
  const psi0 = (-90 + s.yaw0) * RAD;

  // 1) 正向积分求累计位移
  let ax = 0, ay = 0, ap = psi0;
  for (const st of s.steps) {
    const df = st > 0 ? s.df : -s.df;
    const dr = st > 0 ? s.dr : -s.dr;
    [ax, ay, ap] = integrate(ax, ay, ap, st, df, dr);
  }
  // 2) 反推起点后轴位置：终态 ψ = −90° ⇒ 目标后轴 = 车位中心 + (0, REAR_OFF)
  let rx = SLOT.x - ax;
  let ry = SLOT.y + REAR_OFF - ay;
  let psi = psi0;

  const segs: Seg[] = [];
  let t = 0;
  const add = (o: any) => { segs.push({...o, t0: t}); t += o.dur; };

  // ph0 初始态 / ph1 点按开启
  add({type: 'still', dur: s.tIdle, rx, ry, psi, f: 0, r: 0, ph: 0});
  add({type: 'still', dur: s.tTap, rx, ry, psi, f: 0, r: 0, ph: 1, tap: true});

  // ph2 打角说明：0 → (df, dr)，然后保持一段时间读数
  add({type: 'steer', dur: s.tSteerIn, rx, ry, psi, f0: 0, f1: s.df, r0: 0, r1: s.dr, ph: 2});
  add({type: 'still', dur: s.tHold, rx, ry, psi, f: s.df, r: s.dr, ph: 2});

  // ph3 碎步执行
  const pts: [number, number][] = [[rx, ry]];
  for (let i = 0; i < s.steps.length; i++) {
    const st = s.steps[i];
    const df = st > 0 ? s.df : -s.df;
    const dr = st > 0 ? s.dr : -s.dr;
    if (i > 0) {
      const pf = s.steps[i - 1] > 0 ? s.df : -s.df;
      const pr = s.steps[i - 1] > 0 ? s.dr : -s.dr;
      add({type: 'steer', dur: s.tTurn, rx, ry, psi, f0: pf, f1: df, r0: pr, r1: dr, ph: 3});
    }
    add({type: 'move', dur: s.tMove, rx, ry, psi, s: st, f: df, r: dr, ph: 3});
    for (let j = 1; j <= 6; j++) {
      const [px, py] = integrate(rx, ry, psi, (st * j) / 6, df, dr);
      pts.push([px, py]);
    }
    [rx, ry, psi] = integrate(rx, ry, psi, st, df, dr);
  }

  // ph4 完成回正
  const lf = s.steps[s.steps.length - 1] > 0 ? s.df : -s.df;
  const lr = s.steps[s.steps.length - 1] > 0 ? s.dr : -s.dr;
  const tDone = t;
  add({type: 'steer', dur: s.tOut, rx, ry, psi, f0: lf, f1: 0, r0: lr, r1: 0, ph: 4});
  add({type: 'still', dur: s.tEnd, rx, ry, psi, f: 0, r: 0, ph: 4});

  const phStarts: number[] = [];
  for (const sg of segs) if (phStarts[sg.ph] === undefined) phStarts[sg.ph] = sg.t0;

  const [sx, sy] = centerOf(segs[0].rx, segs[0].ry, segs[0].psi);
  return {
    segs,
    phStarts,
    T: t,
    plan: pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '),
    tTap: segs[1].t0,
    tDone,
    start: {x: sx, y: sy, th: segs[0].psi / RAD + 90},
  };
}

export interface Pose {
  /** 车身中心（舞台 px） */
  x: number;
  y: number;
  /** SVG 呈现角（°，0 = 车头朝上） */
  th: number;
  /** 前轮 / 后轮转角（°） */
  f: number;
  r: number;
  /** 后轴点 */
  rx: number;
  ry: number;
  ph: number;
  seg: Seg;
  k: number;
}

/** 时间 → 位姿（ParkingStage 与断言共用同一份求值逻辑） */
export function poseAt(b: Built, t: number): Pose {
  let seg = b.segs[b.segs.length - 1];
  for (const sg of b.segs) if (t < sg.t0 + sg.dur) { seg = sg; break; }
  const k = Math.max(0, Math.min(1, (t - seg.t0) / seg.dur));
  const ke = easeInOut(k);

  let rx = seg.rx, ry = seg.ry, psi = seg.psi, f = 0, r = 0;
  if (seg.type === 'move') {
    [rx, ry, psi] = integrate(seg.rx, seg.ry, seg.psi, seg.s * ke, seg.f, seg.r);
    f = seg.f; r = seg.r;
  } else if (seg.type === 'steer') {
    f = seg.f0 + (seg.f1 - seg.f0) * ke;
    r = seg.r0 + (seg.r1 - seg.r0) * ke;
  } else {
    f = seg.f; r = seg.r;
  }
  const [x, y] = centerOf(rx, ry, psi);
  return {x, y, th: psi / RAD + 90, f, r, rx, ry, ph: seg.ph, seg, k};
}

// 信息卡几何（贴车身左下方，随车移动；禁止放画面边角）
export const CARD_W = 274;
export const CARD_H = 176;
/** 卡片右边缘 / 竖直中心（舞台坐标）——避开旋转后的车身包围盒，且不越过车位开口虚线 */
export function cardBox(x: number, y: number, th: number) {
  const hw = halfSpan(th).w;
  const right = Math.min(Math.max(x - hw - 26, 210), 496);
  const cy = Math.min(Math.max(y + 142, 132), 452);
  return {right, left: right - CARD_W, top: cy - CARD_H / 2, bottom: cy + CARD_H / 2};
}
/** 引导线落点：车身左侧偏后的一点（跟随车身旋转） */
export function leadPoint(x: number, y: number, th: number): [number, number] {
  const c = Math.cos(th * RAD), s = Math.sin(th * RAD);
  const bx = -CAR_W / 2 - 4, by = CAR_H * 0.2;
  return [x + bx * c - by * s, y + bx * s + by * c];
}
