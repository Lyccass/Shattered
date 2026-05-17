import { PLAYER_CONFIG } from '../player/PlayerConfig';

export function computeEnemyBlockingRadius(
  collisionRadiusTiles: number,
  tileWidth: number,
  tileHeight: number,
): number {
  const tileScale = Math.max(tileWidth, tileHeight) * 0.5;
  const enemyRadius = collisionRadiusTiles * tileScale;
  const playerRadius = Math.max(tileWidth, tileHeight) * 0.28;
  const contactMargin = Math.max(
    PLAYER_CONFIG.groundFootprintRadiusX,
    PLAYER_CONFIG.groundFootprintRadiusY,
  ) * 0.25;

  return enemyRadius + playerRadius + contactMargin;
}
