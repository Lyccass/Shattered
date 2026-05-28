import type {
  GridFootprint,
  MapTransition,
  MapZoneTag,
  ResourceNodeType,
} from '../map/MapTypes';
import type { TerrainFamily } from '../map/TerrainTypes';
import type { ChunkCoordinate, ChunkKey } from './ChunkKey';
import type { TerrainPalette, TerrainTileId } from './TerrainPalette';

export type PaletteTerrainLayerDefinition = {
  encoding: 'palette';
  tiles: TerrainTileId[][];
};

export type FamilyTerrainLayerDefinition = {
  encoding: 'families';
  tiles: TerrainFamily[][];
};

export type TerrainLayerDefinition =
  | PaletteTerrainLayerDefinition
  | FamilyTerrainLayerDefinition;

export type StaticObjectPlacementDefinition = {
  id: string;
  definitionId: string;
  tileX: number;
  tileY: number;
  orientation?: string;
  state?: Record<string, unknown>;
};

export type StaticObjectLayerDefinition = {
  objects: StaticObjectPlacementDefinition[];
};

export type ResourceNodeDefinition = {
  id: string;
  resourceDefinitionId: ResourceNodeType | string;
  tileX: number;
  tileY: number;
  respawnProfileId?: string;
  maturityProfileId?: string;
  candidateWeight?: number;
  tags?: string[];
};

export type ResourceLayerDefinition = {
  nodes: ResourceNodeDefinition[];
};

export type ChunkZoneDefinition = {
  id: string;
  tileX: number;
  tileY: number;
  width: number;
  height: number;
  tags: MapZoneTag[] | string[];
};

export type ZoneLayerDefinition = {
  zones: ChunkZoneDefinition[];
};

export type SpawnRuleDefinition = {
  id: string;
  creatureFamilyId: string;
  enemyDefinitionId?: string;
  densityHint?: number;
  maxPopulation?: number;
  respawnMs?: number;
  weight?: number;
  lootTableId?: string;
  initialMaturityLevel?: number;
  maxMaturityLevel?: number;
  maturityTickMs?: number;
  migrationThresholdLevel?: number;
  migrationTargetTags?: string[];
  minWorldState?: Record<string, number | string>;
  maxWorldState?: Record<string, number | string>;
};

export type ManualSpawnDefinition = {
  id: string;
  enemyDefinitionId: string;
  tileX: number;
  tileY: number;
  respawnMs?: number;
  lootTableId?: string;
};

export type HabitatDefinition = {
  id: string;
  name?: string;
  tileX: number;
  tileY: number;
  width: number;
  height: number;
  tags?: string[];
  spawnRules: SpawnRuleDefinition[];
  manualSpawns?: ManualSpawnDefinition[];
};

export type HabitatLayerDefinition = {
  habitats: HabitatDefinition[];
};

export type NpcAnchorChunkDefinition = {
  id: string;
  npcDefinitionId: string;
  tileX: number;
  tileY: number;
  text?: string;
};

export type NpcLayerDefinition = {
  anchors: NpcAnchorChunkDefinition[];
};

export type ConnectionLayerDefinition = {
  transitions: MapTransition[];
};

export type WorldChunkDefinition = {
  worldId: string;
  regionId: string;
  chunkX: number;
  chunkY: number;
  width: number;
  height: number;
  terrainPalette?: TerrainPalette;
  terrain: TerrainLayerDefinition;
  objectLayer: StaticObjectLayerDefinition;
  resourceLayer: ResourceLayerDefinition;
  zoneLayer: ZoneLayerDefinition;
  connectionLayer?: ConnectionLayerDefinition;
  habitatLayer: HabitatLayerDefinition;
  npcLayer?: NpcLayerDefinition;
  metadata?: Record<string, unknown>;
};

export type WorldChunkReference = ChunkCoordinate & {
  worldId: string;
  regionId: string;
  chunkKey: ChunkKey;
};

export type ChunkFootprint = GridFootprint;
