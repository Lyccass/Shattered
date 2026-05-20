import {
  createChunkKey,
  parseChunkKey,
  type ChunkCoordinate,
  type ChunkKey,
} from '../../shared/world/ChunkKey';

export type EditorDirtyChunkSummary = {
  count: number;
  keys: ChunkKey[];
};

export class EditorDirtyChunkTracker {
  private readonly dirtyChunkKeys = new Set<ChunkKey>();

  constructor(private readonly chunkSize: number) {}

  markTileDirty(tileX: number, tileY: number): void {
    if (!Number.isInteger(tileX) || !Number.isInteger(tileY)) {
      return;
    }

    this.markChunkDirty({
      chunkX: Math.floor(tileX / this.chunkSize),
      chunkY: Math.floor(tileY / this.chunkSize),
    });
  }

  markChunkDirty(coordinate: ChunkCoordinate): void {
    this.dirtyChunkKeys.add(createChunkKey(coordinate));
  }

  markAllChunksDirty(width: number, height: number): void {
    this.clear();

    const chunkWidth = Math.ceil(width / this.chunkSize);
    const chunkHeight = Math.ceil(height / this.chunkSize);

    for (let chunkY = 0; chunkY < chunkHeight; chunkY += 1) {
      for (let chunkX = 0; chunkX < chunkWidth; chunkX += 1) {
        this.markChunkDirty({ chunkX, chunkY });
      }
    }
  }

  clear(): void {
    this.dirtyChunkKeys.clear();
  }

  getDirtyChunks(): ChunkCoordinate[] {
    return this.getDirtyKeys()
      .map((key) => parseChunkKey(key))
      .filter((coordinate): coordinate is ChunkCoordinate => coordinate !== null);
  }

  getSummary(): EditorDirtyChunkSummary {
    return {
      count: this.dirtyChunkKeys.size,
      keys: this.getDirtyKeys(),
    };
  }

  hasDirtyChunks(): boolean {
    return this.dirtyChunkKeys.size > 0;
  }

  private getDirtyKeys(): ChunkKey[] {
    return [...this.dirtyChunkKeys].sort(compareChunkKeys);
  }
}

function compareChunkKeys(left: ChunkKey, right: ChunkKey): number {
  const leftCoordinate = parseChunkKey(left);
  const rightCoordinate = parseChunkKey(right);

  if (!leftCoordinate || !rightCoordinate) {
    return left.localeCompare(right);
  }

  return leftCoordinate.chunkY - rightCoordinate.chunkY ||
    leftCoordinate.chunkX - rightCoordinate.chunkX;
}
