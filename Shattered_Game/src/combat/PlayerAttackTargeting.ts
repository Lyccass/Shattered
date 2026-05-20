import type { IsoTilemap } from '../world/IsoTilemap';

export type WorldPoint = { x: number; y: number };

export function resolveSpearTargetTileCenter({
  tilemap,
  playerFeet,
  targetWorldX,
  targetWorldY,
  aimRad,
  maxTileReach,
}: {
  tilemap: IsoTilemap;
  playerFeet: WorldPoint;
  targetWorldX: number | null;
  targetWorldY: number | null;
  aimRad: number;
  maxTileReach: number;
}): WorldPoint {
  const playerTile = tilemap.transform.worldToTile(playerFeet.x, playerFeet.y);
  let rawTile: { x: number; y: number };

  if (targetWorldX !== null && targetWorldY !== null) {
    rawTile = tilemap.transform.worldToTile(targetWorldX, targetWorldY);
  } else {
    const projX = playerFeet.x + Math.cos(aimRad) * tilemap.tileWidth * 2;
    const projY = playerFeet.y + Math.sin(aimRad) * tilemap.tileWidth * 2;
    rawTile = tilemap.transform.worldToTile(projX, projY);
  }

  let dx = rawTile.x - playerTile.x;
  let dy = rawTile.y - playerTile.y;
  const chebyshev = Math.max(Math.abs(dx), Math.abs(dy));

  if (chebyshev === 0) {
    const projX = playerFeet.x + Math.cos(aimRad) * tilemap.tileWidth;
    const projY = playerFeet.y + Math.sin(aimRad) * tilemap.tileWidth;
    const projected = tilemap.transform.worldToTile(projX, projY);
    dx = projected.x - playerTile.x;
    dy = projected.y - playerTile.y;
  }

  if (Math.max(Math.abs(dx), Math.abs(dy)) > maxTileReach) {
    const scale = maxTileReach / Math.max(Math.abs(dx), Math.abs(dy));
    dx = Math.round(dx * scale);
    dy = Math.round(dy * scale);
  }

  const finalTile = { x: playerTile.x + dx, y: playerTile.y + dy };
  const center = tilemap.getTileCenterWorld(finalTile.x, finalTile.y);
  return { x: center.x, y: center.y };
}
