// 宠物模式动画 · 常量与场景配置
// scope: vehicle-ecosystem（外设联动）· 分镜模板「外设自动化」：绑定 → 识别 → 自动执行 → 退出与结果
// 舞台 = ES8 前排正侧实拍（es8-cabin-photo.ES8_CABIN_SIDE_URI，透视照片，只作环境
// 背景，不承担几何主张）+ 真实边牧照片剪纸（PetsPhoto.PhotoDog）。
// 状态卡/进度块/守护环/气流均为概念 UI 叠加层，锚点按下方实测标定对到照片。

export {T_COLORS, F_UI, F_DATA, clamp01, win, easeOutBack, frac} from './data';

/* ── 实拍舞台标定（舞台 viewBox 1000×560）────────────────────────────────
   取景（用户指定，把左下角轮毂排除在画面外）：
     <image x=-160 y=-40 width=1187.1 height=667.9>，照片 1672×941（车头朝左）
   照片px → 舞台：stage = photo_px × s + (−160, −40)，s = 1187.1/1672 = 0.7100
   （长宽同系数，1187.1/667.9 = 1672/941，无拉伸）
   以下数字均来自网格探针合成图逐格实测（scratchpad/pet-agent/probe-grid.png、
   probe-cushion2.png、狗摆位 probe-dog-a.png），非估算：
     · 近侧（主驾）座椅坐垫上表面：y≈385(靠背侧)–450(前缘)，x≈395–625
     · 坐垫高度处靠背前缘 x≈620；头枕 x≈712–781 · y≈81–200（信息卡禁入区）
     · 方向盘 x≈312–400 · y≈175–300；中控屏 x≈200–281 · y≈206–325
     · 开启的主驾门内饰板 x≈125–206 · y≈229–397；后门车窗暗区 x≈810–1000 · y≈150–260 */
export const PET_FRAME = {x: -160, y: -40, w: 1187.1, h: 667.9} as const;

export const PET_GEO = {
  /** 狗原点 = 掌距中点×地线（PhotoDog 契约），落在坐垫上表面中前段；
      h=108 由 probe-dog-a(h105)/probe-dog-b(h125) 两档对比目测定：
      105–108 全身落在坐垫段(395–625)内、臀部恰好贴到靠背前缘(620)，125 偏大压靠背 */
  dog: {x: 545, y: 442, h: 108},
  /** 狗照片内胸/颈锚点（照片px，头朝右原图）——定位硬件徽标挂点 */
  chestImg: {x: 395, y: 175},
  /** 中控屏（车机通知的实车锚点）：状态卡指向这里 */
  screen: {cx: 240, top: 206},
  /** 状态卡：悬于仪表台上方暗区，右缘 316 ≤ 方向盘左缘 312+ε，不压狗与主驾座椅 */
  card: {x: 36, y: 98, w: 280, h: 92},
  /** 车主离车表达（门侧箭头+文案）与落锁徽标：开启的主驾门区域 */
  door: {arrowX: 306, arrowY: 358, lockX: 156, lockY: 250},   // lockX 右缘 182 < 中控屏左缘 200
  /** 第 1 章硬件特写：后门车窗暗区，避开头枕(712–781) */
  showcase: {x: 895, y: 168},
  done: {x: 850, y: 110},
} as const;

export type PetKey = 'a' | 'b' | 'c' | 'd';

export interface PetScene {
  T: number;
  ph: number[];          // 各相位起点
  caps: string[];
  chip: string;
  sub: string;
  tempFrom: number;      // HUD 温度起
  tempTo: number;
  hudRight: (t: number) => string;
}

const TEMP = 26.0;       // 宠物模式恒温设定（概念值，文档未给具体数字 → 以「稳定舒适」表达）

export const PET_SCENES: Record<PetKey, PetScene> = {
  a: {
    T: 9.6,
    ph: [1.4, 3.4, 5.8, 8.0, 9.6],
    chip: '第 1 章 · 购买硬件与配对',
    sub: '商城购买定位硬件，佩戴后与车机连接',
    tempFrom: TEMP, tempTo: TEMP,
    caps: [
      '在商城购买宠物定位硬件',
      '给宠物佩戴定位硬件',
      '车机搜索并连接硬件…',
      '连接成功 —— 车机已绑定定位硬件',
      '完成配对，车机可感知宠物',
    ],
    hudRight: () => '设备 · 定位硬件',
  },
  b: {
    T: 9.0,
    ph: [1.4, 3.2, 5.4, 7.4, 9.0],
    chip: '第 2 章 · 自动检测宠物在车内',
    sub: '连接后车机持续感知宠物位置',
    tempFrom: TEMP, tempTo: TEMP,
    caps: [
      '宠物在前排座椅上',   // 实拍舞台里狗在近侧前排坐垫（原「二排」随舞台更换而改）
      '车机通过定位硬件持续感知',
      '识别到信号来自车内',
      '「检测到宠物在车内」',
      '车内有宠物 —— 状态已确认',
    ],
    hudRight: () => '感知 · 宠物在车内',
  },
  c: {
    T: 11.4,
    ph: [1.4, 3.4, 5.6, 8.6, 11.4],
    chip: '第 3 章 · 离车锁车 · 自动恒温',
    sub: '锁车后自动开启宠物模式，保持稳定舒适温度',
    tempFrom: 29.5, tempTo: TEMP,
    caps: [
      '车主准备离车',
      '车主离车 · 车辆落锁',
      '检测到宠物仍在车内 —— 自动开启宠物模式',
      `空调自动调节，车内保持稳定舒适温度 ${TEMP.toFixed(1)}°C`,
      '宠物模式守护中 · 全程无需手动设置',
    ],
    hudRight: () => '模式 · 宠物模式',
  },
  d: {
    T: 10.6,
    ph: [1.4, 3.2, 5.4, 8.4, 10.6],
    chip: '第 4 章 · 宠物离车 · 自动除味净化',
    sub: '宠物离车并锁车后，自动完成一轮空气净化',
    tempFrom: TEMP, tempTo: TEMP,
    caps: [
      '车主带宠物离车',
      '宠物已离车 · 车辆再次落锁',
      '空调自动进入宠物除味处理',
      '完成一轮车内空气净化',
      '除味净化完成 · 车内空气清新',
    ],
    hudRight: () => '空调 · 除味净化',
  },
};

export const phaseOfPet = (s: PetScene, t: number) => {
  for (let i = 0; i < s.ph.length; i++) if (t < s.ph[i]) return i;
  return 4;
};

/** 各章状态机（纯函数，组件与断言共用，避免逻辑漂移） */
export function petState(scene: PetKey, t: number) {
  const s = PET_SCENES[scene];
  const ph = phaseOfPet(s, t);
  const w = (a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)));
  return {
    ph,
    paired: scene === 'a' ? t >= s.ph[2] : true,
    detected: scene === 'b' ? t >= s.ph[2] : scene !== 'a',
    locked: scene === 'c' ? t >= s.ph[1] : scene === 'd',
    petMode: scene === 'c' ? t >= s.ph[2] : false,
    petGone: scene === 'd' && t >= s.ph[1],
    purify: scene === 'd' && t >= s.ph[2],
    temp: s.tempFrom + (s.tempTo - s.tempFrom) * w(s.ph[2], s.ph[3]),
  };
}
