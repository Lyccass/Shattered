import type {
  MapDefinition,
  MapInteractionAnchor,
  MapNpcAnchor,
  MapPlacedObject,
  MapResourceNodeAnchor,
  MapZone,
} from '../map/MapTypes';
import { isTerrainFamily, type TerrainFamily } from '../map/TerrainTypes';
import {
  editorEncounterAreasToHabitats,
  habitatsToEditorEncounterAreas,
  parseEditorEncounterAreas,
} from '../editor/EditorEncounterModel';
import {
  createTerrainPalette,
  decodeTerrainPaletteLayer,
  getExactTerrainPaletteEntry,
  getTerrainPaletteEntryFamily,
  type ExactTerrainPaletteEntry,
  type TerrainPalette,
} from './TerrainPalette';
import type {
  ChunkZoneDefinition,
  NpcAnchorChunkDefinition,
  ResourceNodeDefinition,
  WorldChunkDefinition,
} from './ChunkTypes';

export type MapToChunkOptions = {
  worldId: string;
  regionId: string;
  chunkX?: number;
  chunkY?: number;
  terrainPalette?: TerrainPalette;
};

export function mapDefinitionToSingleWorldChunk(
  map: MapDefinition,
  options: MapToChunkOptions,
): WorldChunkDefinition {
  const encodedTerrain = encodeMapTerrainForWorldChunk(map, options.terrainPalette);
  const metadata = createChunkMetadata(map, encodedTerrain.exactTerrainPaintsByKey);

  return {
    worldId: options.worldId,
    regionId: options.regionId,
    chunkX: options.chunkX ?? 0,
    chunkY: options.chunkY ?? 0,
    width: map.width,
    height: map.height,
    terrainPalette: encodedTerrain.terrainPalette,
    terrain: {
      encoding: 'palette',
      tiles: encodedTerrain.tiles,
    },
    objectLayer: {
      objects: map.objects.map(toStaticObject),
    },
    resourceLayer: {
      nodes: (map.interactionAnchors ?? [])
        .filter((anchor): anchor is MapResourceNodeAnchor => anchor.interactionType === 'resource_node')
        .map(toResourceNode),
    },
    zoneLayer: {
      zones: (map.zones ?? []).map(toChunkZone),
    },
    connectionLayer: {
      transitions: map.transitions.map((transition) => ({ ...transition })),
    },
    habitatLayer: {
      habitats: editorEncounterAreasToHabitats(parseEditorEncounterAreas(map.metadata?.editorEncounterAreas)),
    },
    npcLayer: {
      anchors: (map.interactionAnchors ?? [])
        .filter((a): a is MapNpcAnchor => a.interactionType === 'npc')
        .map((a) => ({
          id: a.id,
          npcDefinitionId: a.npcDefinitionId ?? '',
          tileX: a.tileX,
          tileY: a.tileY,
          ...(a.text ? { text: a.text } : {}),
        })),
    },
    metadata,
  };
}

export function worldChunkDefinitionToMapDefinition(
  chunk: WorldChunkDefinition,
  options: {
    mapId?: string;
    displayName?: string;
  } = {},
): MapDefinition {
  const terrain = chunk.terrain.encoding === 'palette'
    ? decodeTerrainPaletteLayer(chunk.terrainPalette ?? {}, chunk.terrain.tiles)
    : chunk.terrain.tiles.map((row) => [...row]);
  const exactTerrainTiles = chunk.terrain.encoding === 'palette'
    ? decodeExactTerrainTilesFromPaletteLayer(chunk.terrainPalette ?? {}, chunk.terrain.tiles)
    : {};
  const metadata = {
    worldId: chunk.worldId,
    regionId: chunk.regionId,
    chunkX: chunk.chunkX,
    chunkY: chunk.chunkY,
    ...(chunk.metadata ?? {}),
    ...(chunk.habitatLayer.habitats.length > 0
      ? { editorEncounterAreas: habitatsToEditorEncounterAreas(chunk.habitatLayer.habitats) }
      : {}),
    ...(Object.keys(exactTerrainTiles).length > 0
      ? {
        editorTerrainTiles: {
          ...exactTerrainTiles,
          ...(isRecord(chunk.metadata?.editorTerrainTiles) ? chunk.metadata.editorTerrainTiles : {}),
        },
      }
      : {}),
  };

  return {
    id: options.mapId ?? `${chunk.worldId}_${chunk.regionId}_${chunk.chunkX}_${chunk.chunkY}`,
    displayName: options.displayName ?? `${chunk.regionId} ${chunk.chunkX},${chunk.chunkY}`,
    spaceType: 'open_world',
    width: chunk.width,
    height: chunk.height,
    terrain,
    spawnPoints: {
      default: {
        id: 'default',
        tileX: Math.floor(chunk.width / 2),
        tileY: Math.floor(chunk.height / 2),
      },
    },
    objects: chunk.objectLayer.objects.map(toMapObject),
    transitions: chunk.connectionLayer?.transitions.map((transition) => ({ ...transition })) ?? [],
    zones: chunk.zoneLayer.zones.map(toMapZone),
    interactionAnchors: [
      ...chunk.resourceLayer.nodes.map(toMapResourceAnchor),
      ...(chunk.npcLayer?.anchors ?? []).map(toMapNpcAnchor),
    ],
    metadata,
  };
}

function getTerrainFamiliesInMap(map: MapDefinition): TerrainFamily[] {
  return [...new Set(map.terrain.flat())];
}

type RawEditorTerrainPaint = ExactTerrainPaletteEntry & {
  id: string;
};

function encodeMapTerrainForWorldChunk(
  map: MapDefinition,
  basePalette?: TerrainPalette,
): {
  exactTerrainPaintsByKey: Record<string, RawEditorTerrainPaint>;
  terrainPalette: TerrainPalette;
  tiles: number[][];
} {
  const exactTerrainPaintsByKey = parseEditorTerrainPaints(map.metadata?.editorTerrainTiles);
  const terrainPalette: TerrainPalette = { ...(basePalette ?? createTerrainPalette(getTerrainFamiliesInMap(map))) };
  const entryIdByKey = new Map<string, number>();

  for (const [id, entry] of Object.entries(terrainPalette)) {
    entryIdByKey.set(createTerrainPaletteEntryKey(entry), Number(id));
  }

  const nextPaletteId = (): number => {
    const ids = Object.keys(terrainPalette).map((id) => Number.parseInt(id, 10)).filter(Number.isFinite);
    return ids.length > 0 ? Math.max(...ids) + 1 : 0;
  };

  const ensurePaletteId = (entry: TerrainPalette[number]): number => {
    const key = createTerrainPaletteEntryKey(entry);
    const existingId = entryIdByKey.get(key);

    if (existingId !== undefined) {
      return existingId;
    }

    const id = nextPaletteId();
    terrainPalette[id] = entry;
    entryIdByKey.set(key, id);
    return id;
  };

  const tiles = map.terrain.map((row, tileY) =>
    row.map((family, tileX) => {
      const paint = exactTerrainPaintsByKey[tileKey(tileX, tileY)];
      return ensurePaletteId(paint ? toExactTerrainPaletteEntry(paint) : family);
    }),
  );

  return {
    exactTerrainPaintsByKey,
    terrainPalette,
    tiles,
  };
}

function createChunkMetadata(
  map: MapDefinition,
  exactTerrainPaintsByKey: Record<string, RawEditorTerrainPaint>,
): Record<string, unknown> {
  const metadata = { ...(map.metadata ?? {}) };
  delete metadata.editorTerrainTiles;

  const compactWalkability = createCompactTerrainWalkability(
    map,
    exactTerrainPaintsByKey,
    parseBooleanTileRecord(metadata.editorTerrainWalkability),
  );

  if (Object.keys(compactWalkability).length > 0) {
    metadata.editorTerrainWalkability = compactWalkability;
  } else {
    delete metadata.editorTerrainWalkability;
  }

  return {
    sourceMapId: map.id,
    ...metadata,
  };
}

function createCompactTerrainWalkability(
  map: MapDefinition,
  exactTerrainPaintsByKey: Record<string, RawEditorTerrainPaint>,
  terrainWalkability: Record<string, boolean>,
): Record<string, boolean> {
  const compact: Record<string, boolean> = {};

  for (const [key, walkable] of Object.entries(terrainWalkability)) {
    const [tileX, tileY] = parseTileKey(key);
    const terrainFamily = map.terrain[tileY]?.[tileX];

    if (!terrainFamily) {
      continue;
    }

    const expectedWalkable = exactTerrainPaintsByKey[key]?.walkable ?? terrainFamily !== 'water';

    if (walkable !== expectedWalkable) {
      compact[key] = walkable;
    }
  }

  return compact;
}

function decodeExactTerrainTilesFromPaletteLayer(
  terrainPalette: TerrainPalette,
  tiles: number[][],
): Record<string, RawEditorTerrainPaint> {
  const exactTerrainTiles: Record<string, RawEditorTerrainPaint> = {};

  tiles.forEach((row, tileY) => {
    row.forEach((tileId, tileX) => {
      const exactEntry = getExactTerrainPaletteEntry(terrainPalette[tileId]);

      if (!exactEntry) {
        return;
      }

      exactTerrainTiles[tileKey(tileX, tileY)] = fromExactTerrainPaletteEntry(exactEntry);
    });
  });

  return exactTerrainTiles;
}

function parseEditorTerrainPaints(value: unknown): Record<string, RawEditorTerrainPaint> {
  if (!isRecord(value)) {
    return {};
  }

  const paints: Record<string, RawEditorTerrainPaint> = {};

  for (const [key, paint] of Object.entries(value)) {
    if (!isRecord(paint)) {
      continue;
    }

    if (
      typeof paint.id !== 'string' ||
      !isTerrainFamily(paint.family) ||
      typeof paint.textureKey !== 'string'
    ) {
      continue;
    }

    paints[key] = {
      id: paint.id,
      tileId: paint.id,
      family: paint.family,
      textureKey: paint.textureKey,
      ...(typeof paint.category === 'string' ? { category: paint.category } : {}),
      ...(typeof paint.textureOffsetX === 'number' && Number.isFinite(paint.textureOffsetX)
        ? { textureOffsetX: paint.textureOffsetX }
        : {}),
      ...(typeof paint.textureOffsetY === 'number' && Number.isFinite(paint.textureOffsetY)
        ? { textureOffsetY: paint.textureOffsetY }
        : {}),
      ...(typeof paint.textureScale === 'number' && Number.isFinite(paint.textureScale) && paint.textureScale > 0
        ? { textureScale: paint.textureScale }
        : {}),
      walkable: typeof paint.walkable === 'boolean' ? paint.walkable : paint.family !== 'water',
      flipX: paint.flipX === true,
      flipY: paint.flipY === true,
    };
  }

  return paints;
}

function parseBooleanTileRecord(value: unknown): Record<string, boolean> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
  );
}

function toExactTerrainPaletteEntry(paint: RawEditorTerrainPaint): ExactTerrainPaletteEntry {
  return {
    family: paint.family,
    tileId: paint.id,
    textureKey: paint.textureKey,
    ...(paint.category ? { category: paint.category } : {}),
    ...(paint.textureOffsetX !== undefined ? { textureOffsetX: paint.textureOffsetX } : {}),
    ...(paint.textureOffsetY !== undefined ? { textureOffsetY: paint.textureOffsetY } : {}),
    ...(paint.textureScale !== undefined ? { textureScale: paint.textureScale } : {}),
    walkable: paint.walkable,
    flipX: paint.flipX,
    flipY: paint.flipY,
  };
}

function fromExactTerrainPaletteEntry(entry: ExactTerrainPaletteEntry): RawEditorTerrainPaint {
  return {
    id: entry.tileId,
    tileId: entry.tileId,
    family: entry.family,
    textureKey: entry.textureKey,
    ...(entry.category ? { category: entry.category } : {}),
    ...(entry.textureOffsetX !== undefined ? { textureOffsetX: entry.textureOffsetX } : {}),
    ...(entry.textureOffsetY !== undefined ? { textureOffsetY: entry.textureOffsetY } : {}),
    ...(entry.textureScale !== undefined ? { textureScale: entry.textureScale } : {}),
    walkable: entry.walkable ?? entry.family !== 'water',
    flipX: entry.flipX === true,
    flipY: entry.flipY === true,
  };
}

function createTerrainPaletteEntryKey(entry: TerrainPalette[number]): string {
  const exactEntry = getExactTerrainPaletteEntry(entry);

  if (!exactEntry) {
    return `family:${getTerrainPaletteEntryFamily(entry)}`;
  }

  return JSON.stringify(toExactTerrainPaletteEntry(fromExactTerrainPaletteEntry(exactEntry)));
}

function tileKey(tileX: number, tileY: number): string {
  return `${tileX},${tileY}`;
}

function parseTileKey(key: string): [number, number] {
  const [tileX, tileY] = key.split(',').map((part) => Number.parseInt(part, 10));
  return [Number.isFinite(tileX) ? tileX : -1, Number.isFinite(tileY) ? tileY : -1];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toStaticObject(object: MapPlacedObject) {
  return {
    id: object.id,
    definitionId: object.definitionId,
    tileX: object.tileX,
    tileY: object.tileY,
    orientation: object.orientation,
    state: object.state,
  };
}

function toResourceNode(anchor: MapResourceNodeAnchor): ResourceNodeDefinition {
  return {
    id: anchor.id,
    resourceDefinitionId: anchor.resourceNodeType,
    tileX: anchor.tileX,
    tileY: anchor.tileY,
  };
}

function toChunkZone(zone: MapZone): ChunkZoneDefinition {
  return {
    id: zone.id,
    tileX: zone.tileX,
    tileY: zone.tileY,
    width: zone.width,
    height: zone.height,
    tags: [...zone.tags],
  };
}

function toMapObject(object: {
  id: string;
  definitionId: string;
  tileX: number;
  tileY: number;
  orientation?: string;
  state?: Record<string, unknown>;
}): MapPlacedObject {
  return {
    id: object.id,
    definitionId: object.definitionId,
    tileX: object.tileX,
    tileY: object.tileY,
    orientation: object.orientation,
    state: object.state,
  };
}

function toMapZone(zone: ChunkZoneDefinition): MapZone {
  return {
    id: zone.id,
    tileX: zone.tileX,
    tileY: zone.tileY,
    width: zone.width,
    height: zone.height,
    tags: zone.tags as MapZone['tags'],
  };
}

function toMapResourceAnchor(node: ResourceNodeDefinition): MapInteractionAnchor {
  return {
    id: node.id,
    interactionType: 'resource_node',
    resourceNodeType: node.resourceDefinitionId as MapResourceNodeAnchor['resourceNodeType'],
    tileX: node.tileX,
    tileY: node.tileY,
  };
}

function toMapNpcAnchor(anchor: NpcAnchorChunkDefinition): MapNpcAnchor {
  return {
    id: anchor.id,
    interactionType: 'npc',
    npcDefinitionId: anchor.npcDefinitionId,
    text: anchor.text ?? anchor.npcDefinitionId,
    tileX: anchor.tileX,
    tileY: anchor.tileY,
  };
}
