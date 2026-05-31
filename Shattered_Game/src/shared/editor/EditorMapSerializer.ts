import type { MapDefinition, MapPlacedObject, MapZone } from '../map/MapTypes';
import type { ObjectDefinition } from '../../objects/ObjectTypes';
import { assertValidMapShape } from '../map/MapValidation';
import {
  parseEditorEncounterAreas,
  serializeEditorEncounterAreas,
} from './EditorEncounterModel';
import {
  tileKey,
  normalizeElevation,
  EDITOR_WORLD_ZONE_TAGS,
  type EditorMapDefinition,
  type EditorMapExportOptions,
  type EditorTerrainTilePaint,
  type EditorEnemySpawn,
  type EditorNpcAnchor,
  type EditorWorldZoneTag,
} from './EditorMapTypes';
import type { TerrainFamily } from '../map/TerrainTypes';

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
    transitions: map.transitions.map((transition) => ({ ...transition })),
    zones: exportZoneTilesToRects(map.terrainZones, map.width, map.height),
    interactionAnchors: (map.npcAnchors ?? []).map((anchor) => ({
      id: anchor.id,
      interactionType: 'npc' as const,
      tileX: anchor.tileX,
      tileY: anchor.tileY,
      npcDefinitionId: anchor.definitionId,
      text: anchor.definitionId,
    })),
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
      ...(map.encounterAreas.length > 0 ? { editorEncounterAreas: serializeEditorEncounterAreas(map.encounterAreas) } : {}),
      ...(map.chunkNames && Object.keys(map.chunkNames).length > 0 ? { editorChunkNames: map.chunkNames } : {}),
    },
  };

  assertValidMapShape(mapDefinition);
  return mapDefinition;
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
    encounterAreas: parseEditorEncounterAreas(map.metadata?.editorEncounterAreas),
    npcAnchors: parseEditorNpcAnchors(map.interactionAnchors),
    transitions: map.transitions.map((transition) => ({ ...transition })),
  };
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

export function parseEditorMapJson(json: string): MapDefinition {
  const parsed: unknown = JSON.parse(json);
  assertValidMapShape(parsed);
  return parsed;
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

function toMapPlacedObject(object: { id: string; definitionId: string; tileX: number; tileY: number }): MapPlacedObject {
  return {
    id: object.id,
    definitionId: object.definitionId,
    tileX: object.tileX,
    tileY: object.tileY,
  };
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

function parseEditorNpcAnchors(value: unknown): EditorNpcAnchor[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((anchor): EditorNpcAnchor[] => {
    if (!isRecord(anchor)) return [];

    if (
      anchor['interactionType'] !== 'npc' ||
      typeof anchor['id'] !== 'string' ||
      typeof anchor['tileX'] !== 'number' ||
      typeof anchor['tileY'] !== 'number'
    ) {
      return [];
    }

    const definitionId = typeof anchor['npcDefinitionId'] === 'string'
      ? anchor['npcDefinitionId']
      : String(anchor['id']);

    return [{ id: anchor['id'], definitionId, tileX: anchor['tileX'], tileY: anchor['tileY'] }];
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

      let rectWidth = 1;
      while (
        tileX + rectWidth < width &&
        terrainZones[tileKey(tileX + rectWidth, tileY)] === tag &&
        !visited.has(tileKey(tileX + rectWidth, tileY))
      ) {
        rectWidth++;
      }

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
