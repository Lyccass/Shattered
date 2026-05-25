import type { TileType } from './IsoTilemapTypes';

// WorldGrid is the gameplay state model for the map.
// It owns terrain tile data, terrain walkability, and future object-blocked tiles.
// It has no knowledge of rendering, cameras, or Phaser — it is pure game logic.
export class WorldGrid {
  readonly width: number;
  readonly height: number;

  private readonly denseTiles?: TileType[][];
  private readonly sparseTiles = new Map<string, TileType>();
  private readonly terrainWalkabilityOverrides: Record<string, boolean>;
  private readonly terrainElevation: Record<string, number>;
  private readonly defaultTile: TileType;
  // Map<tileKey, Set<sourceId>> — tracks which object sources block each tile.
  private readonly objectBlocked = new Map<string, Set<string>>();
  private terrainBlockedCount: number;

  constructor(
    width: number,
    height: number,
    tiles: TileType[][],
    terrainWalkabilityOverrides: Record<string, boolean> = {},
    terrainElevation: Record<string, number> = {},
    defaultTile: TileType = 'water',
  ) {
    this.width = width;
    this.height = height;
    this.denseTiles = tiles.length > 0 ? tiles.map((row) => [...row]) : undefined;
    this.terrainWalkabilityOverrides = { ...terrainWalkabilityOverrides };
    this.terrainElevation = { ...terrainElevation };
    this.defaultTile = defaultTile;
    this.terrainBlockedCount = this.countTerrainBlocked();
  }

  static createSparse(
    width: number,
    height: number,
    defaultTile: TileType,
    terrainWalkabilityOverrides: Record<string, boolean> = {},
    terrainElevation: Record<string, number> = {},
  ): WorldGrid {
    return new WorldGrid(width, height, [], terrainWalkabilityOverrides, terrainElevation, defaultTile);
  }

  getTile(tileX: number, tileY: number): TileType | null {
    if (!this.isTileInBounds(tileX, tileY)) return null;
    return this.denseTiles?.[tileY]?.[tileX] ?? this.sparseTiles.get(tileKey(tileX, tileY)) ?? this.defaultTile;
  }

  setTile(tileX: number, tileY: number, tileType: TileType): void {
    if (!this.isTileInBounds(tileX, tileY)) return;
    const wasBlocked = this.isTerrainBlocked(tileX, tileY);
    if (this.denseTiles) {
      this.denseTiles[tileY][tileX] = tileType;
    } else {
      const key = tileKey(tileX, tileY);
      if (tileType === this.defaultTile) {
        this.sparseTiles.delete(key);
      } else {
        this.sparseTiles.set(key, tileType);
      }
    }
    const isNowBlocked = this.isTerrainTypeBlocked(tileX, tileY, tileType);
    if (wasBlocked && !isNowBlocked) this.terrainBlockedCount -= 1;
    else if (!wasBlocked && isNowBlocked) this.terrainBlockedCount += 1;
  }

  setTerrainWalkabilityOverride(tileX: number, tileY: number, walkable: boolean | null): void {
    if (!this.isTileInBounds(tileX, tileY)) return;
    const wasBlocked = this.isTerrainBlocked(tileX, tileY);
    const key = tileKey(tileX, tileY);
    if (walkable === null) {
      delete this.terrainWalkabilityOverrides[key];
    } else {
      this.terrainWalkabilityOverrides[key] = walkable;
    }
    const isNowBlocked = this.isTerrainBlocked(tileX, tileY);
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
    const tile = this.getTile(tileX, tileY);
    return tile === null ? true : this.isTerrainTypeBlocked(tileX, tileY, tile);
  }

  // Unified walkability check: false if out-of-bounds, terrain-blocked, or object-blocked.
  isTileWalkable(tileX: number, tileY: number): boolean {
    return !this.isTerrainBlocked(tileX, tileY) && !this.isObjectBlocked(tileX, tileY);
  }

  getTerrainElevation(tileX: number, tileY: number): number | null {
    if (!this.isTileInBounds(tileX, tileY)) return null;
    return this.terrainElevation[tileKey(tileX, tileY)] ?? 0;
  }

  isStepWalkable(fromTileX: number, fromTileY: number, toTileX: number, toTileY: number, maxStepHeight = 1): boolean {
    if (!this.isTileWalkable(toTileX, toTileY)) return false;

    const fromElevation = this.getTerrainElevation(fromTileX, fromTileY);
    const toElevation = this.getTerrainElevation(toTileX, toTileY);

    if (fromElevation === null || toElevation === null) {
      return false;
    }

    return Math.abs(toElevation - fromElevation) <= maxStepHeight;
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
    if (this.denseTiles) {
      return this.denseTiles.reduce(
        (count, row, tileY) =>
          count + row.filter((tileType, tileX) => this.isTerrainTypeBlocked(tileX, tileY, tileType)).length,
        0,
      );
    }

    let count = this.isTerrainTypeBlockedByFamily(this.defaultTile) ? this.width * this.height : 0;

    for (const [key, tileType] of this.sparseTiles.entries()) {
      const [tileX, tileY] = parseTileKey(key);
      const defaultBlocked = this.isTerrainTypeBlocked(tileX, tileY, this.defaultTile);
      const tileBlocked = this.isTerrainTypeBlocked(tileX, tileY, tileType);
      if (defaultBlocked && !tileBlocked) count -= 1;
      else if (!defaultBlocked && tileBlocked) count += 1;
    }

    return count;
  }

  private isTerrainTypeBlocked(tileX: number, tileY: number, tileType: TileType): boolean {
    const override = this.terrainWalkabilityOverrides[tileKey(tileX, tileY)];

    if (override !== undefined) {
      return !override;
    }

    return this.isTerrainTypeBlockedByFamily(tileType);
  }

  private isTerrainTypeBlockedByFamily(tileType: TileType): boolean {
    return tileType === 'water';
  }
}

function tileKey(tileX: number, tileY: number): string {
  return `${tileX},${tileY}`;
}

function parseTileKey(key: string): [number, number] {
  const [tileX = '0', tileY = '0'] = key.split(',');
  return [Number(tileX), Number(tileY)];
}
