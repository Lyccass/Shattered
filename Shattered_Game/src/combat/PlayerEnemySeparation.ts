import type { PlayerController } from '../player/PlayerController';
import type { IsoTilemap } from '../world/IsoTilemap';

export function separatePlayerFromEnemyTile({
  tilemap,
  playerController,
  enemyTile,
}: {
  tilemap: IsoTilemap;
  playerController: PlayerController;
  enemyTile: { x: number; y: number } | null;
}): void {
  if (!enemyTile) {
    return;
  }

  const playerTiles = playerController.getFootprintTiles();

  if (!playerTiles.some((tile) => tile.x === enemyTile.x && tile.y === enemyTile.y)) {
    return;
  }

  const enemyCenter = tilemap.getTileCenterWorld(enemyTile.x, enemyTile.y);
  const feet = playerController.getFeetPoint();
  const dx = feet.x - enemyCenter.x;
  const dy = feet.y - enemyCenter.y;
  const horizontal = dx >= 0 ? 1 : -1;
  const vertical = dy >= 0 ? 1 : -1;
  const candidateOffsets: Array<{ x: number; y: number }> = [
    { x: horizontal, y: vertical },
    { x: horizontal, y: 0 },
    { x: 0, y: vertical },
    { x: -horizontal, y: vertical },
    { x: horizontal, y: -vertical },
    { x: -horizontal, y: 0 },
    { x: 0, y: -vertical },
    { x: -horizontal, y: -vertical },
  ];

  for (const offset of candidateOffsets) {
    const tileX = enemyTile.x + offset.x;
    const tileY = enemyTile.y + offset.y;

    if (!tilemap.isTileInBounds(tileX, tileY) || !tilemap.isTileWalkable(tileX, tileY)) {
      continue;
    }

    // Only check terrain here. The enemy occupancy validator would reject
    // nearby escape tiles and can trap the player inside the enemy footprint.
    const candidate = tilemap.getTileCenterWorld(tileX, tileY);
    playerController.setFeetWorldPosition(candidate.x, candidate.y);
    return;
  }
}
