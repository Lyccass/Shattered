import Phaser from 'phaser';
import type { ChunkKey } from '../../shared/world/ChunkKey';
import type { WorldChunkProvider } from '../../shared/world/WorldChunkProvider';
import { IsoTilemap } from '../IsoTilemap';
import type { ActiveWorldChunkWindow } from '../streaming/ActiveWorldChunkWindow';
import { MapZoneIndex } from './MapZoneIndex';
import type { MapDefinition, MapInteractionAnchor, MapTransition, MapZone } from './MapTypes';

export type RuntimeEnemySpawn = {
  id: string;
  definitionId: string;
  mapId: string;
  tileX: number;
  tileY: number;
};

export type StreamedWorldRuntime = {
  provider: WorldChunkProvider;
  activeWindow: ActiveWorldChunkWindow;
  lastCenterChunkKey: ChunkKey | null;
  loadingCenterChunkKey: ChunkKey | null;
  materializedChunkKeys: Set<ChunkKey>;
  materializedObjectIdsByChunk: Map<ChunkKey, string[]>;
};

export type LoadedMapRuntime = {
  definition: MapDefinition;
  isoTilemap: IsoTilemap;
  worldBounds: Phaser.Geom.Rectangle;
  activeSpawnId: string;
  transitions: MapTransition[];
  zones: MapZone[];
  zoneIndex: MapZoneIndex;
  interactionAnchors: MapInteractionAnchor[];
  enemySpawns: RuntimeEnemySpawn[];
  streamedWorld?: StreamedWorldRuntime;
};
