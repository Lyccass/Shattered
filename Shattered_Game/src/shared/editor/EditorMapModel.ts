import type { MapDefinition, MapPlacedObject } from '../map/MapTypes';
import type { TerrainFamily } from '../map/TerrainTypes';
import type { ObjectDefinition } from '../../objects/ObjectTypes';
import { assertValidMapShape } from '../map/MapValidation';
import {
  mapDefinitionToSingleWorldChunk,
  worldChunkDefinitionToMapDefinition,
  type MapToChunkOptions,
} from '../world/ChunkAdapters';
import type { WorldChunkDefinition } from '../world/ChunkTypes';

export type EditorTerrainTilePaint = {
  id: string;
  category?: string;
  family: TerrainFamily;
  textureKey: string;
  textureDataUrl?: string;
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

export type EditorMapDefinition = {
  id: string;
  displayName: string;
  width: number;
  height: number;
  terrain: TerrainFamily[][];
  terrainTiles: Record<string, EditorTerrainTilePaint>;
  terrainWalkability: Record<string, boolean>;
  terrainElevation: Record<string, number>;
  customTerrainBrushes: EditorTerrainTilePaint[];
  customObjectDefinitions: ObjectDefinition[];
  objects: EditorPlacedObject[];
  enemySpawns: EditorEnemySpawn[];
  /** editor-only: maps "chunkX,chunkY" → human name for that chunk */
  chunkNames?: Record<string, string>;
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
    customTerrainBrushes: [],
    customObjectDefinitions: [],
    objects: [],
    enemySpawns: [],
  };

  if (defaultPaint) {
    fillTerrainTilePaint(map, defaultPaint);
  }

  return map;
}

export function createSampleEditorMap(defaultPaint?: EditorTerrainTilePaint): EditorMapDefinition {
  // 32×32 = 2×2 full chunks of size 16
  return createEditorMap(32, 32, 'grass', 'editor_test_map', 'Editor Test Map', defaultPaint);
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
  map.terrainWalkability[tileKey(tileX, tileY)] = paint.walkable;
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
  delete map.terrainWalkability[tileKey(tileX, tileY)];
  return true;
}

export function paintTerrainWalkability(
  map: EditorMapDefinition,
  tileX: number,
  tileY: number,
  walkable: boolean,
): boolean {
  if (!isTileInEditorMapBounds(map, tileX, tileY)) {
    return false;
  }

  const key = tileKey(tileX, tileY);
  map.terrainWalkability[key] = walkable;

  if (map.terrainTiles[key]) {
    map.terrainTiles[key] = {
      ...map.terrainTiles[key],
      walkable,
    };
  }

  return true;
}

export function paintTerrainElevation(
  map: EditorMapDefinition,
  tileX: number,
  tileY: number,
  elevation: number,
): boolean {
  if (!isTileInEditorMapBounds(map, tileX, tileY)) {
    return false;
  }

  map.terrainElevation[tileKey(tileX, tileY)] = normalizeElevation(elevation);
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

export function getEditorTerrainWalkabilityAt(
  map: EditorMapDefinition,
  tileX: number,
  tileY: number,
): boolean | null {
  if (!isTileInEditorMapBounds(map, tileX, tileY)) {
    return null;
  }

  const key = tileKey(tileX, tileY);
  const override = map.terrainWalkability[key];

  if (override !== undefined) {
    return override;
  }

  return map.terrainTiles[key]?.walkable ?? map.terrain[tileY][tileX] !== 'water';
}

export function getEditorTerrainElevationAt(
  map: EditorMapDefinition,
  tileX: number,
  tileY: number,
): number | null {
  if (!isTileInEditorMapBounds(map, tileX, tileY)) {
    return null;
  }

  return map.terrainElevation[tileKey(tileX, tileY)] ?? 0;
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
  const terrainWalkability = filterTileRecordByBounds(map.terrainWalkability, width, height);
  const terrainElevation = filterTileRecordByBounds(map.terrainElevation, width, height);

  const resized: EditorMapDefinition = {
    ...map,
    width,
    height,
    terrain: Array.from({ length: height }, (_, tileY) =>
      Array.from({ length: width }, (_, tileX) => map.terrain[tileY]?.[tileX] ?? fillPaint.family),
    ),
    terrainTiles,
    terrainWalkability,
    terrainElevation,
    objects: map.objects.filter((object) => isTileInsideBounds(object.tileX, object.tileY, width, height)),
    enemySpawns: map.enemySpawns.filter((spawn) => isTileInsideBounds(spawn.tileX, spawn.tileY, width, height)),
  };

  for (let tileY = 0; tileY < height; tileY += 1) {
    for (let tileX = 0; tileX < width; tileX += 1) {
      const key = tileKey(tileX, tileY);

      if (!resized.terrainTiles[key]) {
        resized.terrainTiles[key] = { ...fillPaint };
      }

      if (resized.terrainWalkability[key] === undefined) {
        resized.terrainWalkability[key] = fillPaint.walkable;
      }

      if (resized.terrainElevation[key] === undefined) {
        resized.terrainElevation[key] = 0;
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
      ...(Object.keys(map.terrainWalkability).length > 0
        ? { editorTerrainWalkability: map.terrainWalkability }
        : {}),
      ...(Object.keys(map.terrainElevation).length > 0
        ? { editorTerrainElevation: map.terrainElevation }
        : {}),
      ...(map.customTerrainBrushes.length > 0
        ? { editorTerrainBrushes: map.customTerrainBrushes }
        : {}),
      ...(map.customObjectDefinitions.length > 0
        ? { editorObjectDefinitions: map.customObjectDefinitions }
        : {}),
      ...(map.enemySpawns.length > 0 ? { editorEnemySpawns: map.enemySpawns } : {}),
      ...(map.chunkNames && Object.keys(map.chunkNames).length > 0 ? { editorChunkNames: map.chunkNames } : {}),
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
    terrainWalkability: parseEditorTerrainWalkability(map.metadata?.editorTerrainWalkability),
    terrainElevation: parseEditorTerrainElevation(map.metadata?.editorTerrainElevation),
    customTerrainBrushes: parseEditorTerrainBrushes(map.metadata?.editorTerrainBrushes),
    customObjectDefinitions: parseEditorObjectDefinitions(map.metadata?.editorObjectDefinitions),
    chunkNames: parseEditorChunkNames(map.metadata?.editorChunkNames),
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

export function publishEditorMapForGame(map: EditorMapDefinition): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    throw new Error('Editor map publishing requires browser localStorage.');
  }

  window.localStorage.setItem(EDITOR_GAME_MAP_STORAGE_KEY, serializeEditorMap(map));
}

export function clearPublishedEditorMapForGame(): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  window.localStorage.removeItem(EDITOR_GAME_MAP_STORAGE_KEY);
}

export function loadPublishedEditorMapDefinition(): MapDefinition | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  const json = window.localStorage.getItem(EDITOR_GAME_MAP_STORAGE_KEY);

  if (!json) {
    return null;
  }

  try {
    return parseEditorMapJson(json);
  } catch {
    return null;
  }
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
      map.terrainWalkability[tileKey(tileX, tileY)] = paint.walkable;
      map.terrainElevation[tileKey(tileX, tileY)] = 0;
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

function filterTileRecordByBounds<T>(record: Record<string, T>, width: number, height: number): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => {
      const [tileX, tileY] = parseTileKey(key);
      return tileX >= 0 && tileY >= 0 && tileX < width && tileY < height;
    }),
  );
}

function normalizeElevation(elevation: number): number {
  return Math.max(0, Math.min(9, Math.trunc(elevation)));
}

export function parseEditorTerrainTiles(value: unknown): Record<string, EditorTerrainTilePaint> {
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
      ...(typeof paint.category === 'string' ? { category: paint.category } : {}),
      family: paint.family as TerrainFamily,
      textureKey: paint.textureKey,
      ...(typeof paint.textureDataUrl === 'string' ? { textureDataUrl: paint.textureDataUrl } : {}),
      ...(typeof paint.textureScale === 'number' && Number.isFinite(paint.textureScale) && paint.textureScale > 0
        ? { textureScale: paint.textureScale }
        : {}),
      walkable: typeof paint.walkable === 'boolean'
        ? paint.walkable
        : paint.family !== 'water',
      flipX: paint.flipX === true,
      flipY: paint.flipY === true,
    };
  }

  return tiles;
}

export function parseEditorTerrainBrushes(value: unknown): EditorTerrainTilePaint[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((brush): EditorTerrainTilePaint[] => {
    if (!isRecord(brush)) {
      return [];
    }

    if (
      typeof brush.id !== 'string' ||
      typeof brush.family !== 'string' ||
      typeof brush.textureKey !== 'string'
    ) {
      return [];
    }

    return [{
      id: brush.id,
      ...(typeof brush.category === 'string' ? { category: brush.category } : {}),
      family: brush.family as TerrainFamily,
      textureKey: brush.textureKey,
      ...(typeof brush.textureDataUrl === 'string' ? { textureDataUrl: brush.textureDataUrl } : {}),
      ...(typeof brush.textureScale === 'number' && Number.isFinite(brush.textureScale) && brush.textureScale > 0
        ? { textureScale: brush.textureScale }
        : {}),
      walkable: typeof brush.walkable === 'boolean'
        ? brush.walkable
        : brush.family !== 'water',
      flipX: brush.flipX === true,
      flipY: brush.flipY === true,
    }];
  });
}

export function parseEditorTerrainWalkability(value: unknown): Record<string, boolean> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
  );
}

export function parseEditorTerrainElevation(value: unknown): Record<string, number> {
  if (!isRecord(value)) {
    return {};
  }

  const elevation: Record<string, number> = {};

  for (const [key, rawValue] of Object.entries(value)) {
    if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
      elevation[key] = normalizeElevation(rawValue);
    }
  }

  return elevation;
}

export function parseEditorObjectDefinitions(value: unknown): ObjectDefinition[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((definition): ObjectDefinition[] => {
    if (!isRecord(definition)) {
      return [];
    }

    if (
      typeof definition.id !== 'string' ||
      typeof definition.displayName !== 'string' ||
      !Array.isArray(definition.collisionFootprint) ||
      typeof definition.blocksMovement !== 'boolean' ||
      !isRecord(definition.visual) ||
      !Array.isArray(definition.visual.parts) ||
      !isRecord(definition.shadow) ||
      !isRecord(definition.depth) ||
      !isRecord(definition.debug)
    ) {
      return [];
    }

    return [normalizeImportedObjectDefinition(definition as ObjectDefinition)];
  });
}

function normalizeImportedObjectDefinition(definition: ObjectDefinition): ObjectDefinition {
  return {
    ...definition,
    visual: {
      parts: definition.visual.parts.map((part) => {
        if (part.shape !== 'sprite' || !part.editorTextureDataUrl) {
          return part;
        }

        return {
          ...part,
          originX: 0.5,
          originY: 0.5,
        };
      }),
    },
  };
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

function parseEditorChunkNames(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const names: Record<string, string> = {};

  for (const [key, name] of Object.entries(value)) {
    if (typeof name === 'string' && name.length > 0) {
      names[key] = name;
    }
  }

  return Object.keys(names).length > 0 ? names : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
