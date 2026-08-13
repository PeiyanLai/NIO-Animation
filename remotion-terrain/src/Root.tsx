import React from 'react';
import {Composition} from 'remotion';
import {Stage} from './Stage';
import {TerrainVideo} from './TerrainVideo';
import {TitleCard} from './TitleCard';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TerrainMode"
        component={TerrainVideo}
        durationInFrames={75 + 408 + 408 + 420 - 3 * 15}
        width={1920}
        height={1080}
        fps={30}
        defaultProps={{}}
      />
      <Composition id="Title" component={TitleCard} durationInFrames={75} width={1920} height={1080} fps={30} defaultProps={{}} />
      <Composition id="SceneA" component={Stage} durationInFrames={408} width={1920} height={1080} fps={30} defaultProps={{scene: 'a' as const}} />
      <Composition id="SceneB" component={Stage} durationInFrames={408} width={1920} height={1080} fps={30} defaultProps={{scene: 'b' as const}} />
      <Composition id="SceneC" component={Stage} durationInFrames={420} width={1920} height={1080} fps={30} defaultProps={{scene: 'c' as const}} />
    </>
  );
};
