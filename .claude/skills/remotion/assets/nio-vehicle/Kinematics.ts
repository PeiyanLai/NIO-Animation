// 四轮转向（4WS）运动学 —— 与场景无关的通用版
// 出处：平移泊入动画 remotion-terrain/src/parking-data.ts，已剥离车位/时序等场景常量。
//
// 模型（自行车模型，参考点 = **后轴中心**）：
//   dψ/ds = cos(δr)·(tanδf − tanδr) / L
//   dx/ds = cos(ψ + δr)，dy/ds = sin(ψ + δr)
//   s 为后轴点**带符号**路程（s>0 前进，s<0 倒车），ψ 为航向（rad，math 约定）
//
// 退化自检（selfCheck 会跑，改公式后必须仍然通过）：
//   δr = 0  ⇒ dψ/ds = tanδf/L      经典自行车模型
//   δf = δr ⇒ dψ/ds = 0            纯平移（横摆恒零）
//
// SVG 呈现角：θ = ψ·180/π + 90（θ=0 车头朝上，配合 top.ts 的贴图朝向）。
//
// 为什么用解析积分而不是逐帧欧拉：每段转角恒定 ⇒ 轨迹是恒曲率圆弧，有闭式解，
// 任意时刻都能 O(1) 求值。断言脚本和渲染共用同一份 poseAt，不会出现「渲染对、断言错」。
//
// 终点精度的做法（重要）：**不要**从起点摸索着走到终点。先从 (0,0,ψ0) 正向积分整条
// 分段序列得到累计位移，再把起点反推成「目标位姿 − 累计位移」，终点就天然精确落位。

export const RAD = Math.PI / 180;
export const DEG = 180 / Math.PI;

/** 一段恒转角运动：s 带符号路程，df/dr 为前/后轮转角（度，同号 = 同向） */
export interface Segment {
  s: number;
  df: number;
  dr: number;
}

/** 后轴点位姿（ψ 为 rad） */
export interface RearPose {
  rx: number;
  ry: number;
  psi: number;
}

/** 单位路程横摆率（rad/px）。L = 轴距（与 s 同单位） */
export const yawRate = (L: number, df: number, dr: number) =>
  (Math.cos(dr * RAD) * (Math.tan(df * RAD) - Math.tan(dr * RAD))) / L;

/** 沿一段常转角轨迹解析积分后轴点位姿；|κ|≈0 时退化为直线（含纯平移） */
export function integrate(
  p: RearPose,
  seg: Segment,
  L: number,
): RearPose {
  const k = yawRate(L, seg.df, seg.dr);
  const d = seg.dr * RAD;
  if (Math.abs(k) < 1e-12) {
    return {
      rx: p.rx + seg.s * Math.cos(p.psi + d),
      ry: p.ry + seg.s * Math.sin(p.psi + d),
      psi: p.psi,
    };
  }
  const p1 = p.psi + k * seg.s;
  return {
    rx: p.rx + (Math.sin(p1 + d) - Math.sin(p.psi + d)) / k,
    ry: p.ry + (-Math.cos(p1 + d) + Math.cos(p.psi + d)) / k,
    psi: p1,
  };
}

/** 依次积分整条序列，返回每段结束时的位姿（含起点，长度 = segs.length + 1） */
export function integrateSequence(start: RearPose, segs: Segment[], L: number): RearPose[] {
  const out: RearPose[] = [start];
  let p = start;
  for (const sg of segs) {
    p = integrate(p, sg, L);
    out.push(p);
  }
  return out;
}

/**
 * 把「带符号路程序列」展开成 Segment[]：倒车段（s<0）自动把前后轮转角取反。
 * 这是「前进 + 倒车交替，两段横摆同号」的关键——倒车时不反打，车会摆回去。
 */
export const stepsToSegments = (steps: number[], df: number, dr: number): Segment[] =>
  steps.map((s) => ({s, df: s > 0 ? df : -df, dr: s > 0 ? dr : -dr}));

/** 后轴点 + 航向 → 车身中心（rearOffset = 后轴在车心之后多少 px） */
export const centerOf = (p: RearPose, rearOffset: number): [number, number] => [
  p.rx + rearOffset * Math.cos(p.psi),
  p.ry + rearOffset * Math.sin(p.psi),
];

/** 车身中心 + 航向 → 后轴点（反向换算） */
export const rearOf = (cx: number, cy: number, psi: number, rearOffset: number): RearPose => ({
  rx: cx - rearOffset * Math.cos(psi),
  ry: cy - rearOffset * Math.sin(psi),
  psi,
});

/** ψ(rad) → SVG 呈现角 θ(°)，θ=0 车头朝上 */
export const psiToTheta = (psi: number) => psi * DEG + 90;
/** SVG 呈现角 θ(°) → ψ(rad) */
export const thetaToPsi = (th: number) => (th - 90) * RAD;

/**
 * 反推起点：先正向积分求累计位移，再让终点精确落在 target。
 * target 给的是**车身中心**位姿（x, y, thEnd 度）。返回起点后轴位姿 + 每段末位姿。
 */
export function planToTarget(opts: {
  L: number;
  rearOffset: number;
  segs: Segment[];
  /** 起始航向角（SVG 呈现角，度；0 = 车头朝上） */
  thStart: number;
  /** 目标车身中心 + 呈现角 */
  target: {x: number; y: number; th?: number};
}): {start: RearPose; poses: RearPose[]; endTheta: number} {
  const {L, rearOffset, segs, thStart, target} = opts;
  const psi0 = thetaToPsi(thStart);

  // 1) 从原点正向积分，得到累计位移与终态航向
  let acc: RearPose = {rx: 0, ry: 0, psi: psi0};
  for (const sg of segs) acc = integrate(acc, sg, L);

  // 2) 目标后轴点 = 目标车心 − rearOffset·(cos ψend, sin ψend)
  const psiEnd = acc.psi;
  const tgtRear = rearOf(target.x, target.y, psiEnd, rearOffset);

  const start: RearPose = {rx: tgtRear.rx - acc.rx, ry: tgtRear.ry - acc.ry, psi: psi0};
  return {start, poses: integrateSequence(start, segs, L), endTheta: psiToTheta(psiEnd)};
}

/** 细采样整条轨迹的后轴点（画规划路径 polyline 用）；每段切 n 份 */
export function sampleTrack(start: RearPose, segs: Segment[], L: number, n = 6): [number, number][] {
  const pts: [number, number][] = [[start.rx, start.ry]];
  let p = start;
  for (const sg of segs) {
    for (let j = 1; j <= n; j++) {
      const q = integrate(p, {...sg, s: (sg.s * j) / n}, L);
      pts.push([q.rx, q.ry]);
    }
    p = integrate(p, sg, L);
  }
  return pts;
}

// ---------------------------------------------------------------------------
// 常用序列生成器：把「教学结论」直接变成分段序列
// ---------------------------------------------------------------------------

/**
 * 摆正车头（前后转角不等 ⇒ 有横摆）：前进/倒车交替 nSegs 段，累计横摆 = yawDeg。
 * 每段路程 = 总横摆 / (κ · 段数)；两个方向的横摆同号，车头单调摆正。
 */
export function yawSteps(opts: {
  L: number; df: number; dr: number; yawDeg: number; nSegs: number;
}): number[] {
  const k = yawRate(opts.L, opts.df, opts.dr);
  if (Math.abs(k) < 1e-12) throw new Error('δf = δr 时横摆率为 0，无法用它摆正车头');
  const per = (opts.yawDeg * RAD) / k / opts.nSegs;
  return Array.from({length: opts.nSegs}, (_, i) => (i % 2 === 0 ? per : -per));
}

/**
 * 纯平移横移（前后同角 ⇒ 横摆恒零）：每对「前进 d + 倒车 d」净横移 2d·sin δ。
 * 首尾各取半段，使纵向摆幅关于中心对称、首尾等高。
 */
export function crabSteps(opts: {deg: number; lateral: number; pairs: number}): number[] {
  const d = opts.lateral / (2 * opts.pairs * Math.sin(opts.deg * RAD));
  return [
    d / 2,
    ...Array.from({length: opts.pairs - 1}, () => [-d, d]).flat(),
    -d,
    d / 2,
  ];
}

// ---------------------------------------------------------------------------
// 车身矩形（避让 / 出界 / 信息卡判定共用）
// ---------------------------------------------------------------------------

/** 旋转矩形四角（舞台坐标）；th 为 SVG 呈现角（度） */
export function carCorners(
  cx: number, cy: number, thDeg: number, w: number, h: number,
): [number, number][] {
  const c = Math.cos(thDeg * RAD), s = Math.sin(thDeg * RAD);
  return ([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]] as const).map(
    ([x, y]) => [cx + x * c - y * s, cy + x * s + y * c] as [number, number],
  );
}

/** 旋转后包围盒半宽 / 半高（信息卡避让与出界判断用） */
export const halfSpan = (thDeg: number, w: number, h: number) => {
  const c = Math.abs(Math.cos(thDeg * RAD)), s = Math.abs(Math.sin(thDeg * RAD));
  return {w: (w * c + h * s) / 2, h: (h * c + w * s) / 2};
};

// ---------------------------------------------------------------------------
// 退化自检：改了公式必须仍然通过（断言脚本里直接调用）
// ---------------------------------------------------------------------------

/** 返回失败原因列表，空数组 = 通过 */
export function selfCheck(L = 143): string[] {
  const bad: string[] = [];
  // 1) δr = 0 ⇒ 经典自行车模型
  for (const df of [5, 20, 40]) {
    if (Math.abs(yawRate(L, df, 0) - Math.tan(df * RAD) / L) > 1e-12) {
      bad.push(`δr=0 未退化为经典自行车模型（δf=${df}）`);
    }
  }
  // 2) δf = δr ⇒ 横摆恒零
  for (const d of [3, 8, 25]) {
    if (Math.abs(yawRate(L, d, d)) > 1e-15) bad.push(`δf=δr=${d} 时横摆率应为 0`);
  }
  // 3) 纯平移：行进方向 = 车头 ± δ，且航向不变
  const p0: RearPose = {rx: 0, ry: 0, psi: thetaToPsi(0)};
  const p1 = integrate(p0, {s: 100, df: 8, dr: 8}, L);
  if (Math.abs(psiToTheta(p1.psi)) > 1e-12) bad.push('纯平移段航向发生了变化');
  if (Math.abs(Math.hypot(p1.rx - p0.rx, p1.ry - p0.ry) - 100) > 1e-9) {
    bad.push('纯平移段位移长度 ≠ 路程');
  }
  // 4) 恒曲率闭式解 vs 细分欧拉积分（1000 步）应当一致
  const seg: Segment = {s: 60, df: 30, dr: 6};
  const closed = integrate(p0, seg, L);
  let e = {...p0};
  const N = 20000, ds = seg.s / N, k = yawRate(L, seg.df, seg.dr), d = seg.dr * RAD;
  for (let i = 0; i < N; i++) {
    e = {rx: e.rx + ds * Math.cos(e.psi + d), ry: e.ry + ds * Math.sin(e.psi + d), psi: e.psi + k * ds};
  }
  if (Math.hypot(closed.rx - e.rx, closed.ry - e.ry) > 0.01) {
    bad.push(`闭式解与数值积分不一致 Δ=${Math.hypot(closed.rx - e.rx, closed.ry - e.ry).toFixed(4)}`);
  }
  // 5) 反推起点 ⇒ 终点精确落位
  const segs = stepsToSegments(yawSteps({L, df: 40, dr: 8, yawDeg: 22, nSegs: 6}), 40, 8);
  const plan = planToTarget({L, rearOffset: 69, segs, thStart: -22, target: {x: 600, y: 280}});
  const last = plan.poses[plan.poses.length - 1];
  const [ex, ey] = centerOf(last, 69);
  if (Math.hypot(ex - 600, ey - 280) > 1e-6) bad.push(`反推起点后终点未落位 (${ex}, ${ey})`);
  if (Math.abs(plan.endTheta) > 1e-9) bad.push(`终态呈现角应为 0，实为 ${plan.endTheta}`);
  return bad;
}
