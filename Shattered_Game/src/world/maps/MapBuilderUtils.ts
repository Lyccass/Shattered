import type { TileType } from '../IsoTilemapTypes';
import type { MapSpawnPoint } from './MapTypes';

export function createSpawnPoints(spawnPoints: MapSpawnPoint[]): Record<string, MapSpawnPoint> {
  return spawnPoints.reduce<Record<string, MapSpawnPoint>>((record, spawnPoint) => {
    record[spawnPoint.id] = spawnPoint;
    return record;
  }, {});
}

export function fillTerrain(width: number, height: number, tileType: TileType): TileType[][] {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => tileType));
}

export function createOvalIslandTerrain(
  width: number,
  height: number,
  radii: {
    landRadiusX: number;
    landRadiusY: number;
    beachRadiusX: number;
    beachRadiusY: number;
  },
): TileType[][] {
  const terrain = fillTerrain(width, height, 'water');
  const centreX = (width - 1) / 2;
  const centreY = (height - 1) / 2;

  for (let tileY = 0; tileY < height; tileY += 1) {
    for (let tileX = 0; tileX < width; tileX += 1) {
      const normalisedX = Math.abs(tileX - centreX) / (width / 2);
      const normalisedY = Math.abs(tileY - centreY) / (height / 2);
      const landDistance = Math.sqrt(
        Math.pow(normalisedX / radii.landRadiusX, 2) +
        Math.pow(normalisedY / radii.landRadiusY, 2),
      );
      const beachDistance = Math.sqrt(
        Math.pow(normalisedX / radii.beachRadiusX, 2) +
        Math.pow(normalisedY / radii.beachRadiusY, 2),
      );

      if (landDistance <= 1) {
        terrain[tileY][tileX] = 'grass';
      } else if (beachDistance <= 1) {
        terrain[tileY][tileX] = 'sand';
      }
    }
  }

  return terrain;
}

export function paintRect(
  terrain: TileType[][],
  startX: number,
  startY: number,
  width: number,
  height: number,
  tileType: TileType,
): void {
  for (let tileY = startY; tileY < startY + height; tileY += 1) {
    for (let tileX = startX; tileX < startX + width; tileX += 1) {
      if (terrain[tileY]?.[tileX] !== undefined) {
        terrain[tileY][tileX] = tileType;
      }
    }
  }
}
