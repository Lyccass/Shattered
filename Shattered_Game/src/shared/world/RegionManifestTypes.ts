import type { ChunkCoordinate } from './ChunkKey';

export type RegionEnvironmentVariable =
  | 'corruption'
  | 'prosperity'
  | 'monsterPressure'
  | 'resourceAbundance'
  | 'routeSafety'
  | 'weather'
  | 'season';

export type RegionChunkBounds = {
  minChunkX: number;
  minChunkY: number;
  maxChunkX: number;
  maxChunkY: number;
};

export type RegionManifest = {
  worldId: string;
  regionId: string;
  displayName: string;
  chunkSize: number;
  bounds: RegionChunkBounds;
  chunks: ChunkCoordinate[];
  biomeTags?: string[];
  defaultTerrainPaletteId?: string;
  environmentVariables?: Partial<Record<RegionEnvironmentVariable, number | string>>;
  metadata?: Record<string, unknown>;
};
