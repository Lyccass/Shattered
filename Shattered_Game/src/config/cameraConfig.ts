export const CAMERA_CONFIG = {
  defaultZoom: 1.5,
  minZoom: 1,
  maxZoom: 2,
 zoomSteps: [1, 1.125, 1.25, 1.375, 1.5, 1.625, 1.75, 1.875, 2],
  zoomTweenMs: 140,
  followLerp: 0.12,
  wheelCooldownMs: 60,
} as const;