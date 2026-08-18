import React from 'react';
import {ES9_RIM_FRONT, ES9_RIM_PHOTO_R, ES9_RIM_REAR} from './side-rim';
import {ES9_SIDE} from './side';

/**
 * ES9 正侧视 —— **开箱即用，这就是「调用 ES9 侧视」的标准入口。**
 *
 * ```tsx
 * <svg viewBox="0 0 1000 560">
 *   <defs><ES9SideDefs /></defs>
 *   …地形/背景…
 *   <ES9SideView deg={sideWheelDeg(dx)} bob={bob} />
 *   …前景道具/信息卡…
 * </svg>
 * ```
 *
 * 舞台坐标系固定为 **1000 × 560**（对应 CSS 1920 × 1075）。换舞台尺寸时**整组套一层
 * scale**，不要去改组件里的数字——那些数是和 `side.ts` 的标定绑死的。
 *
 * ## 图层顺序不能改
 *
 * 软投影 → 车身照片（抠形+镜像+bob）→ 旋转轮辋 → 静态高光。
 *
 * - **车身必须在轮辋之前画**：轮辋是叠上去的，画反了轮辐会被车身盖住
 * - **静态高光必须在旋转组之外**：照片轮辋自带的高光会跟着转，不压住的话
 *   高速滚动有频闪感。光源固定在左上，与车身照片一致
 * - **软投影不能省**：浅色底上不给接地投影，车会像浮在空中
 *
 * ## 已经内置、不要再自己加的东西
 *
 * - **不要挖轮拱洞**。遮罩里已经含轮胎，挖洞会露出背景。
 * - **不要画「轮腔」暗底圆**。那是挖洞时代的补丁，现在会在胎下露出一道暗弧。
 * - **不要另画矢量轮**。矢量版（`Wheel.tsx`）只在拿不到可用照片时兜底。
 */

const {place: P, src: SRC, wheelStage: W, softShadow: SH} = ES9_SIDE;
const RIM_D = ES9_RIM_PHOTO_R * 2 * P.scale;   // 轮辋圆盘在舞台上的直径
const RIMS = [ES9_RIM_FRONT, ES9_RIM_REAR] as const;

/** 必须放进同一个 `<svg>` 的 `<defs>`：车身遮罩 + 轮辋穹面高光 */
export const ES9SideDefs: React.FC<{idPrefix?: string}> = ({idPrefix = 'es9'}) => (
  <>
    <mask id={`${idPrefix}-body`}>
      <path d={ES9_SIDE.body} fill="#fff" />
    </mask>
    <radialGradient id={`${idPrefix}-rimDome`} cx="36%" cy="28%" r="80%">
      <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.42" />
      <stop offset="46%" stopColor="#FFFFFF" stopOpacity="0.04" />
      <stop offset="100%" stopColor="#2E3D3D" stopOpacity="0.26" />
    </radialGradient>
  </>
);

export const ES9SideView: React.FC<{
  /** 车轮转角（度）。用 `sideWheelDeg(累计位移)` 算，别自己编角速度 */
  deg?: number;
  /** 车身微浮动（舞台 px）。轮辋会跟着一起动，不用另外传 */
  bob?: number;
  /** 整车不透明度（淡入淡出用） */
  opacity?: number;
  /** 同一个 SVG 里放多台车时必须给不同前缀，否则 defs 的 id 会撞 */
  idPrefix?: string;
  /** 关掉接地软投影（车悬空、抬升等特殊场景才用） */
  noShadow?: boolean;
}> = ({deg = 0, bob = 0, opacity = 1, idPrefix = 'es9', noShadow = false}) => {
  const cy = (P.y + bob).toFixed(2);
  const wy = (W[0].cy + bob).toFixed(2);
  return (
    <g opacity={opacity}>
      {!noShadow && <ellipse {...SH} />}

      {/* 车身照片：抠形 + 镜像（车头由左翻到右）+ 微浮动 */}
      <g transform={`translate(${P.x} ${cy})`}>
        <g transform={`scale(${P.scale})`}>
          <g transform={`translate(${P.mirrorWidth} 0) scale(-1 1)`}>
            <image href={ES9_SIDE.photo} width={SRC.w} height={SRC.h}
              mask={`url(#${idPrefix}-body)`} />
          </g>
        </g>
      </g>

      {/* 旋转轮辋：内层 scale(-1 1) 与车身同向镜像，外层 rotate 才是真实滚动方向 */}
      {W.map((w, i) => (
        <g key={w.id}
          transform={`translate(${w.cx} ${wy}) rotate(${deg.toFixed(1)}) scale(-1 1)`}>
          <image href={RIMS[i]} x={-RIM_D / 2} y={-RIM_D / 2} width={RIM_D} height={RIM_D} />
        </g>
      ))}

      {/* 静态穹面高光（不随轮子转） */}
      {W.map((w) => (
        <circle key={w.id} cx={w.cx} cy={W[0].cy + bob} r={RIM_D / 2}
          fill={`url(#${idPrefix}-rimDome)`} opacity={0.5} />
      ))}
    </g>
  );
};
