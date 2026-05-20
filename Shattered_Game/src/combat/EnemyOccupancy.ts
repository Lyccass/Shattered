import { PLAYER_CONFIG } from '../player/PlayerConfig';
import type { IsoTilemap } from '../world/IsoTilemap';
import type { EnemyRuntimeState } from './EnemyTypes';

export function getEnemyOccupiedTile(
  runtimeState: EnemyRuntimeState | null,
  tilemap: IsoTilemap | null,
): { x: number; y: number } | null {
  if (!runtimeState || !tilemap || runtimeState.currentState === 'dead') {
    return null;
  }

  const tile = tilemap.transform.worldToTile(runtimeState.worldX, runtimeState.worldY);
  return { x: tile.x, y: tile.y };
}

export function getEnemyOccupiedTiles(
  runtimeState: EnemyRuntimeState | null,
  tilemap: IsoTilemap | null,
): Array<{ x: number; y: number }> {
  const tile = getEnemyOccupiedTile(runtimeState, tilemap);
  return tile ? [tile] : [];
}

export function blocksEnemyFeetAt({
  tilemap,
  occupiedTile,
  worldX,
  worldY,
}: {
  tilemap: IsoTilemap | null;
  occupiedTile: { x: number; y: number } | null;
  worldX: number;
  worldY: number;
}): boolean {
  if (!tilemap || !occupiedTile) {
    return false;
  }

  const samplePoints = [
    { x: worldX, y: worldY },
    { x: worldX - PLAYER_CONFIG.groundFootprintRadiusX, y: worldY },
    { x: worldX + PLAYER_CONFIG.groundFootprintRadiusX, y: worldY },
    { x: worldX, y: worldY - PLAYER_CONFIG.groundFootprintRadiusY },
    { x: worldX, y: worldY + PLAYER_CONFIG.groundFootprintRadiusY },
  ];

  return samplePoints.some((point) => {
    const feetTile = tilemap.transform.worldToTile(point.x, point.y);
    return feetTile.x === occupiedTile.x && feetTile.y === occupiedTile.y;
  });
}

export function getEnemyOccupiedTileSamples({
  tilemap,
  occupiedTile,
}: {
  tilemap: IsoTilemap | null;
  occupiedTile: { x: number; y: number } | null;
}): Array<{ x: number; y: number }> {
  if (!tilemap || !occupiedTile) {
    return [];
  }

  const center = tilemap.getTileCenterWorld(occupiedTile.x, occupiedTile.y);
  const corners = tilemap.transform.getTileDiamondPoints(occupiedTile.x, occupiedTile.y);
  const edgeMidpoints = corners.map((corner, index) => {
    const next = corners[(index + 1) % corners.length];
    return {
      x: (corner.x + next.x) / 2,
      y: (corner.y + next.y) / 2,
    };
  });

  return [
    { x: center.x, y: center.y },
    ...corners.map((point) => ({ x: point.x, y: point.y })),
    ...edgeMidpoints,
  ];
}
