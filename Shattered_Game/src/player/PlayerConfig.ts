import { PROTOTYPE_SCALE } from '../config/prototypeScale';

export const PLAYER_CONFIG = {
  movementSpeed: 88,
  // The female adventurer body centers a touch right of exact half in most frames.
  originX: 24.5 / 48,
  // Anchor the sprite directly on the visible feet for this pack.
  originY: 42 / 64,
  // With a feet-origin sprite, the feet point is the sprite position itself.
  feetAnchorFromCenterY: 0,
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
