import { ObjectRegistry } from '../../objects/ObjectRegistry';
import type { ObjectDefinition } from '../../objects/ObjectTypes';
import { getTransitionFootprintTiles } from './MapTransitionSystem';
import type { MapDefinition } from './MapTypes';

export function validateMapDefinitions(
  mapDefinitions: readonly MapDefinition[],
  objectDefinitions: readonly ObjectDefinition[],
): void {
  const registry = new ObjectRegistry(objectDefinitions);

  mapDefinitions.forEach((mapDefinition) => {
    const occupiedTiles = new Map<string, string>();

    mapDefinition.objects.forEach((placedObject) => {
      const objectDefinition = registry.get(placedObject.definitionId);

      objectDefinition.collisionFootprint.forEach((offset) => {
        const tileX = placedObject.tileX + offset.x;
        const tileY = placedObject.tileY + offset.y;
        const key = tileKey(tileX, tileY);
        const existingObjectId = occupiedTiles.get(key);

        if (
          tileX < 0 ||
          tileY < 0 ||
          tileX >= mapDefinition.width ||
          tileY >= mapDefinition.height
        ) {
          throw new Error(
            `MapDefinitions: object "${placedObject.id}" in map "${mapDefinition.id}" is out of bounds at (${tileX}, ${tileY})`,
          );
        }

        if (mapDefinition.terrain[tileY][tileX] === 'water') {
          throw new Error(
            `MapDefinitions: object "${placedObject.id}" in map "${mapDefinition.id}" blocks water at (${tileX}, ${tileY})`,
          );
        }

        if (existingObjectId) {
          throw new Error(
            `MapDefinitions: object "${placedObject.id}" in map "${mapDefinition.id}" overlaps object "${existingObjectId}" at (${tileX}, ${tileY})`,
          );
        }

        occupiedTiles.set(key, placedObject.id);
      });
    });

    mapDefinition.transitions.forEach((transition) => {
      getTransitionFootprintTiles(transition).forEach((tile) => {
        const blockingObjectId = occupiedTiles.get(tileKey(tile.x, tile.y));

        if (blockingObjectId) {
          throw new Error(
            `MapDefinitions: transition "${transition.id}" in map "${mapDefinition.id}" overlaps object "${blockingObjectId}" at (${tile.x}, ${tile.y})`,
          );
        }
      });

      if (transition.visualAnchor) {
        const visualAnchorKey = tileKey(transition.visualAnchor.tileX, transition.visualAnchor.tileY);
        const anchorObjectId = occupiedTiles.get(visualAnchorKey);

        if (anchorObjectId) {
          throw new Error(
            `MapDefinitions: transition "${transition.id}" in map "${mapDefinition.id}" uses visual anchor on object "${anchorObjectId}" at (${transition.visualAnchor.tileX}, ${transition.visualAnchor.tileY})`,
          );
        }

        const anchorIsTriggerTile = getTransitionFootprintTiles(transition).some(
          (tile) => tile.x === transition.visualAnchor?.tileX && tile.y === transition.visualAnchor?.tileY,
        );

        if (!anchorIsTriggerTile) {
          throw new Error(
            `MapDefinitions: transition "${transition.id}" in map "${mapDefinition.id}" has visual anchor (${transition.visualAnchor.tileX}, ${transition.visualAnchor.tileY}) outside its trigger footprint`,
          );
        }
      }
    });
  });
}

function tileKey(tileX: number, tileY: number): string {
  return `${tileX},${tileY}`;
}
