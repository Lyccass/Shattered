import Phaser from 'phaser';
import { PROTOTYPE_SCALE } from '../config/prototypeScale';
import { RENDER_DEPTHS } from '../render/RenderLayers';
import { IsoTransform } from './IsoTransform';
import { sampleTerrainNeighbours } from './terrain/TerrainNeighbourSampler';
import { TerrainResolver } from './terrain/TerrainResolver';
import type {
  IsoCornerKey,
  IsoEdgeKey,
  ResolvedTerrainTile,
  ResolvedTerrainTransition,
} from './terrain/TerrainTypes';
import type { GridMode } from './IsoTilemapTypes';
import { WorldGrid } from './WorldGrid';

const GRID_ALPHA = 0.055;

type IsoTilemapChunkRendererConfig = {
  scene: Phaser.Scene;
  transform: IsoTransform;
  // IsoTilemapChunkRenderer is the visual rendering layer.
  // It reads tile data from WorldGrid and uses IsoTransform for all coordinates.
  worldGrid: WorldGrid;
  chunkSize?: number;
};

type ChunkConfig = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  bounds: Phaser.Geom.Rectangle;
};

type TileChunk = ChunkConfig & {
  groundLayer: Phaser.GameObjects.RenderTexture;
  gridLayer: Phaser.GameObjects.Graphics;
};

export class IsoTilemapChunkRenderer {
  private readonly scene: Phaser.Scene;
  private readonly transform: IsoTransform;
  private readonly worldGrid: WorldGrid;
  private readonly chunkSize: number;
  private readonly terrainResolver = new TerrainResolver();
  private readonly chunkConfigs: ChunkConfig[] = [];
  private readonly activeChunks = new Map<string, TileChunk>();
  private tileStamp?: Phaser.GameObjects.Image;
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
    this.registerChunkConfigs();
    this.scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.updateChunkVisibility, this);
    this.updateChunkVisibility();
  }

  setGridMode(gridMode: GridMode): void {
    this.gridMode = gridMode;
    for (const chunk of this.activeChunks.values()) {
      this.drawGridChunk(chunk);
    }
    this.updateChunkVisibility();
  }

  getChunkCount(): number {
    return this.chunkConfigs.length;
  }

  destroy(): void {
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.updateChunkVisibility, this);
    for (const chunk of this.activeChunks.values()) {
      chunk.groundLayer.destroy();
      chunk.gridLayer.destroy();
    }
    this.tileStamp?.destroy();
    this.chunkConfigs.length = 0;
    this.activeChunks.clear();
  }

  private registerChunkConfigs(): void {
    if (this.chunkConfigs.length > 0) return;

    const { width: mapWidth, height: mapHeight } = this.worldGrid;

    for (let startY = 0; startY < mapHeight; startY += this.chunkSize) {
      for (let startX = 0; startX < mapWidth; startX += this.chunkSize) {
        const endX = Math.min(startX + this.chunkSize, mapWidth);
        const endY = Math.min(startY + this.chunkSize, mapHeight);
        const bounds = this.getChunkBounds(startX, startY, endX, endY);
        this.chunkConfigs.push({ startX, startY, endX, endY, bounds });
      }
    }
  }

  private materializeChunk(config: ChunkConfig): TileChunk {
    const groundLayer = this.scene.add.renderTexture(
      config.bounds.x, config.bounds.y, config.bounds.width, config.bounds.height,
    );
    const gridLayer = this.scene.add.graphics();

    groundLayer.setOrigin(0, 0);
    groundLayer.setDepth(RENDER_DEPTHS.GROUND);
    gridLayer.setDepth(RENDER_DEPTHS.GRID);

    const chunk: TileChunk = { ...config, groundLayer, gridLayer };
    this.drawGroundChunk(chunk);
    this.drawGridChunk(chunk);
    return chunk;
  }

  private drawGroundChunk(chunk: TileChunk): void {
    chunk.groundLayer.clear();

    this.forEachTileInDrawOrder(chunk, (gridX, gridY) => {
      const tileType = this.worldGrid.getTile(gridX, gridY) ?? 'water';
      const resolvedTile = this.terrainResolver.resolve({
        family: tileType,
        gridX,
        gridY,
        neighbours: sampleTerrainNeighbours(this.worldGrid, gridX, gridY),
      });
      const replacementTransition = this.getReplacementTransition(resolvedTile);
      const textureKey = replacementTransition?.definition.spriteFrame ?? resolvedTile.baseTileDefinition.spriteFrame;
      const frame = this.scene.textures.getFrame(textureKey);

      if (!frame) return;

      const tileCenter = this.transform.getTileCenterWorld(gridX, gridY);
      const drawX = Math.round(tileCenter.x - frame.width / 2 - chunk.bounds.x);
      const drawY = Math.round(tileCenter.y - this.transform.tileHeight / 2 - chunk.bounds.y);

      if (replacementTransition) {
        this.drawTextureFrame(chunk, textureKey, replacementTransition.transform, frame, drawX, drawY);
      } else {
        this.drawResolvedTile(chunk, resolvedTile, frame, drawX, drawY);
      }

      this.drawResolvedTransitionArt(chunk, resolvedTile, tileCenter.x, tileCenter.y);
    });
  }

  private drawGridChunk(chunk: TileChunk): void {
    chunk.gridLayer.clear();

    const isGridVisible = this.gridMode !== 'off';
    if (!isGridVisible) {
      chunk.gridLayer.setVisible(false);
      return;
    }

    const alpha = this.gridMode === 'build' ? 0.16 : GRID_ALPHA;
    const colour = this.gridMode === 'build' ? 0xd7f3ff : 0x1d4f36;

    chunk.gridLayer.lineStyle(1, colour, alpha);

    // Grid debug uses the same diamond helper as terrain fill, so tile edges
    // and debug/build overlays stay locked to one coordinate system.
    for (let gridY = chunk.startY; gridY < chunk.endY; gridY += 1) {
      for (let gridX = chunk.startX; gridX < chunk.endX; gridX += 1) {
        chunk.gridLayer.strokePoints(this.transform.getTileDiamondPoints(gridX, gridY), true);
      }
    }

    if (this.gridMode === 'build') {
      this.drawTransitionDebugOverlays(chunk);
    }
  }

  private updateChunkVisibility(): void {
    const worldView = this.scene.cameras.main.worldView;
    const paddedView = Phaser.Geom.Rectangle.Clone(worldView);

    Phaser.Geom.Rectangle.Inflate(paddedView, this.transform.tileWidth * 2, this.transform.tileHeight * 4);

    for (const config of this.chunkConfigs) {
      const isVisible = Phaser.Geom.Rectangle.Overlaps(paddedView, config.bounds);
      const key = chunkKey(config);

      if (isVisible) {
        let chunk = this.activeChunks.get(key);
        if (!chunk) {
          chunk = this.materializeChunk(config);
          this.activeChunks.set(key, chunk);
        }
        chunk.groundLayer.setVisible(true);
        chunk.gridLayer.setVisible(this.gridMode !== 'off');
      } else {
        const chunk = this.activeChunks.get(key);
        if (chunk) {
          chunk.groundLayer.setVisible(false);
          chunk.gridLayer.setVisible(false);
        }
      }
    }
  }

  private getChunkBounds(startX: number, startY: number, endX: number, endY: number): Phaser.Geom.Rectangle {
    const points: Array<{ x: number; y: number }> = [];

    for (let gridY = startY; gridY < endY; gridY += 1) {
      for (let gridX = startX; gridX < endX; gridX += 1) {
        points.push(...this.transform.getTileDiamondPoints(gridX, gridY));
      }
    }

    const bounds = Phaser.Geom.Rectangle.FromPoints(points);

    // Public tile art includes block sides below the diamond top, so the cached
    // chunk needs extra room beyond the mathematical ground diamond bounds.
    bounds.x = Math.floor(bounds.x - this.transform.tileWidth);
    bounds.y = Math.floor(bounds.y - this.transform.tileHeight);
    bounds.width = Math.ceil(bounds.width + this.transform.tileWidth * 2);
    bounds.height = Math.ceil(bounds.height + this.transform.tileHeight * 4);

    return bounds;
  }

  private forEachTileInDrawOrder(chunk: ChunkConfig, callback: (gridX: number, gridY: number) => void): void {
    const startDiagonal = chunk.startX + chunk.startY;
    const endDiagonal = chunk.endX + chunk.endY - 2;

    for (let diagonal = startDiagonal; diagonal <= endDiagonal; diagonal += 1) {
      for (let gridX = chunk.startX; gridX < chunk.endX; gridX += 1) {
        const gridY = diagonal - gridX;

        if (gridY >= chunk.startY && gridY < chunk.endY) {
          callback(gridX, gridY);
        }
      }
    }
  }

  private drawResolvedTile(
    chunk: TileChunk,
    resolvedTile: ResolvedTerrainTile,
    frame: Phaser.Textures.Frame,
    drawX: number,
    drawY: number,
  ): void {
    const textureKey = resolvedTile.baseTileDefinition.spriteFrame;
    this.drawTextureFrame(chunk, textureKey, resolvedTile.baseTransform, frame, drawX, drawY);
  }

  private drawTextureFrame(
    chunk: TileChunk,
    textureKey: string,
    transform: { flipX: boolean; flipY: boolean },
    frame: Phaser.Textures.Frame,
    drawX: number,
    drawY: number,
  ): void {
    const { flipX, flipY } = transform;

    if (!flipX && !flipY) {
      chunk.groundLayer.drawFrame(textureKey, undefined, drawX, drawY);
      return;
    }

    const stamp = this.getTileStamp(textureKey);
    stamp.setTexture(textureKey);
    stamp.setPosition(drawX + frame.width / 2, drawY + frame.height / 2);
    stamp.setFlip(flipX, flipY);

    chunk.groundLayer.draw(stamp);
  }

  private drawTransitionDebugOverlays(chunk: TileChunk): void {
    this.forEachTileInDrawOrder(chunk, (gridX, gridY) => {
      const tileType = this.worldGrid.getTile(gridX, gridY) ?? 'water';
      const resolvedTile = this.terrainResolver.resolve({
        family: tileType,
        gridX,
        gridY,
        neighbours: sampleTerrainNeighbours(this.worldGrid, gridX, gridY),
      });

      resolvedTile.transitionOverlays.forEach((overlay) => {
        this.drawTransitionDebugOverlay(chunk.gridLayer, gridX, gridY, overlay);
      });
    });
  }

  private drawTransitionDebugOverlay(
    gridLayer: Phaser.GameObjects.Graphics,
    gridX: number,
    gridY: number,
    overlay: ResolvedTerrainTransition,
  ): void {
    const { definition } = overlay;
    const points = this.transform.getTileDiamondPoints(gridX, gridY);

    if (isEdgeDirection(definition.direction)) {
      const [start, end] = getEdgeDebugLine(points, definition.direction);
      const lineWidth = definition.kind === 'shorelineEdge' ? 3 : 2;

      gridLayer.lineStyle(lineWidth, definition.debugStyle.color, definition.debugStyle.alpha);
      gridLayer.strokeLineShape(new Phaser.Geom.Line(start.x, start.y, end.x, end.y));
      return;
    }

    if (isCornerDirection(definition.direction)) {
      const cornerPoint = getCornerDebugPoint(points, definition.direction);
      const radius = definition.kind === 'shorelineCorner' ? 5 : 4;

      gridLayer.fillStyle(definition.debugStyle.color, definition.debugStyle.alpha);
      gridLayer.fillCircle(cornerPoint.x, cornerPoint.y, radius);
    }
  }

  private drawResolvedTransitionArt(
    chunk: TileChunk,
    resolvedTile: ResolvedTerrainTile,
    tileCenterX: number,
    tileCenterY: number,
  ): void {
    resolvedTile.transitionOverlays.forEach(({ definition, transform }) => {
      if (!definition.enabled || !this.scene.textures.exists(definition.spriteFrame)) {
        return;
      }

      const frame = this.scene.textures.getFrame(definition.spriteFrame);

      if (!frame) return;

      const drawX = Math.round(tileCenterX - frame.width / 2 - chunk.bounds.x);
      const drawY = Math.round(tileCenterY - this.transform.tileHeight / 2 - chunk.bounds.y);

      if (definition.renderMode !== 'overlay') {
        return;
      }

      this.drawTextureFrame(chunk, definition.spriteFrame, transform, frame, drawX, drawY);
    });
  }

  private getReplacementTransition(
    resolvedTile: ResolvedTerrainTile,
  ): ResolvedTerrainTransition | null {
    return resolvedTile.transitionOverlays.find(
      ({ definition }) =>
        definition.enabled &&
        definition.renderMode === 'replaceBase' &&
        this.scene.textures.exists(definition.spriteFrame),
    ) ?? null;
  }

  private getTileStamp(textureKey: string): Phaser.GameObjects.Image {
    if (!this.tileStamp) {
      this.tileStamp = new Phaser.GameObjects.Image(this.scene, 0, 0, textureKey);
      this.tileStamp.setOrigin(0.5, 0.5);
    }

    return this.tileStamp;
  }
}

function chunkKey(config: ChunkConfig): string {
  return `${config.startX},${config.startY}`;
}

function isEdgeDirection(direction: string): direction is IsoEdgeKey {
  return direction === 'xPlus' || direction === 'xMinus' || direction === 'yPlus' || direction === 'yMinus';
}

function isCornerDirection(direction: string): direction is IsoCornerKey {
  return (
    direction === 'xPlusYPlus' ||
    direction === 'xPlusYMinus' ||
    direction === 'xMinusYPlus' ||
    direction === 'xMinusYMinus'
  );
}

function getEdgeDebugLine(points: Phaser.Geom.Point[], direction: IsoEdgeKey): [Phaser.Geom.Point, Phaser.Geom.Point] {
  const [top, right, bottom, left] = points;

  switch (direction) {
    case 'xPlus':
      return [right, bottom];
    case 'xMinus':
      return [left, top];
    case 'yPlus':
      return [bottom, left];
    case 'yMinus':
      return [top, right];
  }
}

function getCornerDebugPoint(points: Phaser.Geom.Point[], direction: IsoCornerKey): Phaser.Geom.Point {
  const [top, right, bottom, left] = points;

  switch (direction) {
    case 'xPlusYPlus':
      return bottom;
    case 'xPlusYMinus':
      return right;
    case 'xMinusYPlus':
      return left;
    case 'xMinusYMinus':
      return top;
  }
}
