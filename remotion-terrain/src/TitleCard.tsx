import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {F_DATA, F_UI, T_COLORS as C} from './data';

export const TitleCard: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const enter = spring({fps, frame, config: {damping: 200}});
  const lineW = spring({fps, frame: frame - 8, config: {damping: 200}});
  const sub = spring({fps, frame: frame - 14, config: {damping: 200}});

  return (
    <AbsoluteFill
      style={{
        background: C.stageBg,
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: F_UI,
      }}
    >
      <div
        style={{
          fontFamily: F_DATA,
          fontSize: 22,
          letterSpacing: '0.35em',
          color: C.ink3,
          opacity: enter,
          marginBottom: 26,
        }}
      >
        VEHICLE HMI · 用户教育动画
      </div>
      <div
        style={{
          fontSize: 92,
          fontWeight: 700,
          color: C.ink,
          letterSpacing: '0.02em',
          opacity: enter,
          transform: `translateY(${(1 - enter) * 40}px)`,
        }}
      >
        全地形模式
      </div>
      <div
        style={{
          width: 560 * lineW,
          height: 3,
          background: C.accent,
          borderRadius: 2,
          margin: '34px 0',
        }}
      />
      <div
        style={{
          fontSize: 30,
          color: C.ink2,
          letterSpacing: '0.18em',
          opacity: sub,
          transform: `translateY(${(1 - sub) * 24}px)`,
        }}
      >
        泥地 · 沙地 · 雪地 · 湿地 · 碎石
      </div>
    </AbsoluteFill>
  );
};
