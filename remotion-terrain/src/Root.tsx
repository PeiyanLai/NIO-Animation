import React from 'react';
import {Composition} from 'remotion';
import {Stage} from './Stage';
import {TerrainVideo} from './TerrainVideo';
import {TerrainFilm, TERRAIN_FILM_TOTAL} from './TerrainFilm';
import {TitleCard} from './TitleCard';
import {ParkingStage} from './ParkingStage';
import {PK_SCENES, buildPark} from './parking-data';
import {ParkingVideo, PARKING_TOTAL} from './ParkingVideo';
import {PetStage} from './PetStage';
import {PET_SCENES} from './pet-data';
import {RampStage} from './RampStage';
import {RAMP_SCENES} from './ramp-data';
import {BagStage} from './BagStage';
import {BAG_SCENES} from './bag-data';

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
      <Composition
        id="TerrainFilm"
        component={TerrainFilm}
        durationInFrames={TERRAIN_FILM_TOTAL}
        width={1920}
        height={1080}
        fps={30}
        defaultProps={{}}
      />
      <Composition id="Title" component={TitleCard} durationInFrames={75} width={1920} height={1080} fps={30} defaultProps={{}} />
      <Composition id="SceneA" component={Stage} durationInFrames={408} width={1920} height={1080} fps={30} defaultProps={{scene: 'a' as const}} />
      <Composition id="SceneB" component={Stage} durationInFrames={408} width={1920} height={1080} fps={30} defaultProps={{scene: 'b' as const}} />
      <Composition id="PetA" component={PetStage} durationInFrames={Math.round(PET_SCENES.a.T * 30)} width={1920} height={1080} fps={30} defaultProps={{scene: 'a' as const}} />
      <Composition id="PetB" component={PetStage} durationInFrames={Math.round(PET_SCENES.b.T * 30)} width={1920} height={1080} fps={30} defaultProps={{scene: 'b' as const}} />
      <Composition id="PetC" component={PetStage} durationInFrames={Math.round(PET_SCENES.c.T * 30)} width={1920} height={1080} fps={30} defaultProps={{scene: 'c' as const}} />
      <Composition id="PetD" component={PetStage} durationInFrames={Math.round(PET_SCENES.d.T * 30)} width={1920} height={1080} fps={30} defaultProps={{scene: 'd' as const}} />
      <Composition id="ParkingVideo" component={ParkingVideo} durationInFrames={PARKING_TOTAL} width={1920} height={1080} fps={30} defaultProps={{}} />
      <Composition id="ParkA" component={ParkingStage} durationInFrames={Math.round(buildPark(PK_SCENES.a).T * 30)} width={1920} height={1080} fps={30} defaultProps={{scene: 'a' as const}} />
      <Composition id="ParkB" component={ParkingStage} durationInFrames={Math.round(buildPark(PK_SCENES.b).T * 30)} width={1920} height={1080} fps={30} defaultProps={{scene: 'b' as const}} />
      <Composition id="SceneC" component={Stage} durationInFrames={420} width={1920} height={1080} fps={30} defaultProps={{scene: 'c' as const}} />
      <Composition id="RampA" component={RampStage} durationInFrames={Math.round(RAMP_SCENES.c1.T * 30)} width={1920} height={1080} fps={30} defaultProps={{scene: 'c1' as const}} />
      <Composition id="RampB" component={RampStage} durationInFrames={Math.round(RAMP_SCENES.c2.T * 30)} width={1920} height={1080} fps={30} defaultProps={{scene: 'c2' as const}} />
      <Composition id="RampC" component={RampStage} durationInFrames={Math.round(RAMP_SCENES.c3.T * 30)} width={1920} height={1080} fps={30} defaultProps={{scene: 'c3' as const}} />
      <Composition id="RampD" component={RampStage} durationInFrames={Math.round(RAMP_SCENES.c4.T * 30)} width={1920} height={1080} fps={30} defaultProps={{scene: 'c4' as const}} />
      <Composition id="BagA" component={BagStage} durationInFrames={Math.round(BAG_SCENES.c1.T * 30)} width={1920} height={1080} fps={30} defaultProps={{scene: 'c1' as const}} />
      <Composition id="BagB" component={BagStage} durationInFrames={Math.round(BAG_SCENES.c2.T * 30)} width={1920} height={1080} fps={30} defaultProps={{scene: 'c2' as const}} />
      <Composition id="BagC" component={BagStage} durationInFrames={Math.round(BAG_SCENES.c3.T * 30)} width={1920} height={1080} fps={30} defaultProps={{scene: 'c3' as const}} />
      <Composition id="BagD" component={BagStage} durationInFrames={Math.round(BAG_SCENES.c4.T * 30)} width={1920} height={1080} fps={30} defaultProps={{scene: 'c4' as const}} />
    </>
  );
};
