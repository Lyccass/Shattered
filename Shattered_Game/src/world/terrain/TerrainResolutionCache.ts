import { sampleTerrainNeighbours } from './TerrainNeighbourSampler';
import { TerrainResolver } from './TerrainResolver';
import type { ResolvedTerrainTile, TerrainFamily } from './TerrainTypes';
import { WorldGrid } from '../WorldGrid';

type TerrainResolverLike = Pick<TerrainResolver, 'resolve'>;

export class TerrainResolutionCache {
  private readonly cache = new Map<string, ResolvedTerrainTile>();

  constructor(
    private readonly worldGrid: WorldGrid,
    private readonly terrainResolver: TerrainResolverLike = new TerrainResolver(),
  ) {}

  resolveTile(tileX: number, tileY: number): ResolvedTerrainTile | null {
    const family = this.worldGrid.getTile(tileX, tileY);

    if (!family) {
      return null;
    }

    const key = cacheKey(tileX, tileY);
    const cached = this.cache.get(key);

    if (cached) {
      return cached;
    }

    const resolved = this.terrainResolver.resolve({
      family: family as TerrainFamily,
      gridX: tileX,
      gridY: tileY,
      neighbours: sampleTerrainNeighbours(this.worldGrid, tileX, tileY),
    });

    this.cache.set(key, resolved);
    return resolved;
  }

  invalidateTile(tileX: number, tileY: number): void {
    this.cache.delete(cacheKey(tileX, tileY));
  }

  clear(): void {
    this.cache.clear();
  }

  getCachedTileCount(): number {
    return this.cache.size;
  }
}

function cacheKey(tileX: number, tileY: number): string {
  return `${tileX},${tileY}`;
}
