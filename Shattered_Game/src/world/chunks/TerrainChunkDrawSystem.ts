import Phaser from 'phaser';
import { RENDER_DEPTHS } from '../../render/RenderLayers';
import { IsoTransform } from '../IsoTransform';
import { TerrainResolutionCache } from '../terrain/TerrainResolutionCache';
import type {
  IsoCornerKey,
  IsoEdgeKey,
  ResolvedTerrainTile,
  ResolvedTerrainTransition,
} from '../terrain/TerrainTypes';
import type { GridMode } from '../IsoTilemapTypes';
import {
  getChunkFootprintPoints,
  type TerrainChunkConfig,
} from './TerrainChunkMath';

const GRID_ALPHA = 0.055;

export type MaterializedTerrainChunk = TerrainChunkConfig & {
  groundLayer: Phaser.GameObjects.RenderTexture;
  gridLayer: Phaser.GameObjects.RenderTexture;
  chunkDebugLayer: Phaser.GameObjects.Graphics;
  groundDrawOrder: Array<{ gridX: number; gridY: number }>;
  gridDrawOrder: Array<{ gridX: number; gridY: number }>;
  groundDrawIndex: number;
  gridDrawIndex: number;
  isGroundReady: boolean;
  builtGridMode: GridMode;
  gridBuildMode: GridMode;
  lastDebugSignature?: string;
};

export class TerrainChunkDrawSystem {
  private tileStamp?: Phaser.GameObjects.Image;
  private gridScratch?: Phaser.GameObjects.Graphics;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly transform: IsoTransform,
    private readonly terrainResolutionCache: TerrainResolutionCache,
  ) {}

  materializeChunk(config: TerrainChunkConfig): MaterializedTerrainChunk {
    const groundLayer = this.scene.add.renderTexture(
      config.bounds.x,
      config.bounds.y,
      config.bounds.width,
      config.bounds.height,
    );
    const gridLayer = this.scene.add.renderTexture(
      config.bounds.x,
      config.bounds.y,
      config.bounds.width,
      config.bounds.height,
    );
    const chunkDebugLayer = this.scene.add.graphics();

    groundLayer.setOrigin(0, 0);
    gridLayer.setOrigin(0, 0);
    groundLayer.setDepth(RENDER_DEPTHS.GROUND);
    gridLayer.setDepth(RENDER_DEPTHS.GRID);
    chunkDebugLayer.setDepth(RENDER_DEPTHS.DEBUG - 1);

    return {
      ...config,
      groundLayer,
      gridLayer,
      chunkDebugLayer,
      groundDrawOrder: createTileDrawOrder(config, true),
      gridDrawOrder: createTileDrawOrder(config, false),
      groundDrawIndex: 0,
      gridDrawIndex: 0,
      isGroundReady: false,
      builtGridMode: 'off',
      gridBuildMode: 'off',
    };
  }

  buildGroundChunkStep(chunk: MaterializedTerrainChunk, maxTiles: number): number {
    if (chunk.groundDrawIndex === 0) {
      chunk.groundLayer.clear();
      chunk.groundLayer.setVisible(false);
    }

    let processedTiles = 0;

    while (processedTiles < maxTiles && chunk.groundDrawIndex < chunk.groundDrawOrder.length) {
      const { gridX, gridY } = chunk.groundDrawOrder[chunk.groundDrawIndex];
      const resolvedTile = this.terrainResolutionCache.resolveTile(gridX, gridY);
      chunk.groundDrawIndex += 1;
      processedTiles += 1;

      if (!resolvedTile) {
        continue;
      }

      const replacementTransition = this.getReplacementTransition(resolvedTile);
      const textureKey = replacementTransition?.definition.spriteFrame ?? resolvedTile.baseTileDefinition.spriteFrame;
      const frame = this.scene.textures.getFrame(textureKey);

      if (!frame) {
        continue;
      }

      const tileCenter = this.transform.getTileCenterWorld(gridX, gridY);
      const drawX = Math.round(tileCenter.x - frame.width / 2 - chunk.bounds.x);
      const drawY = Math.round(tileCenter.y - this.transform.tileHeight / 2 - chunk.bounds.y);

      if (replacementTransition) {
        this.drawTextureFrame(chunk, textureKey, replacementTransition.transform, frame, drawX, drawY);
      } else {
        this.drawTextureFrame(chunk, resolvedTile.baseTileDefinition.spriteFrame, resolvedTile.baseTransform, frame, drawX, drawY);
      }

      this.drawResolvedTransitionArt(chunk, resolvedTile, tileCenter.x, tileCenter.y);
    }

    if (chunk.groundDrawIndex >= chunk.groundDrawOrder.length) {
      chunk.isGroundReady = true;
      chunk.groundLayer.setVisible(true);
    }

    return processedTiles;
  }

  buildGridChunkStep(chunk: MaterializedTerrainChunk, gridMode: GridMode, maxTiles: number): number {
    if (gridMode === 'off') {
      this.clearGridChunk(chunk);
      return 0;
    }

    if (chunk.gridBuildMode !== gridMode) {
      this.prepareGridChunkBuild(chunk, gridMode);
    }

    const scratch = this.getGridScratch();
    let processedTiles = 0;

    while (processedTiles < maxTiles && chunk.gridDrawIndex < chunk.gridDrawOrder.length) {
      const { gridX, gridY } = chunk.gridDrawOrder[chunk.gridDrawIndex];
      chunk.gridDrawIndex += 1;
      processedTiles += 1;
      const localPoints = toLocalPhaserPoints(
        this.transform.getTileDiamondPoints(gridX, gridY),
        chunk.bounds.x,
        chunk.bounds.y,
      );

      scratch.clear();
      scratch.lineStyle(1, gridMode === 'build' ? 0xd7f3ff : 0x1d4f36, gridMode === 'build' ? 0.16 : GRID_ALPHA);
      scratch.strokePoints(localPoints, true);

      if (gridMode === 'build') {
        this.drawTransitionDebugOverlaysForTile(scratch, gridX, gridY, localPoints);
      }

      chunk.gridLayer.draw(scratch);
    }

    if (chunk.gridDrawIndex >= chunk.gridDrawOrder.length) {
      chunk.gridLayer.setVisible(true);
      chunk.builtGridMode = gridMode;
      chunk.gridBuildMode = gridMode;
    }

    return processedTiles;
  }

  clearGridChunk(chunk: MaterializedTerrainChunk): void {
    chunk.gridLayer.clear();
    chunk.gridLayer.setVisible(false);
    chunk.gridDrawIndex = 0;
    chunk.builtGridMode = 'off';
    chunk.gridBuildMode = 'off';
  }

  drawChunkDebugOutline(
    chunk: MaterializedTerrainChunk,
    options: { visible: boolean; debugVisible: boolean },
  ): void {
    chunk.chunkDebugLayer.clear();

    if (!options.debugVisible) {
      chunk.chunkDebugLayer.setVisible(false);
      return;
    }

    const logicalColour = options.visible ? 0x34d399 : 0x60a5fa;
    const logicalAlpha = options.visible ? 0.9 : 0.4;
    const logicalPoints = getChunkFootprintPoints(this.transform, chunk, false);
    const bleedPoints = getChunkFootprintPoints(this.transform, chunk, true);

    chunk.chunkDebugLayer.setVisible(true);
    chunk.chunkDebugLayer.lineStyle(2, 0xf59e0b, 0.5);
    chunk.chunkDebugLayer.strokePoints(toPhaserPoints(bleedPoints), true);
    chunk.chunkDebugLayer.lineStyle(2, logicalColour, logicalAlpha);
    chunk.chunkDebugLayer.strokePoints(toPhaserPoints(logicalPoints), true);
  }

  destroyChunk(chunk: MaterializedTerrainChunk): void {
    chunk.groundLayer.destroy();
    chunk.gridLayer.destroy();
    chunk.chunkDebugLayer.destroy();
  }

  destroy(): void {
    this.tileStamp?.destroy();
    this.tileStamp = undefined;
    this.gridScratch?.destroy();
    this.gridScratch = undefined;
  }

  private prepareGridChunkBuild(chunk: MaterializedTerrainChunk, gridMode: GridMode): void {
    chunk.gridLayer.clear();
    chunk.gridLayer.setVisible(false);
    chunk.gridDrawIndex = 0;
    chunk.builtGridMode = 'off';
    chunk.gridBuildMode = gridMode;
  }

  private drawTransitionDebugOverlaysForTile(
    scratch: Phaser.GameObjects.Graphics,
    gridX: number,
    gridY: number,
    points: Phaser.Geom.Point[],
  ): void {
    const resolvedTile = this.terrainResolutionCache.resolveTile(gridX, gridY);

    if (!resolvedTile) {
      return;
    }

    resolvedTile.transitionOverlays.forEach((overlay) => {
      this.drawTransitionDebugOverlay(scratch, points, overlay);
    });
  }

  private drawTransitionDebugOverlay(
    gridLayer: Phaser.GameObjects.Graphics,
    points: Phaser.Geom.Point[],
    overlay: ResolvedTerrainTransition,
  ): void {
    const { definition } = overlay;

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
    chunk: MaterializedTerrainChunk,
    resolvedTile: ResolvedTerrainTile,
    tileCenterX: number,
    tileCenterY: number,
  ): void {
    resolvedTile.transitionOverlays.forEach(({ definition, transform }) => {
      if (!definition.enabled || !this.scene.textures.exists(definition.spriteFrame)) {
        return;
      }

      if (definition.renderMode !== 'overlay') {
        return;
      }

      const frame = this.scene.textures.getFrame(definition.spriteFrame);

      if (!frame) {
        return;
      }

      const drawX = Math.round(tileCenterX - frame.width / 2 - chunk.bounds.x);
      const drawY = Math.round(tileCenterY - this.transform.tileHeight / 2 - chunk.bounds.y);

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

  private drawTextureFrame(
    chunk: MaterializedTerrainChunk,
    textureKey: string,
    transform: { flipX: boolean; flipY: boolean; offsetX?: number; offsetY?: number; scale?: number },
    frame: Phaser.Textures.Frame,
    drawX: number,
    drawY: number,
  ): void {
    const { flipX, flipY, offsetX = 0, offsetY = 0, scale } = transform;

    if (!flipX && !flipY && scale === undefined && offsetX === 0 && offsetY === 0) {
      chunk.groundLayer.drawFrame(textureKey, undefined, drawX, drawY);
      return;
    }

    const stamp = this.getTileStamp(textureKey);
    const stampX = drawX + frame.width / 2 + offsetX;
    const stampY = scale === undefined
      ? drawY + frame.height / 2 + offsetY
      : drawY + this.transform.tileHeight / 2 + offsetY;

    stamp.setTexture(textureKey);
    stamp.setPosition(stampX, stampY);
    stamp.setFlip(flipX, flipY);
    stamp.setScale(scale ?? 1);

    chunk.groundLayer.draw(stamp);
    stamp.setScale(1);
  }

  private getTileStamp(textureKey: string): Phaser.GameObjects.Image {
    if (!this.tileStamp) {
      this.tileStamp = new Phaser.GameObjects.Image(this.scene, 0, 0, textureKey);
      this.tileStamp.setOrigin(0.5, 0.5);
    }

    return this.tileStamp;
  }

  private getGridScratch(): Phaser.GameObjects.Graphics {
    if (!this.gridScratch) {
      this.gridScratch = this.scene.add.graphics();
      this.gridScratch.setVisible(false);
    }

    return this.gridScratch;
  }
}

function createTileDrawOrder(
  chunk: Pick<TerrainChunkConfig, 'startX' | 'startY' | 'endX' | 'endY' | 'drawStartX' | 'drawStartY' | 'drawEndX' | 'drawEndY'>,
  useBleedRange: boolean,
): Array<{ gridX: number; gridY: number }> {
  const startX = useBleedRange ? chunk.drawStartX : chunk.startX;
  const startY = useBleedRange ? chunk.drawStartY : chunk.startY;
  const endX = useBleedRange ? chunk.drawEndX : chunk.endX;
  const endY = useBleedRange ? chunk.drawEndY : chunk.endY;
  const startDiagonal = startX + startY;
  const endDiagonal = endX + endY - 2;
  const tiles: Array<{ gridX: number; gridY: number }> = [];

  for (let diagonal = startDiagonal; diagonal <= endDiagonal; diagonal += 1) {
    for (let gridX = startX; gridX < endX; gridX += 1) {
      const gridY = diagonal - gridX;

      if (gridY >= startY && gridY < endY) {
        tiles.push({ gridX, gridY });
      }
    }
  }

  return tiles;
}

function toPhaserPoints(points: Array<{ x: number; y: number }>): Phaser.Geom.Point[] {
  return points.map((point) => new Phaser.Geom.Point(point.x, point.y));
}

function toLocalPhaserPoints(
  points: Phaser.Geom.Point[],
  offsetX: number,
  offsetY: number,
): Phaser.Geom.Point[] {
  return points.map((point) => new Phaser.Geom.Point(point.x - offsetX, point.y - offsetY));
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
