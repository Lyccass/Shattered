import type { TileType } from './IsoTilemapTypes';

// WorldGrid is the gameplay state model for the map.
// It owns terrain tile data, terrain walkability, and future object-blocked tiles.
// It has no knowledge of rendering, cameras, or Phaser — it is pure game logic.
export class WorldGrid {
  readonly width: number;
  readonly height: number;

  private readonly tiles: TileType[][];
  // Map<tileKey, Set<sourceId>> — tracks which object sources block each tile.
  private readonly objectBlocked = new Map<string, Set<string>>();
  private terrainBlockedCount: number;

  constructor(width: number, height: number, tiles: TileType[][]) {
    this.width = width;
    this.height = height;
    this.tiles = tiles;
    this.terrainBlockedCount = this.countTerrainBlocked();
  }

  getTile(tileX: number, tileY: number): TileType | null {
    if (!this.isTileInBounds(tileX, tileY)) return null;
    return this.tiles[tileY][tileX];
  }

  setTile(tileX: number, tileY: number, tileType: TileType): void {
    if (!this.isTileInBounds(tileX, tileY)) return;
    const wasBlocked = this.isTerrainBlocked(tileX, tileY);
    this.tiles[tileY][tileX] = tileType;
    const isNowBlocked = tileType === 'water';
    if (wasBlocked && !isNowBlocked) this.terrainBlockedCount -= 1;
    else if (!wasBlocked && isNowBlocked) this.terrainBlockedCount += 1;
  }

  isTileInBounds(tileX: number, tileY: number): boolean {
    return (
      Number.isInteger(tileX) &&
      Number.isInteger(tileY) &&
      tileX >= 0 &&
      tileY >= 0 &&
      tileX < this.width &&
      tileY < this.height
    );
  }

  isTerrainBlocked(tileX: number, tileY: number): boolean {
    if (!this.isTileInBounds(tileX, tileY)) return true;
    return this.tiles[tileY][tileX] === 'water';
  }

  // Unified walkability check: false if out-of-bounds, terrain-blocked, or object-blocked.
  isTileWalkable(tileX: number, tileY: number): boolean {
    return !this.isTerrainBlocked(tileX, tileY) && !this.isObjectBlocked(tileX, tileY);
  }

  getTerrainBlockedTileCount(): number {
    return this.terrainBlockedCount;
  }

  // --- Object blocking (prepared for future object placement) ---
  // sourceId is any stable identifier for the object occupying the tile (e.g. entity id, "tree:42").

  blockTile(tileX: number, tileY: number, sourceId: string): void {
    const key = tileKey(tileX, tileY);
    const sources = this.objectBlocked.get(key) ?? new Set<string>();
    sources.add(sourceId);
    this.objectBlocked.set(key, sources);
  }

  unblockTile(tileX: number, tileY: number, sourceId: string): void {
    const key = tileKey(tileX, tileY);
    const sources = this.objectBlocked.get(key);
    if (!sources) return;
    sources.delete(sourceId);
    if (sources.size === 0) this.objectBlocked.delete(key);
  }

  isObjectBlocked(tileX: number, tileY: number): boolean {
    return (this.objectBlocked.get(tileKey(tileX, tileY))?.size ?? 0) > 0;
  }

  // Returns the set of sourceIds currently blocking this tile (empty set if none).
  getBlockedTileSources(tileX: number, tileY: number): Set<string> {
    return this.objectBlocked.get(tileKey(tileX, tileY)) ?? new Set();
  }

  getObjectBlockedTileCount(): number {
    let count = 0;
    for (const sources of this.objectBlocked.values()) {
      if (sources.size > 0) count += 1;
    }
    return count;
  }

  private countTerrainBlocked(): number {
    return this.tiles.reduce(
      (count, row) => count + row.filter((t) => t === 'water').length,
      0,
    );
  }
}

function tileKey(tileX: number, tileY: number): string {
  return `${tileX},${tileY}`;
}
