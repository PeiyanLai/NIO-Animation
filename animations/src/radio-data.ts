// 对讲机组队动画 · 常量与场景配置
// scope: vehicle-ecosystem（随车硬件 + 车队协同）
// 分镜：有网组队对讲 → 无网地形硬件接力 + 云端桥接 → 非蔚来车 App 入队 → 混合车队队形
// 所有几何量都在 1000×560 舞台坐标系里；状态逻辑全部是纯函数，组件与断言共用。

export {T_COLORS, F_UI, F_DATA, clamp01, win, easeOutBack, frac} from './data';
import {clamp01} from './data';

export type RadioKey = 'a' | 'b' | 'c' | 'd';

/* ─── 角色色（NIO 浅色 token 之外的补充）─────────────────────────────
   硬件对讲链路 = 紫（#5D4DD4），云端链路 = 品牌青（C.accent），二者必须视觉可区分。*/
export const R = {
  hw: '#5D4DD4', hw2: '#7B6CE8', hwWash: '#EDEAFB',
  neg: '#D14545', negWash: '#FBECEC',
  nio: '#C8A57B', nioLine: '#8C7355', nioRoof: '#1A1A1E',
  oth: '#9AA7B4', othLine: '#6E7C88', othRoof: '#2B3138',
  road: '#DFE9EC', roadEdge: '#C3D3D7', lane: '#FFFFFF',
  nonet: '#9FB3BA',
  lampF: '#FFF3D2', lampR: '#D14545',
} as const;

/* ─── 纵向版式（一次定死，四个场景共用，避免元素打架）───────────────
   0───56  章节 chip（HTML 层）
   75──133 云端图标
   164─240 字幕气泡（贴着当前主体车，尖角朝下）
   258─292 车辆状态徽标（+9px 尖角 → 301，虚线引导线接到车顶 338）
   302─430 公路
   340─392 车身（中心 y=366）
   444─546 补充说明卡 / 距离标注区 */
export const GEO = {
  roadTop: 302, roadBot: 430, carY: 366,
  badgeY: 258, badgeH: 34, badgeTip: 9,
  capTop: 164, capBot: 240,
  cardTop: 446,
  carL: 112, carW: 52,
} as const;

/** 粗略字宽估算（CJK≈1em，西文≈0.56em，通用标点≈0.9em）——用于气泡自适应宽度 */
export const textW = (s: string, fs: number) => {
  let n = 0;
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    n += c < 0x2000 ? 0.56 : c < 0x2e80 ? 0.9 : 1;
  }
  return n * fs;
};

export const smooth = (k: number) => k * k * (3 - 2 * k);
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** 二次贝塞尔取点 / 取路径（云端链路的「数据包」沿线飞行用） */
export const qPt = (p: number[], c: number[], q: number[], u: number) => {
  const m = 1 - u;
  return {
    x: m * m * p[0] + 2 * m * u * c[0] + u * u * q[0],
    y: m * m * p[1] + 2 * m * u * c[1] + u * u * q[1],
  };
};
export const qPath = (p: number[], c: number[], q: number[]) =>
  `M${p[0]} ${p[1]} Q${c[0]} ${c[1]} ${q[0]} ${q[1]}`;

export interface CarSpec {
  kind: 'nio' | 'oth';
  wheel?: boolean;   // 车机方向盘按键（车载对讲能力，非手持机）
  x: number;            // 车中心 x（场景四由队形函数算）
  bx?: number;          // 徽标中心 x（默认同 x；用于躲开分界线）
  label: string;
  radio: boolean;       // 是否显示对讲机图标
  net: 'on' | 'off' | 'none';
}

export interface RadioScene {
  T: number;
  ph: number[];             // 5 个相位终点
  chip: string;
  sub: string;
  caps: [string, string][]; // 每相位：主句 + 副句（固定两行，气泡高度恒定）
  capTip: number[];         // 气泡尖角指向的 x（= 当前主体车）
  cars: CarSpec[];
}

/* ─── 场景一：有网组队对讲 ─────────────────────────────────────────── */
export const A_CFG = {
  cloud: [500, 104] as const,
  speaker: 1,              // 讲话的是第 2 台
  press: 5.4,              // 按下方向盘中键
  up: [7.8, 8.9] as const, // 讲话车 → 云端
  fan: [9.1, 10.3] as const, // 云端 → 其余三台
};

/* ─── 场景二：无网地形 · 硬件接力 + 云端桥接（用户指定版式）───────────
   右无网 / 左有网，中间竖直分界线 x=560；从右往左第 1→4 台。
   第 3 台紧贴分界线左侧（车头右缘距分界线仅 ~6px），第 4 台远在画面左侧。*/
export const B_CFG = {
  divider: 560,
  cloud: [330, 104] as const,
  talk: 3.5,
  a12: [3.8, 5.2] as const,   // 硬件对讲弧：第 1 台 → 第 2 台
  a23: [6.6, 8.2] as const,   // 硬件对讲弧：第 2 台 → 第 3 台（跨过分界线）
  up: [9.8, 11.3] as const,   // 云端链路：第 3 台 → 云
  down: [11.7, 13.2] as const, // 云端链路：云 → 第 4 台
  // 云端虚线上的「信号传输」标注锚点（沿曲线取点，避开徽标与车身）
  sigLabels: [
    {x: 430, y: 306},
    {x: 218, y: 308},
  ] as const,
  // 距离标注（双向箭头 + 两行文案）
  dims: [
    {x1: 700, x2: 890, y: 464, main: '≤ 5 km', sub: '对讲机组网范围', tone: 'hw' as const},
    {x1: 155, x2: 500, y: 464, main: '> 5 km', sub: '有网 · 不受对讲距离限制', tone: 'net' as const},
  ],
};

/* ─── 场景三：朋友的非蔚来车 · 递对讲机 + App 入队 ────────────────── */
export const C_CFG = {
  hand: [2.6, 4.6] as const, // 对讲机递出的飞行动画
  app: 5.6,                  // App 绑定卡出现
  join: 8.6,                 // 正式入队
  friend: 860,
};

/* ─── 场景四：混合车队的队形（1 台蔚来 + 3 台非蔚来）─────────────────
   全队只有 **一台** 手持对讲机，原本在蔚来车主手上。
   蔚来车主把它递给其中一台非蔚来车 —— 递出之后蔚来车主手上就没有对讲机了，
   他靠 **车机方向盘按键** 发话（车载对讲能力内置在车上，不占用那台手持机）。
   车序号：0=蔚来车主（递出后只剩方向盘按键）1=非蔚来·收到对讲机 2/3=非蔚来·仅 App
   错误队形：0,1,2,3 依次排（队尾 3 只有 App → 掉队失联）
   推荐队形：0 领队、1 押尾，2/3 夹在中间 → 头尾各有一端硬件通信能力。*/
export const D_CFG = {
  slot: [860, 660, 460, 260] as const, // 从右（队首）到左（队尾）
  wrong: [0, 1, 2, 3] as const,        // 车 i → 槽位
  good: [0, 3, 1, 2] as const,
  hand: [1.0, 2.8] as const,           // 对讲机从蔚来车主递给非蔚来车（唯一的一台）
  drift: [5.2, 7.0] as const,          // 队尾掉队
  lost: 6.8,                           // 失联标记
  back: [8.4, 9.1] as const,           // 归位
  swap: [8.8, 11.0] as const,          // 换队形
  link: 12.0,                          // 头尾链路建立
  talk: [13.4, 14.6] as const,         // 蔚来车主按方向盘按键发话
};

export const RADIO_SCENES: Record<RadioKey, RadioScene> = {
  a: {
    T: 13.0,
    ph: [2.0, 5.0, 7.6, 10.6, 13.0],
    chip: '场景一 · 组队对讲（有网）',
    sub: '共享定位 / 车辆信息 / 导航目的地，一键全队同收',
    capTip: [860, 565, 665, 665, 665],
    caps: [
      ['四台车结伴出行，已完成组队', '一个小队最多 50 台车'],
      ['小队实时共享三类信息', '定位 · 车辆信息 · 导航目的地'],
      ['按下方向盘中间按键，开始讲话', '不用摸手机，全程手不离方向盘'],
      ['再按一次发送，全队同时收到并播放', '有网时走云端，距离不受限制'],
      ['有网组队对讲 · 全员互联', '定位、路线、语音都在一个小队里'],
    ],
    cars: [
      {kind: 'nio', x: 860, label: '队首', radio: true, net: 'on'},
      {kind: 'nio', x: 665, label: '我', radio: true, net: 'on'},
      {kind: 'nio', x: 470, label: '队友', radio: true, net: 'on'},
      {kind: 'nio', x: 275, label: '队尾', radio: true, net: 'on'},
    ],
  },
  b: {
    T: 17.0,
    ph: [3.0, 6.2, 9.4, 13.6, 17.0],
    chip: '场景二 · 无网地形 · 硬件接力 + 云端桥接',
    sub: '右侧无网区靠对讲机硬件接力，有网车作桥接节点上云',
    capTip: [700, 890, 700, 500, 700],
    caps: [
      ['车队驶入信号复杂地形', '右侧无网区：第 1、2 台已经断网'],
      ['第 1 台按下中键讲话', '车载对讲机硬件直连，第 2 台先收到'],
      ['第 2 台接力，信号跨过分界线', '第 3 台在网络覆盖区，也收到了'],
      ['第 3 台作桥接节点，经云端转发', '第 4 台虽然远在 5 km 外，一样收到'],
      ['无网也不掉队 · 硬件接力 + 云端桥接', '基础通信 5–8 km，有网车负责上云'],
    ],
    cars: [
      {kind: 'nio', x: 890, label: '第 1 台', radio: true, net: 'off'},
      {kind: 'nio', x: 700, label: '第 2 台', radio: true, net: 'off'},
      {kind: 'nio', x: 500, bx: 440, label: '第 3 台 · 桥接节点', radio: false, net: 'on'},
      {kind: 'nio', x: 155, label: '第 4 台', radio: false, net: 'on'},
    ],
  },
  c: {
    T: 14.0,
    ph: [2.2, 5.2, 8.2, 11.2, 14.0],
    chip: '场景三 · 朋友的车 · App 入队',
    sub: '递出对讲机，非蔚来车绑定后也能进小队',
    capTip: [860, 750, 860, 860, 640],
    caps: [
      ['朋友的车不是蔚来', '车机里没有组队功能，联系不上'],
      ['把车上的对讲机递给朋友', '硬件是随车的，可以转交'],
      ['朋友下载蔚来 App，绑定新账号', '对讲机跟着账号走'],
      ['绑定即入队，有网络就能远距离对讲', '小队 4 / 50 台'],
      ['混合车队 · 全员互联', '不是蔚来车，也能跟着队伍走'],
    ],
    cars: [
      // 场景三里车队朝右，最前面那台是右侧的「朋友的车」（x=860），
      // 所以这台不是队首，标「队友」。别照抄场景一——那里 x=860 才是本队车。
      {kind: 'nio', x: 640, label: '队友', radio: true, net: 'on'},
      {kind: 'nio', x: 450, label: '队友', radio: true, net: 'on'},
      {kind: 'nio', x: 260, label: '队友', radio: true, net: 'on'},
      {kind: 'oth', x: 860, label: '朋友的车', radio: false, net: 'on'},
    ],
  },
  d: {
    T: 18.4,
    ph: [3.4, 8.0, 11.2, 15.0, 18.4],
    chip: '场景四 · 混合车队的队形',
    sub: '全队只有一台对讲机，蔚来车主递出后靠方向盘按键发话',
    capTip: [560, 260, 560, 560, 560],
    caps: [
      ['1 台蔚来 + 3 台非蔚来，全队只有一台对讲机', '蔚来车主把它递给其中一台朋友的车 —— 自己手上就没有了'],
      ['✕ 错误队形：队尾只有 App', '一进弱网就掉队，谁也叫不到它'],
      ['把拿到对讲机的那台换到队尾', '一端是车机、一端是对讲机，分守头尾'],
      ['蔚来车主按方向盘按键发话，队尾用对讲机收', '硬件基础通信 5–8 km，罩住中间两台'],
      ['✓ 推荐队形 · 头尾守着中间', '中间的车不会走丢，也不会失联'],
    ],
    cars: [
      {kind: 'nio', x: 860, label: '蔚来车主', radio: true, wheel: true, net: 'on'},
      {kind: 'oth', x: 660, label: '朋友的车', radio: false, net: 'on'},
      {kind: 'oth', x: 460, label: '仅 App', radio: false, net: 'on'},
      {kind: 'oth', x: 260, label: '仅 App', radio: false, net: 'on'},
    ],
  },
};

export const phaseOf = (s: RadioScene, t: number) => {
  for (let i = 0; i < s.ph.length; i++) if (t < s.ph[i]) return i;
  return 4;
};

/** 场景四：任意时刻的车 i 的 x（错误队形 → 掉队 → 归位 → 换到推荐队形） */
/**
 * 场景四换队形时的**横向让位**。
 *
 * 不加这个的话车会直接从对方身上穿过去：车 1 从 slot1(660) 退到 slot3(260)，
 * 车 2 从 slot2(460) 顶到 slot1(660)，两条轨迹在同一条线上对穿——
 * 全时间轴断言实测最小间距 **−101.6px**（t=9.66s），等于两台车几乎完全重叠。
 *
 * 做法：**往前超越的车**（good 槽位比 wrong 靠前）在换位期间拉出去 36，过完再并回；
 * 被超的那台同时避让 14。只让超车的一方避是不够的——两车半宽和就有 41.4，
 * 单侧 36 仍会判定相交（实测残留 −7.4px），而单侧拉到 50 又会开出路面。
 */
/** 换位时的横向让位量：超车的拉上去 36，被超的避下来 14，合计 50 > 两车半宽和 41.4 */
export const D_LANE_UP = -36;
export const D_LANE_DOWN = 14;

export function dCarY(i: number, t: number) {
  const dx = D_CFG.slot[D_CFG.good[i]] - D_CFG.slot[D_CFG.wrong[i]];
  if (dx === 0) return GEO.carY;
  const k = clamp01((t - D_CFG.swap[0]) / (D_CFG.swap[1] - D_CFG.swap[0]));
  // 出道 → 保持 → 并回（各占换位时长的 25%）
  const pull = k < 0.25 ? smooth(k / 0.25) : k > 0.75 ? smooth((1 - k) / 0.25) : 1;
  return GEO.carY + (dx > 0 ? D_LANE_UP : D_LANE_DOWN) * pull;
}

export function dCarX(i: number, t: number) {
  const k = smooth(clamp01((t - D_CFG.swap[0]) / (D_CFG.swap[1] - D_CFG.swap[0])));
  const base = lerp(D_CFG.slot[D_CFG.wrong[i]], D_CFG.slot[D_CFG.good[i]], k);
  if (i !== 3) return base;
  const out = clamp01((t - D_CFG.drift[0]) / (D_CFG.drift[1] - D_CFG.drift[0]));
  const back = clamp01((t - D_CFG.back[0]) / (D_CFG.back[1] - D_CFG.back[0]));
  return base - 108 * smooth(out) * (1 - smooth(back));
}

/** 各场景状态机（纯函数：组件与断言共用同一份逻辑） */
export function radioState(k: RadioKey, t: number) {
  const s = RADIO_SCENES[k];
  const ph = phaseOf(s, t);
  const w = (a: number, b: number) => clamp01((t - a) / (b - a));

  const bRecv: boolean[] = k === 'b'
    ? [true, t >= B_CFG.a12[1] + 0.15, t >= B_CFG.a23[1] + 0.15, t >= B_CFG.down[1] + 0.15]
    : [false, false, false, false];

  return {
    ph,
    done: ph === 4,
    // 场景一
    aPress: k === 'a' && t >= A_CFG.press && t < s.ph[3],
    aUp: k === 'a' ? w(A_CFG.up[0], A_CFG.up[1]) : 0,
    aFan: k === 'a' ? w(A_CFG.fan[0], A_CFG.fan[1]) : 0,
    aRecv: k === 'a' && t >= A_CFG.fan[1] - 0.2,
    // 场景二
    bTalk: k === 'b' && t >= B_CFG.talk && t < B_CFG.a12[1] + 0.6,
    b12: k === 'b' ? w(B_CFG.a12[0], B_CFG.a12[1]) : 0,
    b23: k === 'b' ? w(B_CFG.a23[0], B_CFG.a23[1]) : 0,
    bUp: k === 'b' ? w(B_CFG.up[0], B_CFG.up[1]) : 0,
    bDown: k === 'b' ? w(B_CFG.down[0], B_CFG.down[1]) : 0,
    bBridge: k === 'b' && t >= B_CFG.a23[1],
    bRecv,
    // 场景三
    cHand: k === 'c' ? w(C_CFG.hand[0], C_CFG.hand[1]) : 0,
    cApp: k === 'c' && t >= C_CFG.app,
    cJoined: k === 'c' && t >= C_CFG.join,
    // 场景四
    dHand: k === 'd' ? w(D_CFG.hand[0], D_CFG.hand[1]) : 0,
    dTalk: k === 'd' && t >= D_CFG.talk[0] && t < D_CFG.talk[1] + 0.5,
    dRecv: k === 'd' && t >= D_CFG.talk[1],
    dLost: k === 'd' && t >= D_CFG.lost && t < D_CFG.back[1],
    dSwap: k === 'd' ? smooth(w(D_CFG.swap[0], D_CFG.swap[1])) : 0,
    dLink: k === 'd' ? w(D_CFG.link, D_CFG.link + 1.2) : 0,
    dGood: k === 'd' && t >= D_CFG.swap[1] - 0.2,
  };
}
