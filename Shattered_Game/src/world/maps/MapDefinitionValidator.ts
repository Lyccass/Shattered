import {
  evaluateStaticObjectPlacement,
  formatMapObjectPlacementError,
} from '../../objects/ObjectPlacementPolicy';
import { ObjectRegistry } from '../../objects/ObjectRegistry';
import type { ObjectDefinition } from '../../objects/ObjectTypes';
import { getTransitionFootprintTiles } from './MapTransitionSystem';
import type {
  MapDefinition,
  MapInteractionAnchor,
  MapPlacedObject,
  MapTransition,
} from './MapTypes';

export function validateMapDefinition(
  mapDefinition: MapDefinition,
  objectDefinitions: readonly ObjectDefinition[],
): void {
  const registry = new ObjectRegistry(objectDefinitions);
  const occupiedTiles = new Map<string, string>();
  const objectIds = new Set(mapDefinition.objects.map((placedObject) => placedObject.id));

  mapDefinition.objects.forEach((placedObject) => {
    const objectDefinition = getMapObjectDefinition(registry, mapDefinition.id, placedObject);
    const evaluation = evaluateStaticObjectPlacement(
      {
        isTileInBounds: (tileX, tileY) =>
          tileX >= 0 &&
          tileY >= 0 &&
          tileX < mapDefinition.width &&
          tileY < mapDefinition.height,
        isTerrainBlocked: (tileX, tileY) => mapDefinition.terrain[tileY][tileX] === 'water',
        getOccupyingObjectId: (tileX, tileY) => occupiedTiles.get(tileKey(tileX, tileY)) ?? null,
      },
      objectDefinition,
      placedObject.tileX,
      placedObject.tileY,
    );

    if (!evaluation.ok) {
      throw new Error(
        formatMapObjectPlacementError({
          mapId: mapDefinition.id,
          objectId: placedObject.id,
          definitionId: placedObject.definitionId,
          tileX: placedObject.tileX,
          tileY: placedObject.tileY,
          failure: evaluation.failure,
        }),
      );
    }

    evaluation.footprintTiles.forEach((tile) => {
      occupiedTiles.set(tileKey(tile.x, tile.y), placedObject.id);
    });
  });

  mapDefinition.transitions.forEach((transition) => {
    validateTransition(mapDefinition, transition, occupiedTiles);
  });

  (mapDefinition.interactionAnchors ?? []).forEach((interactionAnchor) => {
    validateInteractionAnchor(mapDefinition, interactionAnchor, occupiedTiles, objectIds);
  });
}

export function validateMapDefinitions(
  mapDefinitions: readonly MapDefinition[],
  objectDefinitions: readonly ObjectDefinition[],
): void {
  mapDefinitions.forEach((mapDefinition) => {
    validateMapDefinition(mapDefinition, objectDefinitions);
  });
}

function getMapObjectDefinition(
  registry: ObjectRegistry,
  mapId: string,
  placedObject: MapPlacedObject,
): ObjectDefinition {
  try {
    return registry.get(placedObject.definitionId);
  } catch {
    throw new Error(
      `Map "${mapId}": object "${placedObject.id}" references unknown definition "${placedObject.definitionId}". Suggested fix: use a valid id from ObjectDefinitions.ts.`,
    );
  }
}

function validateTransition(
  mapDefinition: MapDefinition,
  transition: MapTransition,
  occupiedTiles: Map<string, string>,
): void {
  const footprintTiles = getTransitionFootprintTiles(transition);

  footprintTiles.forEach((tile) => {
    if (
      tile.x < 0 ||
      tile.y < 0 ||
      tile.x >= mapDefinition.width ||
      tile.y >= mapDefinition.height
    ) {
      throw new Error(
        `Map "${mapDefinition.id}": transition "${transition.id}" uses trigger tile ${tile.x},${tile.y} outside the map bounds. Suggested fix: move the transition footprint fully inside the map.`,
      );
    }

    const blockingObjectId = occupiedTiles.get(tileKey(tile.x, tile.y));

    if (blockingObjectId) {
      throw new Error(
        `Map "${mapDefinition.id}": transition "${transition.id}" overlaps object "${blockingObjectId}" at tile ${tile.x},${tile.y}. Suggested fix: move the transition trigger onto clear walkable tiles.`,
      );
    }
  });

  if (!transition.visualAnchor) {
    return;
  }

  const visualAnchorKey = tileKey(transition.visualAnchor.tileX, transition.visualAnchor.tileY);
  const anchorObjectId = occupiedTiles.get(visualAnchorKey);

  if (anchorObjectId) {
    throw new Error(
      `Map "${mapDefinition.id}": transition "${transition.id}" uses visual anchor tile ${transition.visualAnchor.tileX},${transition.visualAnchor.tileY} on object "${anchorObjectId}". Suggested fix: move the anchor onto a clear trigger tile.`,
    );
  }

  const anchorIsTriggerTile = footprintTiles.some(
    (tile) =>
      tile.x === transition.visualAnchor?.tileX && tile.y === transition.visualAnchor?.tileY,
  );

  if (!anchorIsTriggerTile) {
    throw new Error(
      `Map "${mapDefinition.id}": transition "${transition.id}" has visual anchor ${transition.visualAnchor.tileX},${transition.visualAnchor.tileY} outside its trigger footprint. Suggested fix: keep the visible anchor on one of the actual trigger tiles.`,
    );
  }
}

function validateInteractionAnchor(
  mapDefinition: MapDefinition,
  interactionAnchor: MapInteractionAnchor,
  occupiedTiles: Map<string, string>,
  objectIds: Set<string>,
): void {
  if (
    interactionAnchor.tileX < 0 ||
    interactionAnchor.tileY < 0 ||
    interactionAnchor.tileX >= mapDefinition.width ||
    interactionAnchor.tileY >= mapDefinition.height
  ) {
    throw new Error(
      `Map "${mapDefinition.id}": interaction anchor "${interactionAnchor.id}" uses tile ${interactionAnchor.tileX},${interactionAnchor.tileY} outside the map bounds. Suggested fix: move the anchor inside the map.`,
    );
  }

  if (interactionAnchor.linkedObjectId && !objectIds.has(interactionAnchor.linkedObjectId)) {
    throw new Error(
      `Map "${mapDefinition.id}": interaction anchor "${interactionAnchor.id}" references unknown linked object "${interactionAnchor.linkedObjectId}". Suggested fix: link it to a valid placed object id on the same map.`,
    );
  }

  if (interactionAnchor.interactionType !== 'workbench') {
    return;
  }

  const { buildTileX, buildTileY } = interactionAnchor;

  if (
    buildTileX < 0 ||
    buildTileY < 0 ||
    buildTileX >= mapDefinition.width ||
    buildTileY >= mapDefinition.height
  ) {
    throw new Error(
      `Map "${mapDefinition.id}": workbench "${interactionAnchor.id}" uses build tile ${buildTileX},${buildTileY} outside the map bounds. Suggested fix: move the build target tile inside the map.`,
    );
  }

  if (mapDefinition.terrain[buildTileY][buildTileX] === 'water') {
    throw new Error(
      `Map "${mapDefinition.id}": workbench "${interactionAnchor.id}" uses build tile ${buildTileX},${buildTileY} on water. Suggested fix: move the build target tile onto walkable land.`,
    );
  }

  const occupyingObjectId = occupiedTiles.get(tileKey(buildTileX, buildTileY));

  if (occupyingObjectId) {
    throw new Error(
      `Map "${mapDefinition.id}": workbench "${interactionAnchor.id}" uses build tile ${buildTileX},${buildTileY} already occupied by object "${occupyingObjectId}". Suggested fix: move the build target tile onto a clear tile.`,
    );
  }
}

function tileKey(tileX: number, tileY: number): string {
  return `${tileX},${tileY}`;
}
