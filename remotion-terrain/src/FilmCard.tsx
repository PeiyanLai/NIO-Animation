import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {F_DATA, F_UI, T_COLORS as C} from './data';

/**
 * 成片用的标题 / 章节卡。
 *
 * 版式取自官方 TVC 的文字处理（中文大标题 + 大字距的英文副标题 + 一条主色分割线），
 * 但**底色仍走 NIO 浅色规范**——参考片是夜景暗调片（实测 YAVG 24、偏暗帧占比 100%），
 * 而这套功能讲解片的底色规范是浅青调。借的是版式与节奏，不是调色。
 */
export const FilmCard: React.FC<{
  kicker?: string;      // 顶部小字（章节号 / 片种）
  title: string;
  sub?: string;
  en?: string;          // 大字距英文副标题
  tone?: 'brand' | 'plain';
}> = ({kicker, title, sub, en, tone = 'plain'}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();

  const enter = spring({fps, frame, config: {damping: 200}});
  const lineK = spring({fps, frame: frame - 6, config: {damping: 200}});
  const subK = spring({fps, frame: frame - 12, config: {damping: 200}});
  // 出场前整体轻微上浮，接上下一段
  const out = interpolate(frame, [durationInFrames - 10, durationInFrames], [0, -14], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{
      background: tone === 'brand' ? C.stageBg : C.ground,
      alignItems: 'center', justifyContent: 'center', fontFamily: F_UI,
    }}>
      <div style={{transform: `translateY(${out}px)`, textAlign: 'center'}}>
        {kicker && (
          <div style={{
            fontFamily: F_DATA, fontSize: 20, letterSpacing: '0.42em', color: C.ink4,
            opacity: enter, marginBottom: 26, paddingLeft: '0.42em',
          }}>{kicker}</div>
        )}
        <div style={{
          fontSize: title.length > 8 ? 74 : 92, fontWeight: 700, color: C.ink,
          letterSpacing: '0.02em', lineHeight: 1.12,
          opacity: enter, transform: `translateY(${(1 - enter) * 34}px)`,
        }}>{title}</div>
        <div style={{
          width: 520 * lineK, height: 3, background: C.accent, borderRadius: 2,
          margin: '30px auto',
        }} />
        {sub && (
          <div style={{
            fontSize: 30, color: C.ink2, letterSpacing: '0.16em',
            opacity: subK, transform: `translateY(${(1 - subK) * 20}px)`,
          }}>{sub}</div>
        )}
        {en && (
          <div style={{
            fontFamily: F_DATA, fontSize: 17, letterSpacing: '0.34em', color: C.ink4,
            marginTop: 20, opacity: subK, paddingLeft: '0.34em',
          }}>{en}</div>
        )}
      </div>
    </AbsoluteFill>
  );
};
