import type {
  MapDefinition,
  MapInteractionAnchor,
  MapPlacedObject,
  MapResourceNodeAnchor,
  MapZone,
} from '../map/MapTypes';
import type { TerrainFamily } from '../map/TerrainTypes';
import {
  createTerrainPalette,
  decodeTerrainPaletteLayer,
  encodeTerrainPaletteLayer,
  type TerrainPalette,
} from './TerrainPalette';
import type {
  ChunkZoneDefinition,
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
  const terrainPalette = options.terrainPalette ?? createTerrainPalette(getTerrainFamiliesInMap(map));

  return {
    worldId: options.worldId,
    regionId: options.regionId,
    chunkX: options.chunkX ?? 0,
    chunkY: options.chunkY ?? 0,
    width: map.width,
    height: map.height,
    terrainPalette,
    terrain: {
      encoding: 'palette',
      tiles: encodeTerrainPaletteLayer(map.terrain, terrainPalette),
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
      habitats: [],
    },
    metadata: {
      sourceMapId: map.id,
      ...(map.metadata ?? {}),
    },
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
    interactionAnchors: chunk.resourceLayer.nodes.map(toMapResourceAnchor),
    metadata: {
      worldId: chunk.worldId,
      regionId: chunk.regionId,
      chunkX: chunk.chunkX,
      chunkY: chunk.chunkY,
      ...(chunk.metadata ?? {}),
    },
  };
}

function getTerrainFamiliesInMap(map: MapDefinition): TerrainFamily[] {
  return [...new Set(map.terrain.flat())];
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
