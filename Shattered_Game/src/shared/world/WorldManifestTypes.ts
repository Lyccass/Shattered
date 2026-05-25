import type { ChunkCoordinate } from './ChunkKey';
import type { TerrainFamily } from '../map/TerrainTypes';

export type WorldSpawnMetadata = {
  regionId: string;
  chunk: ChunkCoordinate;
  tileX: number;
  tileY: number;
  spawnId?: string;
};

export type WorldChunkBounds = {
  minChunkX: number;
  minChunkY: number;
  maxChunkX: number;
  maxChunkY: number;
};

export type WorldManifestRegion = {
  id: string;
  displayName: string;
  defaultTerrain: TerrainFamily;
  defaultWalkable: boolean;
  biomeTags?: string[];
  metadata?: Record<string, unknown>;
};

export type AuthoredWorldChunkReference = ChunkCoordinate & {
  regionId: string;
  path: string;
  metadata?: Record<string, unknown>;
};

export type WorldManifest = {
  version: 1;
  worldId: string;
  displayName: string;
  chunkSize: number;
  bounds: WorldChunkBounds;
  defaultRegionId: string;
  regions: WorldManifestRegion[];
  authoredChunks: AuthoredWorldChunkReference[];
  defaultSpawn: WorldSpawnMetadata;
  terrainPaletteIds?: string[];
  metadata?: Record<string, unknown>;
};
