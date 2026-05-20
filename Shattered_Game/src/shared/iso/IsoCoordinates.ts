export type IsoTransformConfig = {
  originX: number;
  originY: number;
  tileWidth: number;
  tileHeight: number;
};

export type PointLike = {
  x: number;
  y: number;
};

export function getTileTopWorld(
  config: IsoTransformConfig,
  tileX: number,
  tileY: number,
): PointLike {
  return {
    x: config.originX + ((tileX - tileY) * config.tileWidth) / 2,
    y: config.originY + ((tileX + tileY) * config.tileHeight) / 2,
  };
}

export function getTileCenterWorld(
  config: IsoTransformConfig,
  tileX: number,
  tileY: number,
): PointLike {
  const top = getTileTopWorld(config, tileX, tileY);

  return {
    x: top.x,
    y: top.y + config.tileHeight / 2,
  };
}

export function worldToGrid(
  config: IsoTransformConfig,
  worldX: number,
  worldY: number,
): PointLike {
  const localX = worldX - config.originX;
  const localY = worldY - config.originY - config.tileHeight / 2;

  return {
    x: localY / config.tileHeight + localX / config.tileWidth,
    y: localY / config.tileHeight - localX / config.tileWidth,
  };
}

export function gridToTile(grid: PointLike): { x: number; y: number } {
  return {
    x: Math.floor(grid.x + 0.5),
    y: Math.floor(grid.y + 0.5),
  };
}

export function worldToTile(
  config: IsoTransformConfig,
  worldX: number,
  worldY: number,
): { x: number; y: number } {
  return gridToTile(worldToGrid(config, worldX, worldY));
}

export function getTileDiamondPoints(
  config: IsoTransformConfig,
  tileX: number,
  tileY: number,
): PointLike[] {
  const center = getTileCenterWorld(config, tileX, tileY);

  return [
    { x: center.x, y: center.y - config.tileHeight / 2 },
    { x: center.x + config.tileWidth / 2, y: center.y },
    { x: center.x, y: center.y + config.tileHeight / 2 },
    { x: center.x - config.tileWidth / 2, y: center.y },
  ];
}
