import type { ChunkCoordinate } from './ChunkKey';

export type WorldSpawnMetadata = {
  regionId: string;
  chunk: ChunkCoordinate;
  tileX: number;
  tileY: number;
  spawnId?: string;
};

export type WorldManifest = {
  worldId: string;
  displayName: string;
  defaultRegionId: string;
  defaultSpawn: WorldSpawnMetadata;
  regionIds: string[];
  terrainPaletteIds?: string[];
  metadata?: Record<string, unknown>;
};
