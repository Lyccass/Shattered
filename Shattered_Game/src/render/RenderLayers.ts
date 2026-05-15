export const RENDER_DEPTHS = {
  // GroundLayer: terrain tiles/backdrops never participate in dynamic sorting.
  GROUND: 0,
  // GridLayer/OverlayLayer: optional tile grid stays below dynamic actors.
  GRID: 50,
  // ShadowLayer: reserved for shadows that should not control sorting.
  SHADOW: 100,
  // DynamicWorldLayer: player and future actors use their feet/base Y for sorting.
  DYNAMIC_WORLD_BASE: 1000,
  // DebugLayer: player/grid/world-space debug helpers.
  DEBUG: 20_000,
  // UILayer: fixed screen text rendered by the UI camera.
  UI: 30_000,
} as const;

export function getDynamicDepth(depthAnchorY: number, depthOffset = 0): number {
  return RENDER_DEPTHS.DYNAMIC_WORLD_BASE + depthAnchorY + depthOffset;
}
