import Phaser from 'phaser';
import { IsoTransform } from '../world/IsoTransform';
import type { DepthAnchorMode, ObjectDefinition, ObjectInstance } from './ObjectTypes';

export function getObjectDepthAnchorWorld(
  transform: IsoTransform,
  instance: ObjectInstance,
  definition: ObjectDefinition,
): Phaser.Math.Vector2 {
  const footprint = definition.collisionFootprint.length > 0
    ? definition.collisionFootprint
    : [{ x: 0, y: 0 }];
  const anchor = getFootprintAnchorWorld(
    transform,
    instance,
    footprint,
    definition.depth.anchorMode,
  );

  return new Phaser.Math.Vector2(
    anchor.x + definition.depth.localOffsetX,
    anchor.y + definition.depth.localOffsetY,
  );
}

function getFootprintAnchorWorld(
  transform: IsoTransform,
  instance: ObjectInstance,
  footprint: ObjectDefinition['collisionFootprint'],
  anchorMode: DepthAnchorMode,
): Phaser.Math.Vector2 {
  if (anchorMode === 'frontEdge') {
    return getFootprintFrontEdgeWorld(transform, instance, footprint);
  }

  if (anchorMode === 'frontTileCenter') {
    return getFrontTileCenterWorld(transform, instance, footprint);
  }

  return getFootprintCentroidWorld(transform, instance, footprint);
}

function getFootprintCentroidWorld(
  transform: IsoTransform,
  instance: ObjectInstance,
  footprint: ObjectDefinition['collisionFootprint'],
): Phaser.Math.Vector2 {
  let sumX = 0;
  let sumY = 0;

  for (const offset of footprint) {
    sumX += offset.x;
    sumY += offset.y;
  }

  return transform.getTileCenterWorld(
    instance.tileX + sumX / footprint.length,
    instance.tileY + sumY / footprint.length,
  );
}

function getFrontTileCenterWorld(
  transform: IsoTransform,
  instance: ObjectInstance,
  footprint: ObjectDefinition['collisionFootprint'],
): Phaser.Math.Vector2 {
  const frontMost = footprint.reduce((best, offset) => {
    const bestDepth = best.x + best.y;
    const offsetDepth = offset.x + offset.y;

    return offsetDepth > bestDepth ? offset : best;
  }, footprint[0]);

  return transform.getTileCenterWorld(
    instance.tileX + frontMost.x,
    instance.tileY + frontMost.y,
  );
}

function getFootprintFrontEdgeWorld(
  transform: IsoTransform,
  instance: ObjectInstance,
  footprint: ObjectDefinition['collisionFootprint'],
): Phaser.Math.Vector2 {
  let frontY = Number.NEGATIVE_INFINITY;
  let xAtFront = 0;
  let frontPointCount = 0;

  for (const offset of footprint) {
    const points = transform.getTileDiamondPoints(
      instance.tileX + offset.x,
      instance.tileY + offset.y,
    );

    for (const point of points) {
      if (point.y > frontY) {
        frontY = point.y;
        xAtFront = point.x;
        frontPointCount = 1;
        continue;
      }

      if (point.y === frontY) {
        xAtFront += point.x;
        frontPointCount += 1;
      }
    }
  }

  return new Phaser.Math.Vector2(xAtFront / frontPointCount, frontY);
}
