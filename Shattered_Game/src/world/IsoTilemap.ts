import Phaser from 'phaser';
import { PROTOTYPE_SCALE } from '../config/prototypeScale';
import { RENDER_DEPTHS } from '../render/RenderLayers';
import { IsoTransform } from './IsoTransform';
import { IsoTilemapChunkRenderer } from './IsoTilemapChunkRenderer';
import type { GridMode, TileType } from './IsoTilemapTypes';

const MAP_MARGIN = 160;

type IsoTilemapConfig = {
  width?: number;
  height?: number;
};

type WorldPoint = {
  x: number;
  y: number;
};

export class IsoTilemap {
  readonly width: number;
  readonly height: number;
  readonly originX: number;
  readonly originY: number;
  readonly tileWidth = PROTOTYPE_SCALE.tileWidth;
  readonly tileHeight = PROTOTYPE_SCALE.tileHeight;
  readonly transform: IsoTransform;

  private readonly scene: Phaser.Scene;
  private readonly tiles: TileType[][];
  private readonly terrainBlockedTileCount: number;
  private renderer?: IsoTilemapChunkRenderer;
  private gridMode: GridMode = 'off';

  constructor(scene: Phaser.Scene, config: IsoTilemapConfig = {}) {
    this.scene = scene;
    this.width = config.width ?? PROTOTYPE_SCALE.mapWidth;
    this.height = config.height ?? PROTOTYPE_SCALE.mapHeight;
    this.originX = (this.height * this.tileWidth) / 2 + MAP_MARGIN;
    this.originY = MAP_MARGIN;
    this.transform = new IsoTransform({
      originX: this.originX,
      originY: this.originY,
      tileWidth: this.tileWidth,
      tileHeight: this.tileHeight,
    });
    this.tiles = this.createOrganicIsland();
    this.terrainBlockedTileCount = this.countTerrainBlockedTiles();
  }

  render(): Phaser.Geom.Rectangle {
    this.createWaterBackdrop();
    this.createChunkRenderer();

    // Future systems can replace this prototype pass with real island building,
    // resource nodes, world islands, and multiplayer rooms/layers.
    return this.getWorldBounds();
  }

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

  isTileTerrainBlocked(tileX: number, tileY: number): boolean {
    if (!this.isTileInBounds(tileX, tileY)) return true;
    return this.tiles[tileY][tileX] === 'water';
  }

  isTileWalkable(tileX: number, tileY: number): boolean {
    return this.isTileInBounds(tileX, tileY) && !this.isTileTerrainBlocked(tileX, tileY);
  }

  isWorldGridWalkable(gridX: number, gridY: number): boolean {
    const tile = this.transform.gridToTile(new Phaser.Math.Vector2(gridX, gridY));

    return this.isTileWalkable(tile.x, tile.y);
  }

  getTerrainBlockedTileCount(): number {
    return this.terrainBlockedTileCount;
  }

  private countTerrainBlockedTiles(): number {
    return this.tiles.reduce(
      (count, row) => count + row.filter((tileType) => tileType === 'water').length,
      0,
    );
  }

  getTerrainChunkCount(): number {
    return this.renderer?.getChunkCount() ?? 0;
  }

  getSpawnPoint(): WorldPoint {
    return this.getTileCenterWorld(Math.floor(this.width / 2), Math.floor(this.height / 2));
  }

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
    if (!this.renderer) {
      return false;
    }

    this.setGridMode(this.gridMode === 'off' ? 'build' : 'off');

    return this.gridMode !== 'off';
  }

  private createOrganicIsland(): TileType[][] {
    const centreX = (this.width - 1) / 2;
    const centreY = (this.height - 1) / 2;

    return Array.from({ length: this.height }, (_, y) =>
      Array.from({ length: this.width }, (_, x) => {
        const normalisedX = (x - centreX) / (this.width / 2);
        const normalisedY = (y - centreY) / (this.height / 2);
        const distance = Math.sqrt(normalisedX * normalisedX + normalisedY * normalisedY);
        const edgeNoise =
          Math.sin(x * 1.7 + y * 0.4) * 0.06 +
          Math.cos(y * 1.3 - x * 0.35) * 0.05 +
          Math.sin((x + y) * 0.8) * 0.035;
        const islandDistance = distance + edgeNoise;

        if (islandDistance < 0.52) {
          return 'grass';
        }

        if (islandDistance < 0.73) {
          return 'sand';
        }

        return 'water';
      }),
    );
  }

  private createWaterBackdrop(): void {
    const bounds = this.getWorldBounds();
    const backdrop = this.scene.add.rectangle(
      bounds.centerX,
      bounds.centerY,
      bounds.width,
      bounds.height,
      0x07111f,
      1,
    );

    backdrop.setDepth(RENDER_DEPTHS.GROUND - 10);
  }

  private setGridMode(gridMode: GridMode): void {
    this.gridMode = gridMode;
    this.renderer?.setGridMode(gridMode);
  }

  private createChunkRenderer(): void {
    this.renderer = new IsoTilemapChunkRenderer({
      scene: this.scene,
      transform: this.transform,
      tiles: this.tiles,
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
