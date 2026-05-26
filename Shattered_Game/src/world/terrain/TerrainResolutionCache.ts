import { sampleTerrainNeighbours } from './TerrainNeighbourSampler';
import { TerrainResolver } from './TerrainResolver';
import {
  createUniformTerrainEdges,
  getRenderTerrainFamily,
  type ResolvedTerrainTile,
  type TerrainFamily,
} from './TerrainTypes';
import { WorldGrid } from '../WorldGrid';

type TerrainResolverLike = Pick<TerrainResolver, 'resolve'>;
type ExactTerrainPaint = {
  id: string;
  family: TerrainFamily;
  textureKey: string;
  textureOffsetX?: number;
  textureOffsetY?: number;
  textureScale?: number;
  flipX: boolean;
  flipY: boolean;
};

export class TerrainResolutionCache {
  private readonly cache = new Map<string, ResolvedTerrainTile>();

  constructor(
    private readonly worldGrid: WorldGrid,
    private readonly terrainResolver: TerrainResolverLike = new TerrainResolver(),
    private readonly exactTerrainPaints: Record<string, ExactTerrainPaint> = {},
  ) {}

  replaceExactTerrainPaintsInRect(
    tileX: number,
    tileY: number,
    width: number,
    height: number,
    paints: Record<string, ExactTerrainPaint>,
  ): void {
    for (let y = tileY; y < tileY + height; y += 1) {
      for (let x = tileX; x < tileX + width; x += 1) {
        const key = cacheKey(x, y);
        delete this.exactTerrainPaints[key];
        this.cache.delete(key);
      }
    }

    for (const [key, paint] of Object.entries(paints)) {
      this.exactTerrainPaints[key] = { ...paint };
      this.cache.delete(key);
    }
  }

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

    const exactPaint = this.exactTerrainPaints[key];

    if (exactPaint) {
      const resolved = createExactResolvedTerrainTile(exactPaint);
      this.cache.set(key, resolved);
      return resolved;
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

function createExactResolvedTerrainTile(paint: ExactTerrainPaint): ResolvedTerrainTile {
  const renderFamily = getRenderTerrainFamily(paint.family);

  return {
    baseTileDefinition: {
      id: paint.id,
      family: renderFamily,
      role: 'full',
      spriteFrame: paint.textureKey,
      weight: 1,
      walkable: true,
      edges: createUniformTerrainEdges(renderFamily),
      allowFlipX: true,
      allowFlipY: true,
      allowRotation: false,
    },
    baseTransform: {
      flipX: paint.flipX,
      flipY: paint.flipY,
      ...(paint.textureOffsetX !== undefined ? { offsetX: paint.textureOffsetX } : {}),
      ...(paint.textureOffsetY !== undefined ? { offsetY: paint.textureOffsetY } : {}),
      rotation: 0,
      ...(paint.textureScale !== undefined ? { scale: paint.textureScale } : {}),
    },
    transitionOverlays: [],
    debugInfo: {
      neighbourFamilies: {
        edges: {
          xPlus: paint.family,
          xMinus: paint.family,
          yPlus: paint.family,
          yMinus: paint.family,
        },
        corners: {
          xPlusYPlus: paint.family,
          xPlusYMinus: paint.family,
          xMinusYPlus: paint.family,
          xMinusYMinus: paint.family,
        },
      },
      edgeCandidates: [],
      outerCornerCandidates: [],
      innerCornerCandidates: [],
      shorelineCandidates: [],
    },
  };
}
