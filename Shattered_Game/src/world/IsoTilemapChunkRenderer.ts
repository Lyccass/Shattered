import Phaser from 'phaser';
import { PROTOTYPE_SCALE } from '../config/prototypeScale';
import { RENDER_DEPTHS } from '../render/RenderLayers';
import { IsoTransform } from './IsoTransform';
import type { GridMode, TileStyleMap } from './IsoTilemapTypes';
import { WorldGrid } from './WorldGrid';

const GRID_ALPHA = 0.055;

const TILE_STYLES: TileStyleMap = {
  water: {
    fill: 0x164e63,
  },
  sand: {
    fill: 0xd6b66f,
  },
  grass: {
    fill: 0x3f8f4b,
  },
};

type IsoTilemapChunkRendererConfig = {
  scene: Phaser.Scene;
  transform: IsoTransform;
  // IsoTilemapChunkRenderer is the visual rendering layer.
  // It reads tile data from WorldGrid and uses IsoTransform for all coordinates.
  worldGrid: WorldGrid;
  chunkSize?: number;
};

type TileChunk = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  bounds: Phaser.Geom.Rectangle;
  groundLayer: Phaser.GameObjects.Graphics;
  gridLayer: Phaser.GameObjects.Graphics;
};

export class IsoTilemapChunkRenderer {
  private readonly scene: Phaser.Scene;
  private readonly transform: IsoTransform;
  private readonly worldGrid: WorldGrid;
  private readonly chunkSize: number;
  private readonly chunks: TileChunk[] = [];
  private gridMode: GridMode = 'off';

  constructor({
    scene,
    transform,
    worldGrid,
    chunkSize = PROTOTYPE_SCALE.terrainChunkSize,
  }: IsoTilemapChunkRendererConfig) {
    this.scene = scene;
    this.transform = transform;
    this.worldGrid = worldGrid;
    this.chunkSize = chunkSize;
  }

  render(): void {
    this.createChunks();
    this.redrawGroundChunks();
    this.setGridMode(this.gridMode);
    this.scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.updateChunkVisibility, this);
  }

  setGridMode(gridMode: GridMode): void {
    this.gridMode = gridMode;
    this.redrawGridChunks();
    this.updateChunkVisibility();
  }

  getChunkCount(): number {
    return this.chunks.length;
  }

  destroy(): void {
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.updateChunkVisibility, this);
    this.chunks.forEach((chunk) => {
      chunk.groundLayer.destroy();
      chunk.gridLayer.destroy();
    });
    this.chunks.length = 0;
  }

  private createChunks(): void {
    if (this.chunks.length > 0) {
      return;
    }

    const { width: mapWidth, height: mapHeight } = this.worldGrid;

    for (let startY = 0; startY < mapHeight; startY += this.chunkSize) {
      for (let startX = 0; startX < mapWidth; startX += this.chunkSize) {
        const endX = Math.min(startX + this.chunkSize, mapWidth);
        const endY = Math.min(startY + this.chunkSize, mapHeight);
        const groundLayer = this.scene.add.graphics();
        const gridLayer = this.scene.add.graphics();

        groundLayer.setDepth(RENDER_DEPTHS.GROUND);
        gridLayer.setDepth(RENDER_DEPTHS.GRID);

        this.chunks.push({
          startX,
          startY,
          endX,
          endY,
          bounds: this.getChunkBounds(startX, startY, endX, endY),
          groundLayer,
          gridLayer,
        });
      }
    }
  }

  private redrawGroundChunks(): void {
    this.chunks.forEach((chunk) => {
      chunk.groundLayer.clear();

      for (let gridY = chunk.startY; gridY < chunk.endY; gridY += 1) {
        for (let gridX = chunk.startX; gridX < chunk.endX; gridX += 1) {
          const tileType = this.worldGrid.getTile(gridX, gridY) ?? 'water';

          chunk.groundLayer.fillStyle(TILE_STYLES[tileType].fill, 1);
          chunk.groundLayer.fillPoints(this.transform.getTileDiamondPoints(gridX, gridY), true);
        }
      }
    });
  }

  private redrawGridChunks(): void {
    const isGridVisible = this.gridMode !== 'off';
    const alpha = this.gridMode === 'build' ? 0.16 : GRID_ALPHA;
    const colour = this.gridMode === 'build' ? 0xd7f3ff : 0x1d4f36;

    this.chunks.forEach((chunk) => {
      chunk.gridLayer.clear();

      if (!isGridVisible) {
        chunk.gridLayer.setVisible(false);
        return;
      }

      chunk.gridLayer.lineStyle(1, colour, alpha);

      // Grid debug uses the same diamond helper as terrain fill, so tile edges
      // and debug/build overlays stay locked to one coordinate system.
      for (let gridY = chunk.startY; gridY < chunk.endY; gridY += 1) {
        for (let gridX = chunk.startX; gridX < chunk.endX; gridX += 1) {
          chunk.gridLayer.strokePoints(this.transform.getTileDiamondPoints(gridX, gridY), true);
        }
      }
    });
  }

  private updateChunkVisibility(): void {
    const worldView = this.scene.cameras.main.worldView;
    const paddedView = Phaser.Geom.Rectangle.Clone(worldView);

    Phaser.Geom.Rectangle.Inflate(paddedView, this.transform.tileWidth * 2, this.transform.tileHeight * 4);

    this.chunks.forEach((chunk) => {
      const isVisible = Phaser.Geom.Rectangle.Overlaps(paddedView, chunk.bounds);

      chunk.groundLayer.setVisible(isVisible);
      chunk.gridLayer.setVisible(isVisible && this.gridMode !== 'off');
    });
  }

  private getChunkBounds(startX: number, startY: number, endX: number, endY: number): Phaser.Geom.Rectangle {
    const points: Array<{ x: number; y: number }> = [];

    for (let gridY = startY; gridY < endY; gridY += 1) {
      for (let gridX = startX; gridX < endX; gridX += 1) {
        points.push(...this.transform.getTileDiamondPoints(gridX, gridY));
      }
    }

    return Phaser.Geom.Rectangle.FromPoints(points);
  }
}
