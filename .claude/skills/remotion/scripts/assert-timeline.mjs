#!/usr/bin/env node
/**
 * 全时间轴断言脚手架 —— 无图校验优先，把「看图找问题」换成「数值报错」。
 *
 * 为什么：渲染命令本身不贵，贵的是「渲染 → 抽帧读图 → 修 → 重渲」的视觉验证循环。
 * 逐 0.02s 扫一遍时间轴，把「车压到邻车 / 卡片出界 / 偏航过摆 / 终点没落位」这类问题
 * 变成一行报错，比截十张图便宜几个数量级，而且能覆盖到你根本不会去截的那一帧。
 *
 * 抽自 parking / pet 两个动画的断言脚本（scratchpad/pk-assert.ts、pet-assert.ts）。
 *
 * ── 用法（把场景数据编译成 ESM 后 import 本模块） ───────────────────────────
 *   npx esbuild my-assert.ts --bundle --format=esm --outfile=/tmp/a.mjs && node /tmp/a.mjs
 *
 *   import {createAsserter, sweep, rectCorners, satGap} from '<skill>/scripts/assert-timeline.mjs';
 *   const A = createAsserter();
 *   sweep(built.T, 0.02, (t) => {
 *     const p = poseAt(built, t);                       // 渲染端同一份求值逻辑
 *     const car = rectCorners(p.x, p.y, CAR_W, CAR_H, p.th);
 *     A.minGap(car, neighbor, 10, `t=${t.toFixed(2)} 与邻车余量`);
 *     A.inside(cardPoly, SAFE, `t=${t.toFixed(2)} 信息卡`);
 *     A.noOverlap(cardPoly, car, `t=${t.toFixed(2)} 信息卡压车身`);
 *     A.max(Math.abs(p.f), F_MAX, `t=${t.toFixed(2)} 前轮转角`);
 *     A.monotonic('yaw', p.th, +1, `t=${t.toFixed(2)} 偏航`);
 *     A.phase(p.ph);
 *   });
 *   A.endpoint([end.x, end.y], [SLOT.x, SLOT.y], 0.5, '终点');
 *   A.phasesComplete(5, '相位');
 *   A.report({时长: built.T});                           // 打印表格 + 非零退出码
 *
 * ── 断言原语清单 ────────────────────────────────────────────────────────────
 *   几何：satGap / rectCorners / polyBBox / minGap / noOverlap / inside / notCross
 *   序列：monotonic / bounded / max / min / range
 *   终态：endpoint / equals / phase / phasesComplete
 *   自检：ok（任意布尔）
 *
 * 直接运行 `node assert-timeline.mjs --selftest` 会跑一遍原语自测。
 */

// ---------------------------------------------------------------------------
// 几何原语
// ---------------------------------------------------------------------------

const RAD = Math.PI / 180;

/** 旋转矩形四角（舞台坐标）；thDeg 为 SVG 呈现角 */
export function rectCorners(cx, cy, w, h, thDeg = 0) {
  const c = Math.cos(thDeg * RAD), s = Math.sin(thDeg * RAD);
  return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(
    ([x, y]) => [cx + x * c - y * s, cy + x * s + y * c],
  );
}

/** 轴对齐矩形 → 四角（left/top/right/bottom 或 x/y/w/h 都接受） */
export function boxCorners(b) {
  const left = b.left ?? b.x0 ?? b.x;
  const top = b.top ?? b.y0 ?? b.y;
  const right = b.right ?? b.x1 ?? (b.x + b.w);
  const bottom = b.bottom ?? b.y1 ?? (b.y + b.h);
  return [[left, top], [right, top], [right, bottom], [left, bottom]];
}

/**
 * 两个**凸**多边形沿各边法线的最大间隙（分离轴定理）。
 * 返回值 > 0 = 相离且这是真实距离的**保守下界**；<= 0 = 相交。
 * 用它而不是「中心距 − 半径和」：旋转矩形的外接圆会严重高估碰撞。
 */
export function satGap(A, B) {
  const axes = [];
  for (const Q of [A, B]) {
    for (let i = 0; i < Q.length; i++) {
      const [x1, y1] = Q[i];
      const [x2, y2] = Q[(i + 1) % Q.length];
      const dx = x2 - x1, dy = y2 - y1;
      const n = Math.hypot(dx, dy) || 1;
      axes.push([-dy / n, dx / n]);
    }
  }
  let best = -Infinity;
  for (const [ax, ay] of axes) {
    const pa = A.map(([x, y]) => x * ax + y * ay);
    const pb = B.map(([x, y]) => x * ax + y * ay);
    best = Math.max(
      best,
      Math.max(Math.min(...pb) - Math.max(...pa), Math.min(...pa) - Math.max(...pb)),
    );
  }
  return best;
}

/** 多边形包围盒 */
export function polyBBox(poly) {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  return {left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys)};
}

// ---------------------------------------------------------------------------
// 时间轴扫描
// ---------------------------------------------------------------------------

/**
 * 逐步扫描时间轴。step 默认 0.02s（30fps 下每帧 1.5 个采样点，足够密）。
 * 最后一帧用 T - 1e-6 求值，避免落到分段序列之外。
 */
export function sweep(T, step, fn) {
  for (let t = 0; t <= T; t += step) fn(Math.min(t, T - 1e-6));
}

// ---------------------------------------------------------------------------
// 断言器
// ---------------------------------------------------------------------------

export function createAsserter({maxShown = 12, name = ''} = {}) {
  const fails = [];
  const seq = new Map(); // 单调性状态
  const phases = new Set();
  const stats = new Map(); // 值域统计

  const prefix = name ? `[${name}] ` : '';
  const fail = (msg) => fails.push(prefix + msg);
  const track = (key, v) => {
    const s = stats.get(key) ?? {min: Infinity, max: -Infinity, last: undefined};
    s.min = Math.min(s.min, v);
    s.max = Math.max(s.max, v);
    s.last = v;
    stats.set(key, s);
  };

  const A = {
    /** 任意布尔断言 */
    ok(cond, msg) {
      if (!cond) fail(msg);
      return cond;
    },

    /** 两个凸多边形的最小间距 >= min（min=0 即「不许接触」） */
    minGap(a, b, min, msg) {
      const g = satGap(a, b);
      track(`gap:${msg.split(' ').pop()}`, g);
      if (g < min) fail(`${msg} 间距不足 ${g.toFixed(2)} < ${min}`);
      return g;
    },

    /** 两个凸多边形不重叠（等价 minGap(...,0)，但报错措辞更直白） */
    noOverlap(a, b, msg) {
      const g = satGap(a, b);
      if (g <= 0) fail(`${msg} 发生重叠（SAT gap ${g.toFixed(2)}）`);
      return g;
    },

    /** 多边形四边都在 safe 区内 */
    inside(poly, safe, msg) {
      const bb = polyBBox(poly);
      const s = {
        left: safe.x0 ?? safe.left, right: safe.x1 ?? safe.right,
        top: safe.y0 ?? safe.top, bottom: safe.y1 ?? safe.bottom,
      };
      if (bb.left < s.left) fail(`${msg} 左出界 ${bb.left.toFixed(1)} < ${s.left}`);
      if (bb.right > s.right) fail(`${msg} 右出界 ${bb.right.toFixed(1)} > ${s.right}`);
      if (bb.top < s.top) fail(`${msg} 上出界 ${bb.top.toFixed(1)} < ${s.top}`);
      if (bb.bottom > s.bottom) fail(`${msg} 下出界 ${bb.bottom.toFixed(1)} > ${s.bottom}`);
      return bb;
    },

    /**
     * 不许越过场景关键线（车位线 / 分界线 / 座舱边界）。
     * side: 'right' = 多边形最右边不得超过 line；'left' / 'top' / 'bottom' 同理。
     */
    notCross(poly, line, side, msg) {
      const bb = polyBBox(poly);
      const got = {right: bb.right, left: bb.left, top: bb.top, bottom: bb.bottom}[side];
      const bad = side === 'right' || side === 'bottom' ? got > line : got < line;
      if (bad) fail(`${msg} 越过关键线（${side}=${got.toFixed(1)} vs ${line}）`);
      return got;
    },

    /** 序列单调性：dir=+1 递增 / -1 递减；tol 允许的回退量 */
    monotonic(key, v, dir = 1, msg = key, tol = 1e-9) {
      const prev = seq.get(key);
      if (prev !== undefined && (v - prev) * dir < -tol) {
        fail(`${msg} 非单调 ${prev.toFixed(4)} → ${v.toFixed(4)}`);
      }
      seq.set(key, v);
      track(key, v);
      return v;
    },

    /** 值域上限 */
    max(v, limit, msg, tol = 1e-9) {
      track(msg, v);
      if (v > limit + tol) fail(`${msg} 超限 ${v.toFixed(3)} > ${limit}`);
      return v;
    },

    /** 值域下限 */
    min(v, limit, msg, tol = 1e-9) {
      track(msg, v);
      if (v < limit - tol) fail(`${msg} 低于下限 ${v.toFixed(3)} < ${limit}`);
      return v;
    },

    /** 闭区间 */
    range(v, lo, hi, msg, tol = 1e-9) {
      track(msg, v);
      if (v < lo - tol || v > hi + tol) fail(`${msg} 越界 ${v.toFixed(3)} ∉ [${lo}, ${hi}]`);
      return v;
    },

    /** 终点精度：二维点 */
    endpoint(got, want, tol, msg) {
      const d = Math.hypot(got[0] - want[0], got[1] - want[1]);
      if (d > tol) {
        fail(`${msg} 偏差 ${d.toFixed(4)} > ${tol}（${got.map((v) => v.toFixed(3))} vs ${want}）`);
      }
      return d;
    },

    /** 标量相等（带容差） */
    equals(got, want, tol, msg) {
      if (Math.abs(got - want) > tol) fail(`${msg} ${got.toFixed(4)} ≠ ${want}（容差 ${tol}）`);
      return got;
    },

    /** 记录出现过的相位 */
    phase(p) {
      phases.add(p);
      return p;
    },

    /** 相位齐全（分镜必须每一章都真的出现过） */
    phasesComplete(n, msg = '相位') {
      const missing = Array.from({length: n}, (_, i) => i).filter((i) => !phases.has(i));
      if (missing.length) fail(`${msg}不全，缺 ${missing.join(',')}（出现的：${[...phases].join(',')}）`);
      return phases;
    },

    /** 只统计不断言，便于在报告里带上关键读数 */
    track,

    get failures() {
      return fails;
    },

    /** 打印统计表 + 失败清单；有失败则 process.exit(1) */
    report(extra = {}, {exit = true} = {}) {
      const table = {...extra};
      for (const [k, s] of stats) {
        table[k] = `${s.min.toFixed(2)} ~ ${s.max.toFixed(2)}`;
      }
      if (Object.keys(table).length) console.table(table);
      if (fails.length) {
        console.error(`❌ ${fails.length} 条断言失败：\n` + fails.slice(0, maxShown).join('\n'));
        if (fails.length > maxShown) console.error(`… 还有 ${fails.length - maxShown} 条`);
        if (exit) process.exit(1);
        return false;
      }
      console.log(`✅ ${prefix}全部断言通过`);
      return true;
    },
  };
  return A;
}

// ---------------------------------------------------------------------------
// 原语自测：node assert-timeline.mjs --selftest
// ---------------------------------------------------------------------------

function selftest() {
  const bad = [];
  const chk = (c, m) => { if (!c) bad.push(m); };

  // SAT：相离 / 相切 / 相交
  const a = rectCorners(0, 0, 10, 10, 0);
  chk(Math.abs(satGap(a, rectCorners(20, 0, 10, 10, 0)) - 10) < 1e-9, 'SAT 相离间距应为 10');
  chk(Math.abs(satGap(a, rectCorners(10, 0, 10, 10, 0))) < 1e-9, 'SAT 相切应为 0');
  chk(satGap(a, rectCorners(5, 0, 10, 10, 0)) < 0, 'SAT 相交应为负');
  // 旋转 45° 的方块：半对角 7.07，中心距 14 时相离（外接圆判定会误报为相交）
  chk(satGap(a, rectCorners(14, 0, 10, 10, 45)) > 0, 'SAT 旋转矩形相离误判');
  chk(satGap(a, rectCorners(11, 0, 10, 10, 45)) < 0, 'SAT 旋转矩形相交漏判');

  // 包围盒
  const bb = polyBBox(rectCorners(5, 5, 4, 6, 0));
  chk(bb.left === 3 && bb.right === 7 && bb.top === 2 && bb.bottom === 8, 'polyBBox 错');

  // sweep 覆盖首尾
  const seen = [];
  sweep(1, 0.5, (t) => seen.push(+t.toFixed(6)));
  chk(seen[0] === 0 && seen[seen.length - 1] < 1 && seen.length === 3, `sweep 采样错 ${seen}`);

  // 断言器：应当抓到问题
  const A = createAsserter({name: 'selftest'});
  A.minGap(a, rectCorners(12, 0, 10, 10, 0), 5, '间距');
  A.monotonic('x', 1, 1, 'x');
  A.monotonic('x', 0, 1, 'x');
  A.max(11, 10, '转角');
  A.range(5, 0, 1, '比例');
  A.endpoint([1, 1], [0, 0], 0.1, '终点');
  A.inside(rectCorners(0, 0, 10, 10, 0), {x0: 0, y0: 0, x1: 100, y1: 100}, '卡片');
  A.notCross(rectCorners(50, 50, 10, 10, 0), 40, 'right', '卡片');
  A.phase(0); A.phase(2);
  A.phasesComplete(3);
  // 6 条单值断言 + inside 抓到左/上两条 + 相位不全 = 9
  chk(A.failures.length === 9, `断言器应抓到 9 条问题，实际 ${A.failures.length}:\n${A.failures.join('\n')}`);

  // 干净场景应当全过
  const B = createAsserter();
  B.minGap(a, rectCorners(30, 0, 10, 10, 0), 5, '间距');
  B.noOverlap(a, rectCorners(30, 0, 10, 10, 0), '重叠');
  B.monotonic('x', 1, 1, 'x'); B.monotonic('x', 2, 1, 'x');
  B.endpoint([0.001, 0], [0, 0], 0.01, '终点');
  B.phase(0); B.phase(1); B.phase(2);
  B.phasesComplete(3);
  chk(B.failures.length === 0, `干净场景不应有失败：${B.failures.join('\n')}`);

  if (bad.length) {
    console.error('❌ 原语自测失败：\n' + bad.join('\n'));
    process.exit(1);
  }
  console.log('✅ assert-timeline 原语自测通过（SAT / bbox / sweep / 断言器计数）');
}

if (process.argv[1] && process.argv[1].endsWith('assert-timeline.mjs')) {
  if (process.argv.includes('--selftest')) selftest();
  else {
    console.log('这是一个断言原语模块，请 import 使用；跑自测：node assert-timeline.mjs --selftest');
    console.log('用法示例见文件头注释。');
  }
}
