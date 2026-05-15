export const OBJECT_OCCLUSION_CONFIG = {
  normalAlpha: 1,
  minimumAlpha: 0.38,
  // Higher values reach the target alpha faster while still avoiding popping.
  fadeInSpeed: 10,
  fadeOutSpeed: 7,
  // Tiny depth gaps can flicker when the player and object share almost the same
  // base Y. This margin makes "foreground" intentional instead of noisy.
  foregroundDepthMargin: 1,
  // A small overlap should only soften the object; strong overlap should make it
  // clearly transparent. This gives the fade a graded feel instead of a binary
  // on/off switch.
  overlapStrength: 1.65,
} as const;
