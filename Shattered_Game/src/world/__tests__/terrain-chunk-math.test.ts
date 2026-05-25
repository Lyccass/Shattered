import { describe, expect, it } from 'vitest';

describe('TerrainChunkMath', () => {
  it('maps tile coordinates to chunk coordinates', async () => {
    const { getChunkCoordForTile } = await loadChunkMath();
    expect(getChunkCoordForTile(0, 0, 32)).toEqual({ chunkX: 0, chunkY: 0 });
    expect(getChunkCoordForTile(31, 31, 32)).toEqual({ chunkX: 0, chunkY: 0 });
    expect(getChunkCoordForTile(32, 0, 32)).toEqual({ chunkX: 1, chunkY: 0 });
    expect(getChunkCoordForTile(65, 66, 32)).toEqual({ chunkX: 2, chunkY: 2 });
  });

  it('builds chunk tile bounds with bleed clamped to the map', async () => {
    const { getChunkTileBounds } = await loadChunkMath();
    expect(getChunkTileBounds(0, 0, 32, 80, 80, 1)).toMatchObject({
      startX: 0,
      startY: 0,
      endX: 32,
      endY: 32,
      drawStartX: 0,
      drawStartY: 0,
      drawEndX: 33,
      drawEndY: 33,
    });

    expect(getChunkTileBounds(2, 2, 32, 80, 80, 1)).toMatchObject({
      startX: 64,
      startY: 64,
      endX: 80,
      endY: 80,
      drawStartX: 63,
      drawStartY: 63,
      drawEndX: 80,
      drawEndY: 80,
    });
  });

  it('creates chunk configs for the full map', async () => {
    const { createChunkConfigs } = await loadChunkMath();
    const transform = createTransformStub();

    const configs = createChunkConfigs({
      mapWidth: 192,
      mapHeight: 192,
      chunkSize: 32,
      bleedTiles: 1,
      transform,
    });

    expect(configs).toHaveLength(36);
    expect(configs[0].key).toBe('0,0');
    expect(configs[35].key).toBe('5,5');
  });

  it('returns grid-native footprint points for logical and bleed chunk bounds', async () => {
    const { getChunkFootprintPoints, getChunkTileBounds } = await loadChunkMath();
    const transform = createTransformStub();
    const chunk = getChunkTileBounds(1, 1, 32, 192, 192, 1);

    const logical = getChunkFootprintPoints(transform, chunk, false);
    const bleed = getChunkFootprintPoints(transform, chunk, true);

    expect(logical).toHaveLength(4);
    expect(bleed).toHaveLength(4);
    expect(logical[0]).toEqual(transform.getTileTopWorld(32, 32));
    expect(logical[2]).toEqual(transform.getTileTopWorld(64, 64));
    expect(bleed[0]).toEqual(transform.getTileTopWorld(31, 31));
    expect(bleed[2]).toEqual(transform.getTileTopWorld(65, 65));
  });

  it('builds visible chunk ranges from the world view', async () => {
    const { getChunkRangeForWorldView, isChunkCoordInRange } = await loadChunkMath();
    const transform = createTransformStub();
    const center = transform.getTileCenterWorld(48, 48);
    const worldView = {
      left: center.x - 16,
      top: center.y - 16,
      right: center.x + 16,
      bottom: center.y + 16,
    } as any;
    const range = getChunkRangeForWorldView({
      worldView,
      transform,
      chunkSize: 32,
      radius: 1,
      mapWidth: 192,
      mapHeight: 192,
    });

    expect(isChunkCoordInRange(1, 1, range)).toBe(true);
    expect(isChunkCoordInRange(0, 0, range)).toBe(true);
    expect(isChunkCoordInRange(2, 2, range)).toBe(true);
    expect(isChunkCoordInRange(3, 3, range)).toBe(false);
  });
});

async function loadChunkMath() {
  if (!('window' in globalThis)) {
    Object.defineProperty(globalThis, 'window', {
      value: {},
      configurable: true,
    });
  }

  if (!('document' in globalThis)) {
    Object.defineProperty(globalThis, 'document', {
      value: {},
      configurable: true,
    });
  }

  if (!('navigator' in globalThis)) {
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: 'vitest' },
      configurable: true,
    });
  }

  return import('../chunks/TerrainChunkMath');
}

function createTransformStub() {
  return {
    tileWidth: 64,
    tileHeight: 32,
    getTileTopWorld(gridX: number, gridY: number) {
      return {
        x: (gridX - gridY) * 32,
        y: (gridX + gridY) * 16,
      };
    },
    getTileCenterWorld(gridX: number, gridY: number) {
      return {
        x: (gridX - gridY) * 32,
        y: (gridX + gridY) * 16 + 16,
      };
    },
    getTileDiamondPoints(gridX: number, gridY: number) {
      const center = this.getTileCenterWorld(gridX, gridY);
      return [
        { x: center.x, y: center.y - 16 },
        { x: center.x + 32, y: center.y },
        { x: center.x, y: center.y + 16 },
        { x: center.x - 32, y: center.y },
      ];
    },
    worldToGrid(worldX: number, worldY: number) {
      const localY = worldY - 16;
      return {
        x: localY / 32 + worldX / 64,
        y: localY / 32 - worldX / 64,
      };
    },
  } as any;
}
