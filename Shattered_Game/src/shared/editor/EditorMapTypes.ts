import type { MapTransition } from '../map/MapTypes';
import type { MapZoneTag } from '../map/MapTypes';
import type { TerrainFamily } from '../map/TerrainTypes';
import type { ObjectDefinition } from '../../objects/ObjectTypes';
import type { EditorEncounterArea } from './EditorEncounterModel';

export type EditorWorldZoneTag = Extract<MapZoneTag, 'town' | 'wilds' | 'elite' | 'dungeon' | 'locked'>;

export const EDITOR_WORLD_ZONE_TAGS: EditorWorldZoneTag[] = ['town', 'wilds', 'elite', 'dungeon', 'locked'];

export const EDITOR_ZONE_COLORS: Record<EditorWorldZoneTag, number> = {
  town:    0x22c55e,
  wilds:   0xef4444,
  elite:   0xa855f7,
  dungeon: 0x64748b,
  locked:  0xf59e0b,
};

export type EditorTerrainTilePaint = {
  id: string;
  category?: string;
  family: TerrainFamily;
  textureKey: string;
  textureDataUrl?: string;
  textureOffsetX?: number;
  textureOffsetY?: number;
  textureScale?: number;
  walkable: boolean;
  flipX: boolean;
  flipY: boolean;
};

export type EditorPlacedObject = {
  id: string;
  definitionId: string;
  tileX: number;
  tileY: number;
};

export type EditorEnemySpawn = {
  id: string;
  enemyDefinitionId: string;
  tileX: number;
  tileY: number;
};

export type EditorNpcAnchor = {
  id: string;
  definitionId: string;
  tileX: number;
  tileY: number;
};

export type EditorMapDefinition = {
  id: string;
  displayName: string;
  width: number;
  height: number;
  terrain: TerrainFamily[][];
  terrainTiles: Record<string, EditorTerrainTilePaint>;
  terrainWalkability: Record<string, boolean>;
  terrainElevation: Record<string, number>;
  /** maps "tileX,tileY" → zone tag; tiles without an entry have no zone */
  terrainZones: Record<string, EditorWorldZoneTag>;
  customTerrainBrushes: EditorTerrainTilePaint[];
  customObjectDefinitions: ObjectDefinition[];
  objects: EditorPlacedObject[];
  enemySpawns: EditorEnemySpawn[];
  encounterAreas: EditorEncounterArea[];
  npcAnchors: EditorNpcAnchor[];
  transitions: MapTransition[];
  /** editor-only: maps "chunkX,chunkY" → human name for that chunk */
  chunkNames?: Record<string, string>;
};

export type EditorMapExportOptions = {
  includeEditorAssetData?: boolean;
  includeEditorAssetDefinitions?: boolean;
};

export const EDITOR_GAME_MAP_STORAGE_KEY = 'shattered.editor.published_map.v1';

export function createEditorMap(
  width: number,
  height: number,
  family: TerrainFamily,
  id = 'editor_test_map',
  displayName = 'Editor Test Map',
  defaultPaint?: EditorTerrainTilePaint,
): EditorMapDefinition {
  const map: EditorMapDefinition = {
    id,
    displayName,
    width,
    height,
    terrain: Array.from({ length: height }, () =>
      Array.from({ length: width }, () => family),
    ),
    terrainTiles: {},
    terrainWalkability: {},
    terrainElevation: {},
    terrainZones: {},
    customTerrainBrushes: [],
    customObjectDefinitions: [],
    objects: [],
    enemySpawns: [],
    encounterAreas: [],
    npcAnchors: [],
    transitions: [],
  };

  if (defaultPaint) {
    fillTerrainTilePaint(map, defaultPaint);
  }

  return map;
}

export function createSampleEditorMap(defaultPaint?: EditorTerrainTilePaint): EditorMapDefinition {
  // 64×64 = 2×2 full chunks of size 32
  return createEditorMap(64, 64, 'grass', 'editor_test_map', 'Editor Test Map', defaultPaint);
}

function fillTerrainTilePaint(map: EditorMapDefinition, paint: EditorTerrainTilePaint): void {
  for (let tileY = 0; tileY < map.height; tileY += 1) {
    for (let tileX = 0; tileX < map.width; tileX += 1) {
      map.terrainTiles[tileKey(tileX, tileY)] = { ...paint };
      map.terrainWalkability[tileKey(tileX, tileY)] = paint.walkable;
      map.terrainElevation[tileKey(tileX, tileY)] = 0;
    }
  }
}

export function tileKey(tileX: number, tileY: number): string {
  return `${tileX},${tileY}`;
}

export function isTileInsideBounds(
  tileX: number,
  tileY: number,
  width: number,
  height: number,
): boolean {
  return (
    Number.isInteger(tileX) &&
    Number.isInteger(tileY) &&
    tileX >= 0 &&
    tileY >= 0 &&
    tileX < width &&
    tileY < height
  );
}

export function normalizeElevation(elevation: number): number {
  return Math.max(0, Math.min(9, Math.trunc(elevation)));
}
