import React from 'react';
import {linearTiming, TransitionSeries} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {Stage} from './Stage';
import {FilmCard} from './FilmCard';

/**
 * 全地形模式 · 成片版（对内宣讲用）
 *
 * 节奏依据：官方 TVC 两支录屏实测（scripts/analyze-reference-video.py）
 *   平均镜头 2.5–3.3s、中位 2.25s、p10 0.75–1.0s、p90 4–5.5s、每分钟 18–24 切
 *
 * **没有照搬 2.25s 的中位切**——那是宣传片的节奏，讲解片照抄会变成看不懂。
 * 取法是：**连接组织按参考片的快节奏（片头/章节卡 1.3–2.8s），讲解段保持可读长度**。
 * 参考片的「片子感」来自结构与版式（章节卡、双语大字距标题、统一转场），
 * 不是来自把解释切碎。
 *
 * 结构：片头 → 三章（每章：章节卡 + 讲解段）→ 片尾，全部 12f 淡入淡出。
 */
// 注意：TransitionSeries 按 child.type 校验子元素，**不能把 Transition 包进自定义组件**，
// 否则会报「only accepts a list of TransitionSeries.Sequence / Transition」。用工厂函数返回元素即可。
const T = () => (
  <TransitionSeries.Transition
    timing={linearTiming({durationInFrames: 12})}
    presentation={fade()}
  />
);

const CH = [
  {kicker: 'CHAPTER 01', title: '自动识别', sub: '驶入雪地，系统主动提醒', en: 'AUTO DETECT'},
  {kicker: 'CHAPTER 02', title: '一键开启', sub: '方向盘按键，无需进设置', en: 'ONE PRESS'},
  {kicker: 'CHAPTER 03', title: '五种地形', sub: '泥地 · 沙地 · 雪地 · 湿地 · 碎石', en: 'FIVE TERRAINS'},
] as const;

/** 片头 78 + (章节卡 39 + 讲解段) ×3 + 片尾 84；7 处 12f 转场 */
export const TERRAIN_FILM_TOTAL = 78 + 39 + 408 + 39 + 408 + 39 + 420 + 84 - 7 * 12;

export const TerrainFilm: React.FC = () => (
  <TransitionSeries>
    <TransitionSeries.Sequence durationInFrames={78}>
      <FilmCard kicker="VEHICLE FEATURE · 内部宣讲" title="全地形模式"
        sub="泥地 · 沙地 · 雪地 · 湿地 · 碎石" en="ALL TERRAIN MODE" tone="brand" />
    </TransitionSeries.Sequence>
    {T()}

    <TransitionSeries.Sequence durationInFrames={39}><FilmCard {...CH[0]} /></TransitionSeries.Sequence>
    {T()}
    <TransitionSeries.Sequence durationInFrames={408}><Stage scene="a" /></TransitionSeries.Sequence>
    {T()}

    <TransitionSeries.Sequence durationInFrames={39}><FilmCard {...CH[1]} /></TransitionSeries.Sequence>
    {T()}
    <TransitionSeries.Sequence durationInFrames={408}><Stage scene="b" /></TransitionSeries.Sequence>
    {T()}

    <TransitionSeries.Sequence durationInFrames={39}><FilmCard {...CH[2]} /></TransitionSeries.Sequence>
    {T()}
    <TransitionSeries.Sequence durationInFrames={420}><Stage scene="c" /></TransitionSeries.Sequence>
    {T()}

    <TransitionSeries.Sequence durationInFrames={84}>
      <FilmCard kicker="内部资料 · 请勿外传" title="驶入即识别，一键即进入"
        sub="全程无需进设置菜单" en="ALL TERRAIN MODE" tone="brand" />
    </TransitionSeries.Sequence>
  </TransitionSeries>
);
