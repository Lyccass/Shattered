export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export function angleTo(ax: number, ay: number, bx: number, by: number): number {
  return Math.atan2(by - ay, bx - ax);
}

export function tilesToWorldRange(tiles: number, tileWidth: number, tileHeight: number): number {
  return tiles * Math.max(tileWidth, tileHeight) * 0.5;
}

export function tilesToWorldX(tiles: number, tileWidth: number): number {
  return tiles * tileWidth * 0.5;
}

export function tilesToWorldY(tiles: number, tileHeight: number): number {
  return tiles * tileHeight;
}

export function worldDistanceToTiles(
  distanceWorld: number,
  tileWidth: number,
  tileHeight: number,
): number {
  const scale = Math.max(tileWidth, tileHeight) * 0.5;
  return scale <= 0 ? 0 : distanceWorld / scale;
}

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function hashStringToOrbitDirection(value: string): -1 | 1 {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash % 2 === 0 ? 1 : -1;
}

export function normalizeTileBounds(
  minTileX: number,
  minTileY: number,
  maxTileX: number,
  maxTileY: number,
): { minTileX: number; minTileY: number; maxTileX: number; maxTileY: number } {
  return {
    minTileX: Math.min(minTileX, maxTileX),
    minTileY: Math.min(minTileY, maxTileY),
    maxTileX: Math.max(minTileX, maxTileX),
    maxTileY: Math.max(minTileY, maxTileY),
  };
}

export function getRotatedRectangleCorners(
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  rotationRad: number,
): Array<{ x: number; y: number }> {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const localCorners = [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight },
  ];
  const cos = Math.cos(rotationRad);
  const sin = Math.sin(rotationRad);

  return localCorners.map((corner) => ({
    x: centerX + corner.x * cos - corner.y * sin,
    y: centerY + corner.x * sin + corner.y * cos,
  }));
}
