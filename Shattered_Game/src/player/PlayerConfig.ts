import { PROTOTYPE_SCALE } from '../config/prototypeScale';

export const PLAYER_CONFIG = {
  movementSpeed: 88,
  // The warrior PNG has transparent padding: visible pixels are centred around
  // x=26.5 in a 64px-wide frame. This origin makes sprite.x line up with the
  // character/feet centre instead of the raw texture centre.
  originX: 26.5 / 64,
  originY: 0.5,
  // Warrior idle frame is 64x44 with default origin (0.5, 0.5).
  // Feet/depth sit near local y=38, so they are roughly 16px below texture centre.
  feetAnchorFromCenterY: 16,
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
