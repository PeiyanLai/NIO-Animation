import React from 'react';
import {linearTiming, TransitionSeries} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {ParkingStage} from './ParkingStage';
import {TitleCard} from './TitleCard';
import {PK_SCENES, buildPark} from './parking-data';

const fa = Math.round(buildPark(PK_SCENES.a).T * 30);
const fb = Math.round(buildPark(PK_SCENES.b).T * 30);

export const ParkingVideo: React.FC = () => (
  <TransitionSeries>
    <TransitionSeries.Sequence durationInFrames={75}>
      <TitleCard title="平移泊入" sub="前轮 40° · 后轮同向 8° · 车身保持摆正" />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition timing={linearTiming({durationInFrames: 15})} presentation={fade()} />
    <TransitionSeries.Sequence durationInFrames={fa}>
      <ParkingStage scene="a" />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition timing={linearTiming({durationInFrames: 15})} presentation={fade()} />
    <TransitionSeries.Sequence durationInFrames={fb}>
      <ParkingStage scene="b" />
    </TransitionSeries.Sequence>
  </TransitionSeries>
);

export const PARKING_TOTAL = 75 + fa + fb - 2 * 15;
