import { describe, expect, it } from 'vitest';

describe('TerrainChunkMath', () => {
  it('maps tile coordinates to chunk coordinates', async () => {
    const { getChunkCoordForTile } = await loadChunkMath();
    expect(getChunkCoordForTile(0, 0, 16)).toEqual({ chunkX: 0, chunkY: 0 });
    expect(getChunkCoordForTile(15, 15, 16)).toEqual({ chunkX: 0, chunkY: 0 });
    expect(getChunkCoordForTile(16, 0, 16)).toEqual({ chunkX: 1, chunkY: 0 });
    expect(getChunkCoordForTile(33, 40, 16)).toEqual({ chunkX: 2, chunkY: 2 });
  });

  it('builds chunk tile bounds with bleed clamped to the map', async () => {
    const { getChunkTileBounds } = await loadChunkMath();
    expect(getChunkTileBounds(0, 0, 16, 40, 40, 1)).toMatchObject({
      startX: 0,
      startY: 0,
      endX: 16,
      endY: 16,
      drawStartX: 0,
      drawStartY: 0,
      drawEndX: 17,
      drawEndY: 17,
    });

    expect(getChunkTileBounds(2, 2, 16, 40, 40, 1)).toMatchObject({
      startX: 32,
      startY: 32,
      endX: 40,
      endY: 40,
      drawStartX: 31,
      drawStartY: 31,
      drawEndX: 40,
      drawEndY: 40,
    });
  });

  it('creates chunk configs for the full map', async () => {
    const { createChunkConfigs } = await loadChunkMath();
    const transform = createTransformStub();

    const configs = createChunkConfigs({
      mapWidth: 40,
      mapHeight: 40,
      chunkSize: 16,
      bleedTiles: 1,
      transform,
    });

    expect(configs).toHaveLength(9);
    expect(configs[0].key).toBe('0,0');
    expect(configs[8].key).toBe('2,2');
  });

  it('builds visible chunk ranges from the world view', async () => {
    const { getChunkRangeForWorldView, isChunkCoordInRange } = await loadChunkMath();
    const transform = createTransformStub();
    const center = transform.getTileCenterWorld(20, 20);
    const worldView = {
      left: center.x - 160,
      top: center.y - 96,
      right: center.x + 160,
      bottom: center.y + 96,
    } as any;
    const range = getChunkRangeForWorldView({
      worldView,
      transform,
      chunkSize: 16,
      radius: 1,
      mapWidth: 64,
      mapHeight: 64,
    });

    expect(isChunkCoordInRange(1, 1, range)).toBe(true);
    expect(isChunkCoordInRange(0, 0, range)).toBe(true);
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
