import { describe, expect, it } from 'vitest';
import { WorldGrid } from '../WorldGrid';
import { TerrainResolutionCache } from '../terrain/TerrainResolutionCache';
import type { TerrainNeighbourFamilies, ResolvedTerrainTile } from '../terrain/TerrainTypes';

describe('TerrainResolutionCache', () => {
  it('returns a stable cached result for the same tile', () => {
    const worldGrid = new WorldGrid(
      2,
      2,
      [
        ['grass', 'grass'],
        ['grass', 'grass'],
      ],
    );

    const calls: Array<{ gridX: number; gridY: number }> = [];
    const cache = new TerrainResolutionCache(worldGrid, {
      resolve: ({ family, gridX, gridY, neighbours }) => {
        calls.push({ gridX, gridY });
        return {
          baseTileDefinition: {
            id: `tile-${family}`,
            family: 'grass',
            role: 'full',
            spriteFrame: 'terrain-grassA',
            weight: 1,
            walkable: true,
            edges: {
              xPlus: 'grass',
              xMinus: 'grass',
              yPlus: 'grass',
              yMinus: 'grass',
            },
            allowFlipX: false,
            allowFlipY: false,
            allowRotation: false,
          },
          baseTransform: { flipX: false, flipY: false, rotation: 0 },
          transitionOverlays: [],
          debugInfo: {
            neighbourFamilies: neighbours as TerrainNeighbourFamilies,
            edgeCandidates: [],
            outerCornerCandidates: [],
            innerCornerCandidates: [],
            shorelineCandidates: [],
          },
        } satisfies ResolvedTerrainTile;
      },
    });

    const first = cache.resolveTile(0, 0);
    const second = cache.resolveTile(0, 0);

    expect(first).toBe(second);
    expect(calls).toEqual([{ gridX: 0, gridY: 0 }]);
    expect(cache.getCachedTileCount()).toBe(1);
  });

  it('clears cached terrain results', () => {
    const worldGrid = new WorldGrid(
      1,
      1,
      [['grass']],
    );
    let resolveCalls = 0;
    const cache = new TerrainResolutionCache(worldGrid, {
      resolve: ({ neighbours }) => {
        resolveCalls += 1;
        return {
          baseTileDefinition: {
            id: 'tile-grass',
            family: 'grass',
            role: 'full',
            spriteFrame: 'terrain-grassA',
            weight: 1,
            walkable: true,
            edges: {
              xPlus: 'grass',
              xMinus: 'grass',
              yPlus: 'grass',
              yMinus: 'grass',
            },
            allowFlipX: false,
            allowFlipY: false,
            allowRotation: false,
          },
          baseTransform: { flipX: false, flipY: false, rotation: 0 },
          transitionOverlays: [],
          debugInfo: {
            neighbourFamilies: neighbours as TerrainNeighbourFamilies,
            edgeCandidates: [],
            outerCornerCandidates: [],
            innerCornerCandidates: [],
            shorelineCandidates: [],
          },
        } satisfies ResolvedTerrainTile;
      },
    });

    cache.resolveTile(0, 0);
    cache.clear();
    cache.resolveTile(0, 0);

    expect(resolveCalls).toBe(2);
    expect(cache.getCachedTileCount()).toBe(1);
  });
});
