// 照片宠物(剪纸式动效)
//
// 用户要求「用真实照片替换画的狗猫」。照片是单一姿态的抠图,不能真的迈腿,
// 动效走**剪纸偶**路线:整体平移/摇摆/压缩来表达走路、蹲伏、抬头、卧下。
// 位姿参数全部由数据层纯函数给出(bag-data.catPhotoXf / 本文件 dogPhotoXf),
// 组件只负责把数字变成 transform,禁止 Math.random。
//
// 标定见 pets-photo.ts 文件头。两条硬约定:
//   猫:镜像成头朝 +x,前掌落在矢量猫 fPaw(+0.4·sit)——栓扣/绳长几何不用重标;
//   狗:原点 = 前后掌距中点 × 地线,鬐甲高 = DOG.witherPx——坡道限位(U_PAD)不用重标。

import React from 'react';
import {CAT_PHOTO, CAT_URI, DOG_PHOTO, DOG_URI} from './pets-photo';

const N = (v: number) => (Math.round(v * 100) / 100).toString();

export type PetXf = {dy: number; rot: number; sx: number; sy: number};

/** 猫(头朝 +x,原点 = 坐骨着地点):照片天然头朝左,这里镜像 */
export const PhotoCat: React.FC<{
  x0: number; gy: number; sit: number; xf: PetXf; op: number;
  /** 胸背带 + 扣环(拴扣拴在这上面),跟着猫的位姿一起动 */
  harness?: boolean;
}> = ({x0, gy, sit, xf, op, harness = true}) => {
  if (op <= 0.01) return null;
  const k = sit / CAT_PHOTO.h;
  const w = CAT_PHOTO.w * k;
  // 镜像后前掌到图左缘 = (w − pawX·k),对齐到 +0.4·sit
  const left = 0.4 * sit - (CAT_PHOTO.w - CAT_PHOTO.pawX) * k;
  return (
    <g opacity={op} transform={`translate(${N(x0)} ${N(gy)})`}>
      <g transform={`translate(0 ${N(xf.dy)}) rotate(${N(xf.rot)}) scale(${N(xf.sx)} ${N(xf.sy)})`}>
        <g transform="scale(-1 1)">
          <image href={CAT_URI} x={N(-(left + w))} y={N(-sit)} width={N(w)} height={N(sit)} />
        </g>
        {harness && (
          <g>
            {/* 胸背带:一条绕胸的带子 + 背扣环,几何按坐姿照片手对(0.3545,-0.66)·sit */}
            <path
              d={`M${N(0.19 * sit)} ${N(-0.795 * sit)} Q${N(0.42 * sit)} ${N(-0.66 * sit)} ${N(0.285 * sit)} ${N(-0.44 * sit)}`}
              fill="none" stroke="#3E5252" strokeWidth={0.032 * sit} strokeLinecap="round"
              opacity={0.88} />
            <circle cx={N(0.3545 * sit)} cy={N(-0.66 * sit)} r={0.026 * sit}
              fill="#F5F2EA" stroke="#3E5252" strokeWidth={0.014 * sit} />
          </g>
        )}
      </g>
    </g>
  );
};

// ── 狗:剪纸偶位姿(纯函数,RampStage 直接调)────────────────────────────
export type DogPhotoPose = 'stand' | 'walk' | 'sit' | 'lie' | 'crouch' | 'lookup';

export const dogPhotoXf = (pose: DogPhotoPose, t: number, senior: boolean): PetXf & {pivotX: number} => {
  const breath = 0.006 * Math.sin((2 * Math.PI * t) / 1.9);
  if (pose === 'walk') {
    const T = senior ? 0.86 : 0.62;
    return {
      dy: -(senior ? 0.8 : 1.3) * Math.abs(Math.sin((2 * Math.PI * t) / T)),
      rot: (senior ? 1.5 : 2.2) * Math.sin((2 * Math.PI * t) / T),
      sx: 1, sy: 1, pivotX: 0,
    };
  }
  if (pose === 'crouch') return {dy: 0, rot: 0, sx: 1.05, sy: 0.78 + breath, pivotX: 0};
  if (pose === 'lookup') return {dy: 0, rot: -8, sx: 1, sy: 1 + breath, pivotX: -0.42};
  if (pose === 'sit') return {dy: 0, rot: -7, sx: 1, sy: 0.9 + breath, pivotX: -0.42};
  if (pose === 'lie') return {dy: 0, rot: 0, sx: 1.1, sy: 0.6, pivotX: 0};
  return {dy: 0, rot: 0, sx: 1, sy: 1 + breath, pivotX: 0};   // stand
};

/** 狗(头朝 +x,原点 = 掌距中点 × 地线;senior 由外部 filter 压饱和度表现老年犬) */
export const PhotoDog: React.FC<{
  t: number; pose: DogPhotoPose; h: number; senior?: boolean; op: number;
  seniorFilter?: string;
}> = ({t, pose, h, senior = false, op, seniorFilter}) => {
  if (op <= 0.01) return null;
  const k = h / (DOG_PHOTO.groundY - DOG_PHOTO.witherY);     // 鬐甲高 ↔ h
  const w = DOG_PHOTO.w * k;
  const x0i = -DOG_PHOTO.pawMidX * k;
  const y0i = -DOG_PHOTO.groundY * k;                        // 地线(≠图底)对齐 y=0
  const xf = dogPhotoXf(pose, t, senior);
  const px = xf.pivotX * h;                                   // 后掌枢轴(抬头/坐下用)
  return (
    <g opacity={op} filter={senior && seniorFilter ? `url(#${seniorFilter})` : undefined}>
      <g transform={`translate(0 ${N(xf.dy)}) rotate(${N(xf.rot)} ${N(px)} 0) translate(${N(px)} 0) scale(${N(xf.sx)} ${N(xf.sy)}) translate(${N(-px)} 0)`}>
        <image href={DOG_URI} x={N(x0i)} y={N(y0i)} width={N(w)} height={N(DOG_PHOTO.h * k)} />
      </g>
    </g>
  );
};
