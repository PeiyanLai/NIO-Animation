// ES9 资产统一出口。
//
// **正侧视只走 `ES9SideView`**（开箱即用，含遮罩/镜像/旋转轮辋/静态高光/接地投影）。
// 底下那些常量是给需要自己搭骨架的特殊场景用的——常规功能演示不该碰它们。
//
// 正俯视走 `ES9_TOP`（泊车动画那张实拍图）。
// 矢量轮 `Wheel.tsx` 是**兜底**，只在拿不到可用照片时用，不要主动选它。

export {ES9SideDefs, ES9SideView} from './SideView';
export {
  ES9_SIDE, ES9_SIDE_BODY, ES9_SIDE_PHOTO, ES9_SIDE_WHEELS, ES9_SIDE_WHEEL_R,
  SIDE_GROUND_Y, sideWheelDeg,
} from './side';
export {ES9_RIM_FRONT, ES9_RIM_PHOTO_R, ES9_RIM_REAR} from './side-rim';
export {
  ES9_TOP, ES9_TOP_ANCHORS, ES9_TOP_BBOX, ES9_TOP_BODY, ES9_TOP_HEADLIGHTS,
  ES9_TOP_PHOTO, ES9_TOP_SRC, HEADLIGHT_FILLS, topAnchorPoint, topBodyTransform,
  topCarWidth, topScale,
} from './top';
export {
  CROSS_RATIOS, ES9_DERIVED, ES9_SPEC, checkProportions, mmPerPx, pxPerMM,
  toMM, toPx, vehicleMetrics, wheelAnchors,
} from './spec';
