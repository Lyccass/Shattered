import {
  createEditorMap,
  createEditorMapFromWorldChunkDefinition,
  exportEditorMapToWorldChunkDefinition,
  type EditorMapDefinition,
  type EditorTerrainTilePaint,
} from '../../shared/editor/EditorMapModel';
import type { ChunkCoordinate } from '../../shared/world/ChunkKey';
import { createTerrainPalette } from '../../shared/world/TerrainPalette';
import { validateWorldChunkDefinition } from '../../shared/world/ChunkValidation';
import type { WorldChunkDefinition } from '../../shared/world/ChunkTypes';

export type EditorDirtyChunkBundleV1 = {
  version: 1;
  sourceMapId: string;
  exportedAt: string;
  chunkSize: number;
  worldId: string;
  regionId: string;
  chunks: WorldChunkDefinition[];
};

export type DirtyChunkExportOptions = {
  chunkSize: number;
  exportedAt?: string;
  originChunkX?: number;
  originChunkY?: number;
  regionId: string;
  sourceMapId?: string;
  worldId: string;
};

export function createDirtyChunkBundle(
  map: EditorMapDefinition,
  dirtyChunks: ChunkCoordinate[],
  options: DirtyChunkExportOptions,
): EditorDirtyChunkBundleV1 {
  const chunks = dirtyChunks
    .map((coordinate) => createChunkMapSlice(map, coordinate, options.chunkSize))
    .filter((slice): slice is EditorChunkMapSlice => slice !== null)
    .map(({ coordinate, map: chunkMap }) => exportEditorMapToWorldChunkDefinition(chunkMap, {
      chunkX: coordinate.chunkX + (options.originChunkX ?? 0),
      chunkY: coordinate.chunkY + (options.originChunkY ?? 0),
      regionId: options.regionId,
      terrainPalette: createTerrainPalette([...new Set(chunkMap.terrain.flat())]),
      worldId: options.worldId,
    }));

  return {
    version: 1,
    sourceMapId: options.sourceMapId ?? map.id,
    exportedAt: options.exportedAt ?? new Date().toISOString(),
    chunkSize: options.chunkSize,
    worldId: options.worldId,
    regionId: options.regionId,
    chunks,
  };
}

export function applyDirtyChunkBundle(
  map: EditorMapDefinition,
  bundle: EditorDirtyChunkBundleV1,
): EditorMapDefinition {
  validateDirtyChunkBundle(bundle);

  let nextMap = map;

  for (const chunk of bundle.chunks) {
    nextMap = applyChunk(nextMap, chunk, bundle.chunkSize);
  }

  return nextMap;
}

export function parseDirtyChunkBundleJson(json: string): EditorDirtyChunkBundleV1 {
  const parsed: unknown = JSON.parse(json);
  validateDirtyChunkBundle(parsed);
  return parsed;
}

type EditorChunkMapSlice = {
  coordinate: ChunkCoordinate;
  map: EditorMapDefinition;
};

function createChunkMapSlice(
  map: EditorMapDefinition,
  coordinate: ChunkCoordinate,
  chunkSize: number,
): EditorChunkMapSlice | null {
  const startX = coordinate.chunkX * chunkSize;
  const startY = coordinate.chunkY * chunkSize;
  const width = Math.min(chunkSize, map.width - startX);
  const height = Math.min(chunkSize, map.height - startY);

  if (width <= 0 || height <= 0) {
    return null;
  }

  const fallbackPaint = getFirstPaint(map);
  const chunkMap = createEditorMap(
    width,
    height,
    map.terrain[startY]?.[startX] ?? fallbackPaint.family,
    `${map.id}_chunk_${coordinate.chunkX}_${coordinate.chunkY}`,
    `${map.displayName} chunk ${coordinate.chunkX},${coordinate.chunkY}`,
    fallbackPaint,
  );

  chunkMap.terrain = Array.from({ length: height }, (_, localY) =>
    Array.from({ length: width }, (_, localX) => map.terrain[startY + localY][startX + localX]),
  );
  chunkMap.terrainTiles = {};
  chunkMap.terrainWalkability = {};
  chunkMap.terrainElevation = {};

  for (let localY = 0; localY < height; localY += 1) {
    for (let localX = 0; localX < width; localX += 1) {
      const sourceKey = tileKey(startX + localX, startY + localY);
      const localKey = tileKey(localX, localY);
      const paint = map.terrainTiles[tileKey(startX + localX, startY + localY)];

      if (paint) {
        chunkMap.terrainTiles[localKey] = { ...paint };
      }

      if (map.terrainWalkability[sourceKey] !== undefined) {
        chunkMap.terrainWalkability[localKey] = map.terrainWalkability[sourceKey];
      }

      if (map.terrainElevation[sourceKey] !== undefined) {
        chunkMap.terrainElevation[localKey] = map.terrainElevation[sourceKey];
      }
    }
  }

  chunkMap.objects = map.objects
    .filter((object) => isInsideRect(object.tileX, object.tileY, startX, startY, width, height))
    .map((object) => ({
      ...object,
      tileX: object.tileX - startX,
      tileY: object.tileY - startY,
    }));
  const chunkObjectDefinitionIds = new Set(chunkMap.objects.map((object) => object.definitionId));
  chunkMap.customObjectDefinitions = map.customObjectDefinitions
    .filter((definition) => chunkObjectDefinitionIds.has(definition.id));
  chunkMap.enemySpawns = map.enemySpawns
    .filter((spawn) => isInsideRect(spawn.tileX, spawn.tileY, startX, startY, width, height))
    .map((spawn) => ({
      ...spawn,
      tileX: spawn.tileX - startX,
      tileY: spawn.tileY - startY,
    }));

  return {
    coordinate,
    map: chunkMap,
  };
}

function applyChunk(
  map: EditorMapDefinition,
  chunk: WorldChunkDefinition,
  chunkSize: number,
): EditorMapDefinition {
  const validation = validateWorldChunkDefinition(chunk);

  if (!validation.ok) {
    throw new Error(validation.errors.join('\n'));
  }

  const chunkMap = createEditorMapFromWorldChunkDefinition(chunk);
  const startX = chunk.chunkX * chunkSize;
  const startY = chunk.chunkY * chunkSize;

  if (
    startX < 0 ||
    startY < 0 ||
    startX + chunkMap.width > map.width ||
    startY + chunkMap.height > map.height
  ) {
    throw new Error(`Dirty chunk ${chunk.chunkX},${chunk.chunkY} does not fit current map.`);
  }

  const terrain = map.terrain.map((row) => [...row]);
  const terrainTiles = { ...map.terrainTiles };
  const terrainWalkability = { ...map.terrainWalkability };
  const terrainElevation = { ...map.terrainElevation };

  for (let localY = 0; localY < chunkMap.height; localY += 1) {
    for (let localX = 0; localX < chunkMap.width; localX += 1) {
      terrain[startY + localY][startX + localX] = chunkMap.terrain[localY][localX];
      const absoluteKey = tileKey(startX + localX, startY + localY);
      const localKey = tileKey(localX, localY);
      const paint = chunkMap.terrainTiles[tileKey(localX, localY)];

      if (paint) {
        terrainTiles[absoluteKey] = { ...paint };
      } else {
        delete terrainTiles[absoluteKey];
      }

      if (chunkMap.terrainWalkability[localKey] !== undefined) {
        terrainWalkability[absoluteKey] = chunkMap.terrainWalkability[localKey];
      } else {
        delete terrainWalkability[absoluteKey];
      }

      if (chunkMap.terrainElevation[localKey] !== undefined) {
        terrainElevation[absoluteKey] = chunkMap.terrainElevation[localKey];
      } else {
        delete terrainElevation[absoluteKey];
      }
    }
  }

  return {
    ...map,
    terrain,
    terrainTiles,
    terrainWalkability,
    terrainElevation,
    customObjectDefinitions: mergeById(map.customObjectDefinitions, chunkMap.customObjectDefinitions),
    customTerrainBrushes: mergeById(map.customTerrainBrushes, chunkMap.customTerrainBrushes),
    objects: [
      ...map.objects.filter((object) =>
        !isInsideRect(object.tileX, object.tileY, startX, startY, chunkMap.width, chunkMap.height),
      ),
      ...chunkMap.objects.map((object) => ({
        ...object,
        tileX: object.tileX + startX,
        tileY: object.tileY + startY,
      })),
    ],
    enemySpawns: [
      ...map.enemySpawns.filter((spawn) =>
        !isInsideRect(spawn.tileX, spawn.tileY, startX, startY, chunkMap.width, chunkMap.height),
      ),
      ...chunkMap.enemySpawns.map((spawn) => ({
        ...spawn,
        tileX: spawn.tileX + startX,
        tileY: spawn.tileY + startY,
      })),
    ],
  };
}

function validateDirtyChunkBundle(value: unknown): asserts value is EditorDirtyChunkBundleV1 {
  const record = value as Record<string, unknown>;

  if (
    typeof value !== 'object' ||
    value === null ||
    record.version !== 1 ||
    !Number.isInteger(record.chunkSize) ||
    Number(record.chunkSize) <= 0 ||
    !Array.isArray(record.chunks)
  ) {
    throw new Error('Invalid dirty chunk bundle.');
  }

  for (const chunk of record.chunks) {
    const validation = validateWorldChunkDefinition(chunk);

    if (!validation.ok) {
      throw new Error(validation.errors.join('\n'));
    }
  }
}

function getFirstPaint(map: EditorMapDefinition): EditorTerrainTilePaint {
  const firstPaint = Object.values(map.terrainTiles)[0];

  if (firstPaint) {
    return firstPaint;
  }

  return {
    id: map.terrain[0]?.[0] ?? 'grass',
    family: map.terrain[0]?.[0] ?? 'grass',
    textureKey: map.terrain[0]?.[0] ?? 'grass',
    walkable: (map.terrain[0]?.[0] ?? 'grass') !== 'water',
    flipX: false,
    flipY: false,
  };
}

function mergeById<T extends { id: string }>(first: T[], second: T[]): T[] {
  const merged = new Map<string, T>();

  for (const item of first) {
    merged.set(item.id, item);
  }

  for (const item of second) {
    merged.set(item.id, item);
  }

  return Array.from(merged.values());
}

function isInsideRect(
  tileX: number,
  tileY: number,
  rectX: number,
  rectY: number,
  width: number,
  height: number,
): boolean {
  return tileX >= rectX && tileY >= rectY && tileX < rectX + width && tileY < rectY + height;
}

function tileKey(tileX: number, tileY: number): string {
  return `${tileX},${tileY}`;
}
