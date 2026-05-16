import { IsoTransform } from '../IsoTransform';

export type TerrainChunkCoord = {
  chunkX: number;
  chunkY: number;
};

export type TerrainChunkRange = {
  minChunkX: number;
  maxChunkX: number;
  minChunkY: number;
  maxChunkY: number;
};

export type TerrainChunkConfig = TerrainChunkCoord & {
  key: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  drawStartX: number;
  drawStartY: number;
  drawEndX: number;
  drawEndY: number;
  bounds: ChunkWorldBounds;
};

export type ChunkWorldBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ChunkFootprintPoint = {
  x: number;
  y: number;
};

type RectangleLike = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export function getChunkKey(chunkX: number, chunkY: number): string {
  return `${chunkX},${chunkY}`;
}

export function getChunkCoordForTile(
  tileX: number,
  tileY: number,
  chunkSize: number,
): TerrainChunkCoord {
  return {
    chunkX: Math.floor(tileX / chunkSize),
    chunkY: Math.floor(tileY / chunkSize),
  };
}

export function getChunkTileBounds(
  chunkX: number,
  chunkY: number,
  chunkSize: number,
  mapWidth: number,
  mapHeight: number,
  bleedTiles = 0,
): Omit<TerrainChunkConfig, 'bounds' | 'key'> {
  const startX = chunkX * chunkSize;
  const startY = chunkY * chunkSize;
  const endX = Math.min(startX + chunkSize, mapWidth);
  const endY = Math.min(startY + chunkSize, mapHeight);

  return {
    chunkX,
    chunkY,
    startX,
    startY,
    endX,
    endY,
    drawStartX: Math.max(0, startX - bleedTiles),
    drawStartY: Math.max(0, startY - bleedTiles),
    drawEndX: Math.min(mapWidth, endX + bleedTiles),
    drawEndY: Math.min(mapHeight, endY + bleedTiles),
  };
}

export function createChunkConfigs(params: {
  mapWidth: number;
  mapHeight: number;
  chunkSize: number;
  bleedTiles: number;
  transform: IsoTransform;
}): TerrainChunkConfig[] {
  const configs: TerrainChunkConfig[] = [];
  const chunkCountX = Math.ceil(params.mapWidth / params.chunkSize);
  const chunkCountY = Math.ceil(params.mapHeight / params.chunkSize);

  for (let chunkY = 0; chunkY < chunkCountY; chunkY += 1) {
    for (let chunkX = 0; chunkX < chunkCountX; chunkX += 1) {
      const tileBounds = getChunkTileBounds(
        chunkX,
        chunkY,
        params.chunkSize,
        params.mapWidth,
        params.mapHeight,
        params.bleedTiles,
      );

      configs.push({
        ...tileBounds,
        key: getChunkKey(chunkX, chunkY),
        bounds: getChunkWorldBounds(params.transform, tileBounds),
      });
    }
  }

  return configs;
}

export function getChunkWorldBounds(
  transform: IsoTransform,
  chunk: Pick<TerrainChunkConfig, 'drawStartX' | 'drawStartY' | 'drawEndX' | 'drawEndY'>,
): ChunkWorldBounds {
  const points: Array<{ x: number; y: number }> = [];

  for (let gridY = chunk.drawStartY; gridY < chunk.drawEndY; gridY += 1) {
    for (let gridX = chunk.drawStartX; gridX < chunk.drawEndX; gridX += 1) {
      points.push(...transform.getTileDiamondPoints(gridX, gridY));
    }
  }

  const bounds = createBoundsFromPoints(points);

  bounds.x = Math.floor(bounds.x - transform.tileWidth);
  bounds.y = Math.floor(bounds.y - transform.tileHeight);
  bounds.width = Math.ceil(bounds.width + transform.tileWidth * 2);
  bounds.height = Math.ceil(bounds.height + transform.tileHeight * 4);

  return bounds;
}

export function getChunkFootprintPoints(
  transform: Pick<IsoTransform, 'getTileTopWorld'>,
  chunk: Pick<TerrainChunkConfig, 'startX' | 'startY' | 'endX' | 'endY' | 'drawStartX' | 'drawStartY' | 'drawEndX' | 'drawEndY'>,
  useBleedRange = false,
): ChunkFootprintPoint[] {
  const startX = useBleedRange ? chunk.drawStartX : chunk.startX;
  const startY = useBleedRange ? chunk.drawStartY : chunk.startY;
  const endX = useBleedRange ? chunk.drawEndX : chunk.endX;
  const endY = useBleedRange ? chunk.drawEndY : chunk.endY;

  return [
    toPlainPoint(transform.getTileTopWorld(startX, startY)),
    toPlainPoint(transform.getTileTopWorld(endX, startY)),
    toPlainPoint(transform.getTileTopWorld(endX, endY)),
    toPlainPoint(transform.getTileTopWorld(startX, endY)),
  ];
}

export function getChunkRangeForWorldView(params: {
  worldView: RectangleLike;
  transform: IsoTransform;
  chunkSize: number;
  radius: number;
  mapWidth: number;
  mapHeight: number;
}): TerrainChunkRange {
  const gridCorners = getWorldViewGridCorners(params.worldView, params.transform);
  const minTileX = Math.max(0, Math.floor(Math.min(...gridCorners.map((point) => point.x)) - 1));
  const maxTileX = Math.min(params.mapWidth - 1, Math.ceil(Math.max(...gridCorners.map((point) => point.x)) + 1));
  const minTileY = Math.max(0, Math.floor(Math.min(...gridCorners.map((point) => point.y)) - 1));
  const maxTileY = Math.min(params.mapHeight - 1, Math.ceil(Math.max(...gridCorners.map((point) => point.y)) + 1));
  const minCoord = getChunkCoordForTile(minTileX, minTileY, params.chunkSize);
  const maxCoord = getChunkCoordForTile(maxTileX, maxTileY, params.chunkSize);

  return {
    minChunkX: Math.max(0, minCoord.chunkX - params.radius),
    maxChunkX: maxCoord.chunkX + params.radius,
    minChunkY: Math.max(0, minCoord.chunkY - params.radius),
    maxChunkY: maxCoord.chunkY + params.radius,
  };
}

export function isChunkCoordInRange(
  chunkX: number,
  chunkY: number,
  range: TerrainChunkRange,
): boolean {
  return (
    chunkX >= range.minChunkX &&
    chunkX <= range.maxChunkX &&
    chunkY >= range.minChunkY &&
    chunkY <= range.maxChunkY
  );
}

function getWorldViewGridCorners(
  worldView: RectangleLike,
  transform: IsoTransform,
): Phaser.Math.Vector2[] {
  return [
    transform.worldToGrid(worldView.left, worldView.top),
    transform.worldToGrid(worldView.right, worldView.top),
    transform.worldToGrid(worldView.right, worldView.bottom),
    transform.worldToGrid(worldView.left, worldView.bottom),
  ];
}

function createBoundsFromPoints(points: Array<{ x: number; y: number }>): ChunkWorldBounds {
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function toPlainPoint(point: { x: number; y: number }): ChunkFootprintPoint {
  return {
    x: point.x,
    y: point.y,
  };
}
