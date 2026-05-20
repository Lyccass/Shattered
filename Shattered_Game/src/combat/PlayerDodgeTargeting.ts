import type { PlayerController } from '../player/PlayerController';
import type { IsoTilemap } from '../world/IsoTilemap';
import type { CombatDodgeDirection } from './CombatDodge';
import { snapToIsometricGridDirection } from './CombatGridDirection';

export type ResolvedDodgeMotion = {
  direction: CombatDodgeDirection;
  distance: number;
  tileCount: number;
};

export function resolveTileDodgeMotion({
  tilemap,
  playerController,
  direction,
  requestedTileCount,
}: {
  tilemap: IsoTilemap;
  playerController: PlayerController;
  direction: CombatDodgeDirection;
  requestedTileCount: number;
}): ResolvedDodgeMotion | null {
  const aimAngle = Math.atan2(direction.y, direction.x);
  const [dgx, dgy] = snapToIsometricGridDirection(
    aimAngle,
    tilemap.tileWidth,
    tilemap.tileHeight,
  );
  const playerFeet = playerController.getFeetPoint();
  const playerTile = tilemap.transform.worldToTile(playerFeet.x, playerFeet.y);
  let finalTileX = playerTile.x;
  let finalTileY = playerTile.y;
  let resolvedTileCount = 0;

  for (let step = 1; step <= requestedTileCount; step++) {
    const tx = playerTile.x + dgx * step;
    const ty = playerTile.y + dgy * step;

    if (!tilemap.isTileInBounds(tx, ty) || !tilemap.isTileWalkable(tx, ty)) {
      break;
    }

    const center = tilemap.getTileCenterWorld(tx, ty);

    if (!playerController.canOccupyFeetPosition(center.x, center.y)) {
      break;
    }

    finalTileX = tx;
    finalTileY = ty;
    resolvedTileCount = step;
  }

  if (resolvedTileCount <= 0) {
    return null;
  }

  const targetCenter = tilemap.getTileCenterWorld(finalTileX, finalTileY);
  const dodgeDir = {
    x: targetCenter.x - playerFeet.x,
    y: targetCenter.y - playerFeet.y,
  };
  const dodgeDistance = Math.hypot(dodgeDir.x, dodgeDir.y);

  if (dodgeDistance <= 0.001) {
    return null;
  }

  return {
    direction: dodgeDir,
    distance: dodgeDistance,
    tileCount: resolvedTileCount,
  };
}
