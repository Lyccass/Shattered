import { PROTOTYPE_SCALE } from '../config/prototypeScale';
import { getMapDefinition, listMapIds } from '../world/maps/MapDefinitions';
import type { MapResourceNodeAnchor } from '../world/maps/MapTypes';

export type ResourceNodeChunkLocation = {
  regionId: string;
  chunkKey: string;
};

export type ResourceNodeChunkLocator = (
  mapId: string,
  nodeId: string,
) => ResourceNodeChunkLocation | null;

export function createWorldChunkKey(
  tileX: number,
  tileY: number,
  chunkSize = PROTOTYPE_SCALE.terrainChunkSize,
): string {
  const chunkX = Math.floor(tileX / chunkSize);
  const chunkY = Math.floor(tileY / chunkSize);
  return `${chunkX},${chunkY}`;
}

export function createStaticWorldResourceNodeChunkLocator(): ResourceNodeChunkLocator {
  const locationIndex = new Map<string, Map<string, ResourceNodeChunkLocation>>();

  listMapIds().forEach((mapId) => {
    const definition = getMapDefinition(mapId);
    const mapLocations = new Map<string, ResourceNodeChunkLocation>();

    (definition.interactionAnchors ?? [])
      .filter((anchor): anchor is MapResourceNodeAnchor => anchor.interactionType === 'resource_node')
      .forEach((anchor) => {
        mapLocations.set(anchor.id, {
          regionId: mapId,
          chunkKey: createWorldChunkKey(anchor.tileX, anchor.tileY),
        });
      });

    locationIndex.set(mapId, mapLocations);
  });

  return (mapId: string, nodeId: string): ResourceNodeChunkLocation | null => {
    return locationIndex.get(mapId)?.get(nodeId) ?? null;
  };
}
