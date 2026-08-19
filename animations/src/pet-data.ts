// 宠物模式动画 · 常量与场景配置
// scope: vehicle-ecosystem（外设联动）· 分镜模板「外设自动化」：绑定 → 识别 → 自动执行 → 退出与结果
// 舞台 = ES8 前两排俯视实拍（es8-front2rows-photo.ES8_FRONT2ROWS_URI：顶部仪表台+
// 中控屏，中部两前排座椅+岛台，底部二排长椅——宠物在二排，只有这张拍得到二排）
// + 正面坐姿橘猫照片剪纸（pets-photo.CAT_FRONT_URI，俯前视机位下椅面朝镜头，
// 正面朝向贴合视角）。状态卡/进度块/守护环/气流均为概念 UI 叠加层，
// 锚点按下方实测标定对到照片。

export {T_COLORS, F_UI, F_DATA, clamp01, win, easeOutBack, frac} from './data';

/* ── 实拍舞台标定（舞台 viewBox 1000×560）────────────────────────────────
   竖图放横舞台：等高 fit —— s = 560/1310 = 0.42748，贴图宽 1201×0.42748 = 513.40，
   水平居中 x = (1000−513.40)/2 = 243.30。photo px → stage：
     x' = 243.30 + px×0.42748，y' = py×0.42748
   左右竖带（x 0…243 / 757…1000）放步骤块/状态卡/HUD/硬件特写，不压照片。
   照片内实测（网格探针 scratchpad/pet-agent/v2/probe-grid.png、probe-bench.png，
   photo px，非估算）：
     · 中控屏 x 462–695 · y 5–170 → stage x 440.8–540.4 · y 2.1–72.7
     · 方向盘 x 150–420 · y 20–280；岛台 x 500–680 · y 170–790（尾端 y≈790）
     · 前排座椅 左 x 145–495 / 右 x 680–1010 · y 365–760
     · 二排长椅 y 860–1310（图底裁断）；椅缝/ISOFIX x≈440 与 x≈710；
       右侧座位 x 720–1010（中线 x≈865）；靠背/坐垫交界线 y≈1180
     · 左门内饰条 x 0–140 → stage 243.3–303.2；右门内饰条 x 1060–1201 → stage 696.5–756.7 */
export const PET_FRAME = {x: 243.3, y: 0, w: 513.4, h: 560} as const;

export const PET_GEO = {
  /** 猫原点 = 底边中心（CAT_FRONT 契约，地线=图底），落在二排右侧座位坐垫上：
      x = 243.3 + 879×0.42748 = 619.1（右座 photo x 720–1010 视觉中线偏缝右 ≈879，
      865 首渲偏左贴 ISOFIX，右移 6px 后居中，见 c-210.png → c-210b.png 对比）；
      y = 1243×0.42748 = 531.4（坐垫可见段 photo y 1180–1310 中段，掌落椅面不悬空；
      首版 536.5 掌尖顶在坐垫前缘凸包上，上移 5px 收进椅面）；
      h=160：猫宽 360/712×160 = 80.9 ≈ 右座宽 (1010−720)×0.42748=124 的 65%，
      与座位宽协调（150 偏小空、170 顶到长椅上缘 369.8） */
  cat: {x: 619.1, y: 531.4, h: 160},
  /** 猫照片内胸口锚点（photo px，360×712，probe-cat.png 实测）——定位硬件徽标挂点 */
  chestImg: {x: 165, y: 290},
  /** 检测/守护环圆心相对猫底边中心的抬升：可见体量中心 ≈ 0.47×h 处 */
  bodyDy: -75,
  /** 中控屏（车机通知的实车锚点，photo x 462–695 · y 5–170 换算） */
  screen: {cx: 490.6, top: 2.1, bottom: 72.7},
  /** 状态卡：右竖带上段（x 762–992 ⊂ 757–1000 带内，不压照片），引导线指向猫 */
  card: {x: 762, y: 118, w: 230, h: 92},
  /** 车主离车箭头（左门区，photo 前门段 y≈374→stage 160）与落锁徽标（右门区暗条） */
  door: {arrowX: 302, arrowY: 160, lockX: 727, lockY: 210},
  /** 恒温气流源：岛台尾端出风口位（photo (590,775) → stage (495.5,331)） */
  vent: {x: 495.5, y: 331},
  /** 第 1 章硬件特写：右竖带中段（脉冲环最大 r54，823 > 757 不压照片） */
  showcase: {x: 877, y: 330},
  /** 完成勾：右竖带 HUD 药丸（y≤36.5）与状态卡（y≥118）之间 */
  done: {x: 960, y: 88},
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
      '宠物在二排座椅上',   // 俯视实拍舞台里猫在二排长椅右侧座位（用户纠偏：宠物在二排）
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
