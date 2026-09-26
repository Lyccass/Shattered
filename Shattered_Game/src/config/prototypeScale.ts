export const PROTOTYPE_SCALE = {
  tileWidth: 64,
  tileHeight: 32,
  playerVisualScale: 2,
  mapWidth: 192,
  mapHeight: 192,
  // Render in small batches; authored world chunks remain 32×32.
  terrainChunkSize: 8,
  terrainChunkVisibleRadius: 1,
  terrainChunkRetainRadius: 2,
  terrainChunkBleedTiles: 1,
  terrainChunkGroundBuildBudgetPerFrame: 256,
  terrainChunkPrefetchGroundBuildBudgetPerFrame: 64,
  terrainChunkGridBuildBudgetPerFrame: 64,
  terrainChunkGroundBuildTimeBudgetMs: 2.5,
  terrainChunkGridBuildTimeBudgetMs: 1,
  debugOverlayBannerRefreshMs: 120,
  debugOverlayDetailRefreshMs: 200,
} as const;
