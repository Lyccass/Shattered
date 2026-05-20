import type { MapDefinition, MapPlacedObject } from '../map/MapTypes';
import type { TerrainFamily } from '../map/TerrainTypes';
import { assertValidMapShape } from '../map/MapValidation';
import {
  mapDefinitionToSingleWorldChunk,
  worldChunkDefinitionToMapDefinition,
  type MapToChunkOptions,
} from '../world/ChunkAdapters';
import type { WorldChunkDefinition } from '../world/ChunkTypes';

export type EditorTerrainTilePaint = {
  id: string;
  family: TerrainFamily;
  textureKey: string;
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

export type EditorMapDefinition = {
  id: string;
  displayName: string;
  width: number;
  height: number;
  terrain: TerrainFamily[][];
  terrainTiles: Record<string, EditorTerrainTilePaint>;
  objects: EditorPlacedObject[];
  enemySpawns: EditorEnemySpawn[];
};

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
    objects: [],
    enemySpawns: [],
  };

  if (defaultPaint) {
    fillTerrainTilePaint(map, defaultPaint);
  }

  return map;
}

export function createSampleEditorMap(defaultPaint?: EditorTerrainTilePaint): EditorMapDefinition {
  const map = createEditorMap(24, 24, 'grass', 'editor_test_map', 'Editor Test Map', defaultPaint);

  return map;
}

export function paintTerrainTile(
  map: EditorMapDefinition,
  tileX: number,
  tileY: number,
  paint: EditorTerrainTilePaint,
): boolean {
  if (!isTileInEditorMapBounds(map, tileX, tileY)) {
    return false;
  }

  map.terrain[tileY][tileX] = paint.family;
  map.terrainTiles[tileKey(tileX, tileY)] = { ...paint };
  return true;
}

export function paintTerrain(
  map: EditorMapDefinition,
  tileX: number,
  tileY: number,
  family: TerrainFamily,
): boolean {
  if (!isTileInEditorMapBounds(map, tileX, tileY)) {
    return false;
  }

  map.terrain[tileY][tileX] = family;
  delete map.terrainTiles[tileKey(tileX, tileY)];
  return true;
}

export function getEditorTerrainAt(
  map: EditorMapDefinition,
  tileX: number,
  tileY: number,
): TerrainFamily | null {
  if (!isTileInEditorMapBounds(map, tileX, tileY)) {
    return null;
  }

  return map.terrain[tileY][tileX];
}

export function getEditorTerrainTilePaint(
  map: EditorMapDefinition,
  tileX: number,
  tileY: number,
): EditorTerrainTilePaint | null {
  if (!isTileInEditorMapBounds(map, tileX, tileY)) {
    return null;
  }

  return map.terrainTiles[tileKey(tileX, tileY)] ?? null;
}

export function addEditorPlacedObject(
  map: EditorMapDefinition,
  object: EditorPlacedObject,
): EditorMapDefinition {
  return {
    ...map,
    objects: [...map.objects, object],
  };
}

export function removeEditorPlacedObjectsAtTile(
  map: EditorMapDefinition,
  tileX: number,
  tileY: number,
): EditorMapDefinition {
  return {
    ...map,
    objects: map.objects.filter((object) => object.tileX !== tileX || object.tileY !== tileY),
  };
}

export function resizeEditorMap(
  map: EditorMapDefinition,
  width: number,
  height: number,
  fillPaint: EditorTerrainTilePaint,
): EditorMapDefinition {
  if (!Number.isInteger(width) || width <= 0) {
    throw new Error('Editor map width must be a positive integer.');
  }

  if (!Number.isInteger(height) || height <= 0) {
    throw new Error('Editor map height must be a positive integer.');
  }

  const terrainTiles = Object.fromEntries(
    Object.entries(map.terrainTiles).filter(([key]) => {
      const [tileX, tileY] = parseTileKey(key);
      return tileX >= 0 && tileY >= 0 && tileX < width && tileY < height;
    }),
  );

  const resized: EditorMapDefinition = {
    ...map,
    width,
    height,
    terrain: Array.from({ length: height }, (_, tileY) =>
      Array.from({ length: width }, (_, tileX) => map.terrain[tileY]?.[tileX] ?? fillPaint.family),
    ),
    terrainTiles,
    objects: map.objects.filter((object) => isTileInsideBounds(object.tileX, object.tileY, width, height)),
    enemySpawns: map.enemySpawns.filter((spawn) => isTileInsideBounds(spawn.tileX, spawn.tileY, width, height)),
  };

  for (let tileY = 0; tileY < height; tileY += 1) {
    for (let tileX = 0; tileX < width; tileX += 1) {
      const key = tileKey(tileX, tileY);

      if (!resized.terrainTiles[key]) {
        resized.terrainTiles[key] = { ...fillPaint };
      }
    }
  }

  return resized;
}

export function exportEditorMapToMapDefinition(map: EditorMapDefinition): MapDefinition {
  const mapDefinition: MapDefinition = {
    id: map.id,
    displayName: map.displayName,
    spaceType: 'open_world',
    width: map.width,
    height: map.height,
    terrain: map.terrain.map((row) => [...row]),
    spawnPoints: {
      default: {
        id: 'default',
        tileX: Math.floor(map.width / 2),
        tileY: Math.floor(map.height / 2),
      },
    },
    objects: map.objects.map(toMapPlacedObject),
    transitions: [],
    zones: [],
    interactionAnchors: [],
    metadata: {
      source: 'map_editor_v0',
      editorTerrainTiles: map.terrainTiles,
      ...(map.enemySpawns.length > 0 ? { editorEnemySpawns: map.enemySpawns } : {}),
    },
  };

  assertValidMapShape(mapDefinition);
  return mapDefinition;
}

export function exportEditorMapToWorldChunkDefinition(
  map: EditorMapDefinition,
  options: MapToChunkOptions,
): WorldChunkDefinition {
  return mapDefinitionToSingleWorldChunk(exportEditorMapToMapDefinition(map), options);
}

export function createEditorMapFromMapDefinition(map: MapDefinition): EditorMapDefinition {
  assertValidMapShape(map);

  return {
    id: map.id,
    displayName: map.displayName,
    width: map.width,
    height: map.height,
    terrain: map.terrain.map((row) => [...row]),
    terrainTiles: parseEditorTerrainTiles(map.metadata?.editorTerrainTiles),
    objects: map.objects.map((object) => ({
      id: object.id,
      definitionId: object.definitionId,
      tileX: object.tileX,
      tileY: object.tileY,
    })),
    enemySpawns: parseEditorEnemySpawns(map.metadata?.editorEnemySpawns),
  };
}

export function createEditorMapFromWorldChunkDefinition(chunk: WorldChunkDefinition): EditorMapDefinition {
  return createEditorMapFromMapDefinition(worldChunkDefinitionToMapDefinition(chunk));
}

export function serializeEditorMap(map: EditorMapDefinition): string {
  return JSON.stringify(exportEditorMapToMapDefinition(map), null, 2);
}

export function serializeEditorMapAsWorldChunk(
  map: EditorMapDefinition,
  options: MapToChunkOptions,
): string {
  return JSON.stringify(exportEditorMapToWorldChunkDefinition(map, options), null, 2);
}

export function parseEditorMapJson(json: string): MapDefinition {
  const parsed: unknown = JSON.parse(json);
  assertValidMapShape(parsed);
  return parsed;
}

function fillTerrainTilePaint(map: EditorMapDefinition, paint: EditorTerrainTilePaint): void {
  for (let tileY = 0; tileY < map.height; tileY += 1) {
    for (let tileX = 0; tileX < map.width; tileX += 1) {
      map.terrainTiles[tileKey(tileX, tileY)] = { ...paint };
    }
  }
}

function toMapPlacedObject(object: EditorPlacedObject): MapPlacedObject {
  return {
    id: object.id,
    definitionId: object.definitionId,
    tileX: object.tileX,
    tileY: object.tileY,
  };
}

function isTileInEditorMapBounds(
  map: EditorMapDefinition,
  tileX: number,
  tileY: number,
): boolean {
  return isTileInsideBounds(tileX, tileY, map.width, map.height);
}

function isTileInsideBounds(
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

function tileKey(tileX: number, tileY: number): string {
  return `${tileX},${tileY}`;
}

function parseTileKey(key: string): [number, number] {
  const [tileX, tileY] = key.split(',').map((part) => Number.parseInt(part, 10));
  return [Number.isFinite(tileX) ? tileX : -1, Number.isFinite(tileY) ? tileY : -1];
}

function parseEditorTerrainTiles(value: unknown): Record<string, EditorTerrainTilePaint> {
  if (!isRecord(value)) {
    return {};
  }

  const tiles: Record<string, EditorTerrainTilePaint> = {};

  for (const [key, paint] of Object.entries(value)) {
    if (!isRecord(paint)) {
      continue;
    }

    if (
      typeof paint.id !== 'string' ||
      typeof paint.family !== 'string' ||
      typeof paint.textureKey !== 'string'
    ) {
      continue;
    }

    tiles[key] = {
      id: paint.id,
      family: paint.family as TerrainFamily,
      textureKey: paint.textureKey,
      flipX: paint.flipX === true,
      flipY: paint.flipY === true,
    };
  }

  return tiles;
}

function parseEditorEnemySpawns(value: unknown): EditorEnemySpawn[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((spawn): EditorEnemySpawn[] => {
    if (!isRecord(spawn)) {
      return [];
    }

    if (
      typeof spawn.id !== 'string' ||
      typeof spawn.enemyDefinitionId !== 'string' ||
      typeof spawn.tileX !== 'number' ||
      typeof spawn.tileY !== 'number'
    ) {
      return [];
    }

    return [{
      id: spawn.id,
      enemyDefinitionId: spawn.enemyDefinitionId,
      tileX: spawn.tileX,
      tileY: spawn.tileY,
    }];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
