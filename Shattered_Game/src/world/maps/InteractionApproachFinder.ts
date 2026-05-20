import Phaser from 'phaser';
import type { InteractionTarget } from '../../interactions/InteractionTypes';
import type { LoadedMapRuntime } from './MapRuntime';

type InteractionApproachFinderArgs = {
  runtime: LoadedMapRuntime;
  playerTile: { x: number; y: number };
  target: InteractionTarget;
};

export function findInteractionApproachWorldPoint({
  runtime,
  playerTile,
  target,
}: InteractionApproachFinderArgs): Phaser.Math.Vector2 | null {
  const interactionRangeTiles = target.definition.interactionRangeTiles;
  let bestTile: { tileX: number; tileY: number; distanceTiles: number } | null = null;

  for (const tile of target.tiles) {
    for (let offsetY = -interactionRangeTiles; offsetY <= interactionRangeTiles; offsetY += 1) {
      for (let offsetX = -interactionRangeTiles; offsetX <= interactionRangeTiles; offsetX += 1) {
        if (Math.abs(offsetX) + Math.abs(offsetY) > interactionRangeTiles) {
          continue;
        }

        const candidateTileX = tile.x + offsetX;
        const candidateTileY = tile.y + offsetY;

        if (
          !runtime.isoTilemap.isTileInBounds(candidateTileX, candidateTileY)
          || !runtime.isoTilemap.isTileWalkable(candidateTileX, candidateTileY)
        ) {
          continue;
        }

        const distanceTiles =
          Math.abs(candidateTileX - playerTile.x) + Math.abs(candidateTileY - playerTile.y);

        if (
          !bestTile
          || distanceTiles < bestTile.distanceTiles
          || (
            distanceTiles === bestTile.distanceTiles
            && (
              candidateTileY < bestTile.tileY
              || (candidateTileY === bestTile.tileY && candidateTileX < bestTile.tileX)
            )
          )
        ) {
          bestTile = {
            tileX: candidateTileX,
            tileY: candidateTileY,
            distanceTiles,
          };
        }
      }
    }
  }

  if (!bestTile) {
    return null;
  }

  return runtime.isoTilemap.transform.getTileCenterWorld(bestTile.tileX, bestTile.tileY);
}
