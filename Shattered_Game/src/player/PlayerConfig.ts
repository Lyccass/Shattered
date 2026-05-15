import { PROTOTYPE_SCALE } from '../config/prototypeScale';

export const PLAYER_CONFIG = {
  movementSpeed: 240,
  // Placeholder texture is 48x72 with default origin (0.5, 0.5).
  // The feet/depth point is at local y=66, so it is 30px below texture centre.
  feetAnchorFromCenterY: 30,
  visualScale: PROTOTYPE_SCALE.playerVisualScale,
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
