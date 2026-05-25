import type { MapDefinition, MapPlacedObject, MapZone, MapZoneTag } from '../map/MapTypes';
import type { TerrainFamily } from '../map/TerrainTypes';
import type { ObjectDefinition } from '../../objects/ObjectTypes';
import { assertValidMapShape } from '../map/MapValidation';
import {
  mapDefinitionToSingleWorldChunk,
  worldChunkDefinitionToMapDefinition,
  type MapToChunkOptions,
} from '../world/ChunkAdapters';
import type { WorldChunkDefinition } from '../world/ChunkTypes';

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
  /** editor-only: maps "chunkX,chunkY" → human name for that chunk */
  chunkNames?: Record<string, string>;
};

export type EditorMapExportOptions = {
  includeEditorAssetData?: boolean;
  includeEditorAssetDefinitions?: boolean;
};

export const EDITOR_GAME_MAP_STORAGE_KEY = 'shattered.editor.published_map.v1';
const EDITOR_PROJECT_LIBRARY_ENDPOINT = '/__shattered_editor_library';
const EDITOR_PROJECT_PUBLISHED_MAP_ID = 'editor_test_map';

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

export function paintTerrainZone(
  map: EditorMapDefinition,
  tileX: number,
  tileY: number,
  tag: EditorWorldZoneTag | null,
): boolean {
  if (!isTileInEditorMapBounds(map, tileX, tileY)) {
    return false;
  }

  const key = tileKey(tileX, tileY);
  if (tag === null) {
    delete map.terrainZones[key];
  } else {
    map.terrainZones[key] = tag;
  }
  return true;
}

export function getEditorTerrainZoneAt(
  map: EditorMapDefinition,
  tileX: number,
  tileY: number,
): EditorWorldZoneTag | null {
  if (!isTileInEditorMapBounds(map, tileX, tileY)) {
    return null;
  }

  return map.terrainZones[tileKey(tileX, tileY)] ?? null;
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
  const terrainZones = filterTileRecordByBounds(map.terrainZones, width, height);

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
    terrainZones,
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

export function exportEditorMapToMapDefinition(
  map: EditorMapDefinition,
  options: EditorMapExportOptions = {},
): MapDefinition {
  const includeEditorAssetData = options.includeEditorAssetData ?? true;
  const includeEditorAssetDefinitions = options.includeEditorAssetDefinitions ?? true;
  const editorTerrainTiles = serializeTerrainTilePaintRecord(map.terrainTiles, includeEditorAssetData);
  const editorAssetReferences = createEditorAssetReferences(map);
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
    zones: exportZoneTilesToRects(map.terrainZones, map.width, map.height),
    interactionAnchors: [],
    metadata: {
      source: 'map_editor_v0',
      editorTerrainTiles,
      ...(editorAssetReferences ? { editorAssetReferences } : {}),
      ...(Object.keys(map.terrainWalkability).length > 0
        ? { editorTerrainWalkability: map.terrainWalkability }
        : {}),
      ...(Object.keys(map.terrainElevation).length > 0
        ? { editorTerrainElevation: map.terrainElevation }
        : {}),
      ...(includeEditorAssetDefinitions && map.customTerrainBrushes.length > 0
        ? { editorTerrainBrushes: map.customTerrainBrushes.map((brush) => serializeTerrainPaint(brush, includeEditorAssetData)) }
        : {}),
      ...(includeEditorAssetDefinitions && map.customObjectDefinitions.length > 0
        ? { editorObjectDefinitions: serializeObjectDefinitions(map.customObjectDefinitions, includeEditorAssetData) }
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
  options: MapToChunkOptions & EditorMapExportOptions,
): WorldChunkDefinition {
  return mapDefinitionToSingleWorldChunk(exportEditorMapToMapDefinition(map, options), options);
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
    terrainZones: importZoneRectsToTiles(map.zones ?? []),
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

export function serializeEditorMapForProjectLibrary(map: EditorMapDefinition): string {
  return JSON.stringify(
    exportEditorMapToMapDefinition(map, {
      includeEditorAssetData: false,
      includeEditorAssetDefinitions: false,
    }),
    null,
    2,
  );
}

export async function publishEditorMapForGame(map: EditorMapDefinition): Promise<void> {
  const mapDefinition = exportEditorMapToMapDefinition(map);

  if (typeof fetch !== 'undefined') {
    const response = await fetch(
      `${EDITOR_PROJECT_LIBRARY_ENDPOINT}/published/${EDITOR_PROJECT_PUBLISHED_MAP_ID}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mapDefinition),
      },
    );

    if (response.ok) {
      clearPublishedEditorMapFromLocalStorage();
      return;
    }
  }

  publishEditorMapToLocalStorage(map);
}

export function clearPublishedEditorMapForGame(): void {
  clearPublishedEditorMapFromLocalStorage();

  if (typeof fetch !== 'undefined') {
    void fetch(`${EDITOR_PROJECT_LIBRARY_ENDPOINT}/published/${EDITOR_PROJECT_PUBLISHED_MAP_ID}`, {
      method: 'DELETE',
    });
  }
}

function publishEditorMapToLocalStorage(map: EditorMapDefinition): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    throw new Error('Editor map publishing requires the Vite editor project library or browser localStorage.');
  }

  window.localStorage.setItem(EDITOR_GAME_MAP_STORAGE_KEY, serializeEditorMap(map));
}

function clearPublishedEditorMapFromLocalStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  window.localStorage.removeItem(EDITOR_GAME_MAP_STORAGE_KEY);
}

export function loadPublishedEditorMapDefinition(): MapDefinition | null {
  const projectMap = loadPublishedEditorMapDefinitionFromProjectLibrary();

  if (projectMap) {
    return projectMap;
  }

  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  const json = window.localStorage.getItem(EDITOR_GAME_MAP_STORAGE_KEY);

  if (!json) return null;

  try {
    return parseEditorMapJson(json);
  } catch {
    return null;
  }
}

function loadPublishedEditorMapDefinitionFromProjectLibrary(): MapDefinition | null {
  if (typeof XMLHttpRequest === 'undefined') {
    return null;
  }

  try {
    const request = new XMLHttpRequest();
    request.open('GET', `${EDITOR_PROJECT_LIBRARY_ENDPOINT}/published/${EDITOR_PROJECT_PUBLISHED_MAP_ID}`, false);
    request.send();

    if (request.status < 200 || request.status >= 300 || !request.responseText) {
      return null;
    }

    return parseEditorMapJson(request.responseText);
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

function serializeTerrainTilePaintRecord(
  paints: Record<string, EditorTerrainTilePaint>,
  includeAssetData: boolean,
): Record<string, EditorTerrainTilePaint> {
  return Object.fromEntries(
    Object.entries(paints).map(([key, paint]) => [key, serializeTerrainPaint(paint, includeAssetData)]),
  );
}

function serializeTerrainPaint(
  paint: EditorTerrainTilePaint,
  includeAssetData: boolean,
): EditorTerrainTilePaint {
  const { textureDataUrl, ...paintWithoutAssetData } = paint;
  return includeAssetData
    ? { ...paintWithoutAssetData, ...(textureDataUrl !== undefined ? { textureDataUrl } : {}) }
    : paintWithoutAssetData;
}

function serializeObjectDefinitions(
  definitions: ObjectDefinition[],
  includeAssetData: boolean,
): ObjectDefinition[] {
  if (includeAssetData) {
    return definitions;
  }

  return definitions.map((definition) => ({
    ...definition,
    visual: {
      ...definition.visual,
      parts: definition.visual.parts.map((part) => {
        if (part.shape !== 'sprite') {
          return part;
        }

        const { editorTextureDataUrl, ...partWithoutAssetData } = part;
        return partWithoutAssetData;
      }),
    },
  }));
}

function createEditorAssetReferences(map: EditorMapDefinition): {
  objectDefinitionIds?: string[];
  terrainBrushIds?: string[];
} | null {
  const terrainBrushIds = uniqueSorted([
    ...map.customTerrainBrushes.map((brush) => brush.id),
    ...Object.values(map.terrainTiles).map((paint) => paint.id),
  ]);
  const objectDefinitionIds = uniqueSorted([
    ...map.customObjectDefinitions.map((definition) => definition.id),
    ...map.objects.map((object) => object.definitionId),
  ]);
  const references = {
    ...(objectDefinitionIds.length > 0 ? { objectDefinitionIds } : {}),
    ...(terrainBrushIds.length > 0 ? { terrainBrushIds } : {}),
  };

  return Object.keys(references).length > 0 ? references : null;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
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
      ...(typeof paint.textureOffsetX === 'number' && Number.isFinite(paint.textureOffsetX)
        ? { textureOffsetX: paint.textureOffsetX }
        : {}),
      ...(typeof paint.textureOffsetY === 'number' && Number.isFinite(paint.textureOffsetY)
        ? { textureOffsetY: paint.textureOffsetY }
        : {}),
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
      ...(typeof brush.textureOffsetX === 'number' && Number.isFinite(brush.textureOffsetX)
        ? { textureOffsetX: brush.textureOffsetX }
        : {}),
      ...(typeof brush.textureOffsetY === 'number' && Number.isFinite(brush.textureOffsetY)
        ? { textureOffsetY: brush.textureOffsetY }
        : {}),
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

function exportZoneTilesToRects(
  terrainZones: Record<string, EditorWorldZoneTag>,
  width: number,
  height: number,
): MapZone[] {
  const zones: MapZone[] = [];
  const visited = new Set<string>();
  let idCounter = 0;

  for (let tileY = 0; tileY < height; tileY++) {
    for (let tileX = 0; tileX < width; tileX++) {
      const key = tileKey(tileX, tileY);
      if (visited.has(key)) continue;
      const tag = terrainZones[key];
      if (!tag) continue;

      // Expand width in this row
      let rectWidth = 1;
      while (
        tileX + rectWidth < width &&
        terrainZones[tileKey(tileX + rectWidth, tileY)] === tag &&
        !visited.has(tileKey(tileX + rectWidth, tileY))
      ) {
        rectWidth++;
      }

      // Expand height downward while all tiles in each row match
      let rectHeight = 1;
      expandDown: while (tileY + rectHeight < height) {
        for (let dx = 0; dx < rectWidth; dx++) {
          const nextKey = tileKey(tileX + dx, tileY + rectHeight);
          if (visited.has(nextKey) || terrainZones[nextKey] !== tag) break expandDown;
        }
        rectHeight++;
      }

      for (let dy = 0; dy < rectHeight; dy++) {
        for (let dx = 0; dx < rectWidth; dx++) {
          visited.add(tileKey(tileX + dx, tileY + dy));
        }
      }

      zones.push({
        id: `zone_${idCounter++}`,
        tileX,
        tileY,
        width: rectWidth,
        height: rectHeight,
        tags: [tag],
      });
    }
  }

  return zones;
}

function importZoneRectsToTiles(zones: MapZone[]): Record<string, EditorWorldZoneTag> {
  const tiles: Record<string, EditorWorldZoneTag> = {};
  const validTags = new Set<string>(EDITOR_WORLD_ZONE_TAGS);

  for (const zone of zones) {
    const tag = zone.tags.find((t) => validTags.has(t)) as EditorWorldZoneTag | undefined;
    if (!tag) continue;

    for (let dy = 0; dy < zone.height; dy++) {
      for (let dx = 0; dx < zone.width; dx++) {
        tiles[tileKey(zone.tileX + dx, zone.tileY + dy)] = tag;
      }
    }
  }

  return tiles;
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
