import Phaser from 'phaser';
import { PROTOTYPE_SCALE } from '../config/prototypeScale';
import { RENDER_DEPTHS } from '../render/RenderLayers';
import { generateOrganicIsland } from './IslandGenerator';
import { IsoTransform } from './IsoTransform';
import {
  IsoTilemapChunkRenderer,
  type TerrainChunkStats,
} from './IsoTilemapChunkRenderer';
import type { TileType } from './IsoTilemapTypes';
import type { ResolvedTerrainTile } from './terrain/TerrainTypes';
import { TerrainResolutionCache } from './terrain/TerrainResolutionCache';
import type { GridMode } from './IsoTilemapTypes';
import { WorldGrid } from './WorldGrid';

const MAP_MARGIN = 160;

type IsoTilemapConfig = {
  width?: number;
  height?: number;
  terrain?: TileType[][];
};

type WorldPoint = {
  x: number;
  y: number;
};

// IsoTilemap is a coordinator/facade.
// It creates and wires WorldGrid (gameplay state), IsoTransform (coordinate projection),
// and IsoTilemapChunkRenderer (visual rendering), then exposes a stable interface
// for player and debug systems so they never need to reach through into subsystems.
export class IsoTilemap {
  readonly width: number;
  readonly height: number;
  readonly originX: number;
  readonly originY: number;
  readonly tileWidth = PROTOTYPE_SCALE.tileWidth;
  readonly tileHeight = PROTOTYPE_SCALE.tileHeight;
  // IsoTransform is the coordinate projection layer — grid ↔ world ↔ screen.
  readonly transform: IsoTransform;
  // WorldGrid is the authoritative gameplay state for the map.
  readonly worldGrid: WorldGrid;

  private readonly scene: Phaser.Scene;
  private readonly terrainResolutionCache: TerrainResolutionCache;
  private waterBackdrop?: Phaser.GameObjects.Rectangle;
  private renderer?: IsoTilemapChunkRenderer;
  private gridMode: GridMode = 'off';

  constructor(scene: Phaser.Scene, config: IsoTilemapConfig = {}) {
    this.scene = scene;
    const terrain = config.terrain;

    if (terrain) {
      validateTerrainLayer(terrain);
      this.width = terrain[0].length;
      this.height = terrain.length;
    } else {
      this.width = config.width ?? PROTOTYPE_SCALE.mapWidth;
      this.height = config.height ?? PROTOTYPE_SCALE.mapHeight;
    }

    this.originX = (this.height * this.tileWidth) / 2 + MAP_MARGIN;
    this.originY = MAP_MARGIN;
    this.transform = new IsoTransform({
      originX: this.originX,
      originY: this.originY,
      tileWidth: this.tileWidth,
      tileHeight: this.tileHeight,
    });
    this.worldGrid = new WorldGrid(
      this.width,
      this.height,
      terrain ?? generateOrganicIsland(this.width, this.height),
    );
    this.terrainResolutionCache = new TerrainResolutionCache(this.worldGrid);
  }

  render(): Phaser.Geom.Rectangle {
    this.createWaterBackdrop();
    this.createChunkRenderer();
    return this.getWorldBounds();
  }

  destroy(): void {
    this.renderer?.destroy();
    this.renderer = undefined;
    this.waterBackdrop?.destroy();
    this.waterBackdrop = undefined;
    this.terrainResolutionCache.clear();
  }

  // --- Coordinate facade (delegates to IsoTransform) ---

  gridToWorld(gridX: number, gridY: number): WorldPoint {
    const point = this.transform.gridToWorld(gridX, gridY);
    return { x: point.x, y: point.y };
  }

  getTileCenterWorld(gridX: number, gridY: number): WorldPoint {
    const point = this.transform.getTileCenterWorld(gridX, gridY);
    return { x: point.x, y: point.y };
  }

  worldToGrid(worldX: number, worldY: number): WorldPoint {
    const point = this.transform.worldToGrid(worldX, worldY);
    return { x: point.x, y: point.y };
  }

  // --- Walkability facade (delegates to WorldGrid) ---

  isTileInBounds(tileX: number, tileY: number): boolean {
    return this.worldGrid.isTileInBounds(tileX, tileY);
  }

  isTileTerrainBlocked(tileX: number, tileY: number): boolean {
    return this.worldGrid.isTerrainBlocked(tileX, tileY);
  }

  getTerrainFamilyAtTile(tileX: number, tileY: number): string | null {
    return this.worldGrid.getTile(tileX, tileY);
  }

  resolveTerrainTile(tileX: number, tileY: number): ResolvedTerrainTile | null {
    return this.terrainResolutionCache.resolveTile(tileX, tileY);
  }

  // Unified walkability check — terrain and future object blocking both feed in here.
  isTileWalkable(tileX: number, tileY: number): boolean {
    return this.worldGrid.isTileWalkable(tileX, tileY);
  }

  // Fractional grid position walkability check (used by the debug overlay).
  isWorldGridWalkable(gridX: number, gridY: number): boolean {
    const tile = this.transform.gridToTile(new Phaser.Math.Vector2(gridX, gridY));
    return this.worldGrid.isTileWalkable(tile.x, tile.y);
  }

  getTerrainBlockedTileCount(): number {
    return this.worldGrid.getTerrainBlockedTileCount();
  }

  // --- Renderer info ---

  getTerrainChunkCount(): number {
    return this.renderer?.getChunkCount() ?? 0;
  }

  getTerrainChunkStats(): TerrainChunkStats | null {
    return this.renderer?.getChunkStats() ?? null;
  }

  toggleChunkDebug(): boolean {
    return this.renderer?.toggleChunkDebug() ?? false;
  }

  getSpawnPoint(): WorldPoint {
    return this.getTileCenterWorld(Math.floor(this.width / 2), Math.floor(this.height / 2));
  }

  // --- Grid mode (delegates to renderer) ---

  cycleGridMode(): GridMode {
    const nextMode: Record<GridMode, GridMode> = {
      off: 'subtle',
      subtle: 'build',
      build: 'off',
    };
    this.setGridMode(nextMode[this.gridMode]);
    return this.gridMode;
  }

  getGridMode(): GridMode {
    return this.gridMode;
  }

  toggleGridVisibility(): boolean {
    if (!this.renderer) return false;
    this.setGridMode(this.gridMode === 'off' ? 'build' : 'off');
    return this.gridMode !== 'off';
  }

  private setGridMode(gridMode: GridMode): void {
    this.gridMode = gridMode;
    this.renderer?.setGridMode(gridMode);
  }

  private createWaterBackdrop(): void {
    const bounds = this.getWorldBounds();
    this.waterBackdrop?.destroy();
    this.waterBackdrop = this.scene.add.rectangle(
      bounds.centerX,
      bounds.centerY,
      bounds.width,
      bounds.height,
      0x07111f,
      1,
    );
    this.waterBackdrop.setDepth(RENDER_DEPTHS.GROUND - 10);
  }

  private createChunkRenderer(): void {
    this.renderer = new IsoTilemapChunkRenderer({
      scene: this.scene,
      transform: this.transform,
      worldGrid: this.worldGrid,
      terrainResolutionCache: this.terrainResolutionCache,
    });
    this.renderer.render();
  }

  private getWorldBounds(): Phaser.Geom.Rectangle {
    const points = [
      ...this.transform.getTileDiamondPoints(0, 0),
      ...this.transform.getTileDiamondPoints(this.width - 1, 0),
      ...this.transform.getTileDiamondPoints(this.width - 1, this.height - 1),
      ...this.transform.getTileDiamondPoints(0, this.height - 1),
    ];
    const bounds = Phaser.Geom.Rectangle.FromPoints(points);
    const minX = bounds.left - MAP_MARGIN;
    const maxX = bounds.right + MAP_MARGIN;
    const minY = bounds.top - MAP_MARGIN;
    const maxY = bounds.bottom + MAP_MARGIN;
    return new Phaser.Geom.Rectangle(minX, minY, maxX - minX, maxY - minY);
  }
}

function validateTerrainLayer(terrain: TileType[][]): void {
  if (terrain.length === 0 || terrain[0].length === 0) {
    throw new Error('IsoTilemap: terrain layer must not be empty');
  }

  const expectedWidth = terrain[0].length;

  terrain.forEach((row, rowIndex) => {
    if (row.length !== expectedWidth) {
      throw new Error(
        `IsoTilemap: terrain row ${rowIndex} has width ${row.length}, expected ${expectedWidth}`,
      );
    }
  });
}
