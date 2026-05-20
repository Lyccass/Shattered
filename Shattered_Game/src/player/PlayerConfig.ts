import { PROTOTYPE_SCALE } from '../config/prototypeScale';

export const PLAYER_CONFIG = {
  movementSpeed: 88,
  // The female adventurer body centers a touch right of exact half in most frames.
  originX: 24.5 / 48,
  originY: 0.5,
  // Visible feet land around y=42 in a 64px frame, so the ground contact sits
  // roughly 10px below frame centre instead of the old warrior's 16px.
  feetAnchorFromCenterY: 10,
  visualScale: PROTOTYPE_SCALE.playerVisualScale,
  // Collision is still grid-first. These samples describe the small ground
  // contact area around the feet, not the full upright body.
  groundFootprintRadiusX: 7,
  groundFootprintRadiusY: 3,
  slideSpeedRatio: 0.9,
  maxCollisionStepDistance: 6,
  depthTieBreaker: 0.25,
  shadowWidthRatio: 0.68,
  shadowHeightRatio: 0.2,
  shadowOffsetY: 2,
  shadowColor: 0x020617,
  shadowAlpha: 0.24,
  shadowBaseWidth: 34,
  shadowBaseHeight: 12,
} as const;
