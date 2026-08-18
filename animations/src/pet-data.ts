// 宠物模式动画 · 常量与场景配置
// scope: vehicle-ecosystem（外设联动）· 分镜模板「外设自动化」：绑定 → 识别 → 自动执行 → 退出与结果
// 座舱为比例化概念平面图（proportional-concept），非实拍——官方座舱图带水印与营销叠字，按素材准入规则不可用

export {T_COLORS, F_UI, F_DATA, clamp01, win, easeOutBack, frac} from './data';

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
      '宠物在二排座椅上',
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
