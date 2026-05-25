import {
  createChunkKey,
  type ChunkCoordinate,
  type ChunkKey,
} from '../../shared/world/ChunkKey';
import type { WorldChunkDefinition } from '../../shared/world/ChunkTypes';
import type { WorldChunkProvider } from '../../shared/world/WorldChunkProvider';
import { getChunkCoordForTile } from '../chunks/TerrainChunkMath';

export type ActiveWorldChunkWindowOptions = {
  loadRadius: number;
  retainRadius?: number;
};

export type ActiveWorldChunkWindowStats = {
  activeChunkCount: number;
  centerChunk: ChunkCoordinate | null;
  loadedChunkCount: number;
  retainedChunkCount: number;
};

export class ActiveWorldChunkWindow {
  private readonly activeChunks = new Map<ChunkKey, WorldChunkDefinition>();
  private readonly retainedChunks = new Map<ChunkKey, WorldChunkDefinition>();
  private centerChunk: ChunkCoordinate | null = null;

  constructor(
    private readonly provider: WorldChunkProvider,
    private readonly options: ActiveWorldChunkWindowOptions,
  ) {}

  async loadAroundTile(tileX: number, tileY: number): Promise<WorldChunkDefinition[]> {
    const manifest = this.provider.getManifest();
    const center = getChunkCoordForTile(tileX, tileY, manifest.chunkSize);
    return this.loadAroundChunk(center);
  }

  async loadAroundChunk(center: ChunkCoordinate): Promise<WorldChunkDefinition[]> {
    const manifest = this.provider.getManifest();
    const loadRadius = Math.max(0, this.options.loadRadius);
    const retainRadius = Math.max(loadRadius, this.options.retainRadius ?? loadRadius);
    const activeKeys = new Set<ChunkKey>();
    const loadedChunks: WorldChunkDefinition[] = [];

    this.centerChunk = { ...center };

    for (let chunkY = center.chunkY - loadRadius; chunkY <= center.chunkY + loadRadius; chunkY += 1) {
      for (let chunkX = center.chunkX - loadRadius; chunkX <= center.chunkX + loadRadius; chunkX += 1) {
        if (!isChunkInBounds({ chunkX, chunkY }, manifest.bounds)) {
          continue;
        }

        const key = createChunkKey({ chunkX, chunkY });
        activeKeys.add(key);

        const retainedChunk = this.retainedChunks.get(key);
        if (retainedChunk) {
          this.activeChunks.set(key, retainedChunk);
          continue;
        }

        const result = await this.provider.loadChunk({ chunkX, chunkY });
        this.activeChunks.set(key, result.chunk);
        this.retainedChunks.set(key, result.chunk);
        loadedChunks.push(result.chunk);
      }
    }

    for (const key of Array.from(this.activeChunks.keys())) {
      if (!activeKeys.has(key)) {
        this.activeChunks.delete(key);
      }
    }

    for (const [key, chunk] of Array.from(this.retainedChunks.entries())) {
      if (!isChunkInsideRadius(chunk, center, retainRadius)) {
        this.retainedChunks.delete(key);
      }
    }

    return loadedChunks;
  }

  getActiveChunks(): WorldChunkDefinition[] {
    return Array.from(this.activeChunks.values());
  }

  getActiveChunk(coordinate: ChunkCoordinate): WorldChunkDefinition | null {
    return this.activeChunks.get(createChunkKey(coordinate)) ?? null;
  }

  getStats(): ActiveWorldChunkWindowStats {
    return {
      activeChunkCount: this.activeChunks.size,
      centerChunk: this.centerChunk ? { ...this.centerChunk } : null,
      loadedChunkCount: this.activeChunks.size,
      retainedChunkCount: this.retainedChunks.size,
    };
  }
}

function isChunkInsideRadius(
  coordinate: ChunkCoordinate,
  center: ChunkCoordinate,
  radius: number,
): boolean {
  return (
    Math.abs(coordinate.chunkX - center.chunkX) <= radius &&
    Math.abs(coordinate.chunkY - center.chunkY) <= radius
  );
}

function isChunkInBounds(
  coordinate: ChunkCoordinate,
  bounds: { minChunkX: number; minChunkY: number; maxChunkX: number; maxChunkY: number },
): boolean {
  return (
    coordinate.chunkX >= bounds.minChunkX &&
    coordinate.chunkX <= bounds.maxChunkX &&
    coordinate.chunkY >= bounds.minChunkY &&
    coordinate.chunkY <= bounds.maxChunkY
  );
}
