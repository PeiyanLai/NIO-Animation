import React from 'react';
import {linearTiming, TransitionSeries} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {Stage} from './Stage';
import {TitleCard} from './TitleCard';

// 30fps：片头 75f + 场景 a 408f + b 408f + c 420f，三处 15f 淡入淡出
export const TerrainVideo: React.FC = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={75}>
        <TitleCard />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        timing={linearTiming({durationInFrames: 15})}
        presentation={fade()}
      />
      <TransitionSeries.Sequence durationInFrames={408}>
        <Stage scene="a" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        timing={linearTiming({durationInFrames: 15})}
        presentation={fade()}
      />
      <TransitionSeries.Sequence durationInFrames={408}>
        <Stage scene="b" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        timing={linearTiming({durationInFrames: 15})}
        presentation={fade()}
      />
      <TransitionSeries.Sequence durationInFrames={420}>
        <Stage scene="c" />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
