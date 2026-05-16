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
import type { TerrainChunkConfig } from './TerrainChunkMath';

const GRID_ALPHA = 0.055;

export type MaterializedTerrainChunk = TerrainChunkConfig & {
  groundLayer: Phaser.GameObjects.RenderTexture;
  gridLayer: Phaser.GameObjects.Graphics;
  chunkDebugLayer: Phaser.GameObjects.Graphics;
};

export class TerrainChunkDrawSystem {
  private tileStamp?: Phaser.GameObjects.Image;

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
    const gridLayer = this.scene.add.graphics();
    const chunkDebugLayer = this.scene.add.graphics();

    groundLayer.setOrigin(0, 0);
    groundLayer.setDepth(RENDER_DEPTHS.GROUND);
    gridLayer.setDepth(RENDER_DEPTHS.GRID);
    chunkDebugLayer.setDepth(RENDER_DEPTHS.DEBUG - 1);

    return {
      ...config,
      groundLayer,
      gridLayer,
      chunkDebugLayer,
    };
  }

  drawGroundChunk(chunk: MaterializedTerrainChunk): void {
    chunk.groundLayer.clear();

    this.forEachTileInDrawOrder(chunk, true, (gridX, gridY) => {
      const resolvedTile = this.terrainResolutionCache.resolveTile(gridX, gridY);

      if (!resolvedTile) {
        return;
      }

      const replacementTransition = this.getReplacementTransition(resolvedTile);
      const textureKey = replacementTransition?.definition.spriteFrame ?? resolvedTile.baseTileDefinition.spriteFrame;
      const frame = this.scene.textures.getFrame(textureKey);

      if (!frame) {
        return;
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
    });
  }

  drawGridChunk(chunk: MaterializedTerrainChunk, gridMode: GridMode): void {
    chunk.gridLayer.clear();

    if (gridMode === 'off') {
      chunk.gridLayer.setVisible(false);
      return;
    }

    const alpha = gridMode === 'build' ? 0.16 : GRID_ALPHA;
    const colour = gridMode === 'build' ? 0xd7f3ff : 0x1d4f36;

    chunk.gridLayer.lineStyle(1, colour, alpha);

    for (let gridY = chunk.startY; gridY < chunk.endY; gridY += 1) {
      for (let gridX = chunk.startX; gridX < chunk.endX; gridX += 1) {
        chunk.gridLayer.strokePoints(this.transform.getTileDiamondPoints(gridX, gridY), true);
      }
    }

    if (gridMode === 'build') {
      this.drawTransitionDebugOverlays(chunk);
    }
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

    const colour = options.visible ? 0x34d399 : 0x60a5fa;
    const alpha = options.visible ? 0.85 : 0.3;

    chunk.chunkDebugLayer.setVisible(true);
    chunk.chunkDebugLayer.lineStyle(2, colour, alpha);
    chunk.chunkDebugLayer.strokeRect(
      chunk.bounds.x,
      chunk.bounds.y,
      chunk.bounds.width,
      chunk.bounds.height,
    );
  }

  destroyChunk(chunk: MaterializedTerrainChunk): void {
    chunk.groundLayer.destroy();
    chunk.gridLayer.destroy();
    chunk.chunkDebugLayer.destroy();
  }

  destroy(): void {
    this.tileStamp?.destroy();
    this.tileStamp = undefined;
  }

  private drawTransitionDebugOverlays(chunk: MaterializedTerrainChunk): void {
    this.forEachTileInDrawOrder(chunk, false, (gridX, gridY) => {
      const resolvedTile = this.terrainResolutionCache.resolveTile(gridX, gridY);

      if (!resolvedTile) {
        return;
      }

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

  private getTileStamp(textureKey: string): Phaser.GameObjects.Image {
    if (!this.tileStamp) {
      this.tileStamp = new Phaser.GameObjects.Image(this.scene, 0, 0, textureKey);
      this.tileStamp.setOrigin(0.5, 0.5);
    }

    return this.tileStamp;
  }

  private forEachTileInDrawOrder(
    chunk: TerrainChunkConfig,
    useBleedRange: boolean,
    callback: (gridX: number, gridY: number) => void,
  ): void {
    const startX = useBleedRange ? chunk.drawStartX : chunk.startX;
    const startY = useBleedRange ? chunk.drawStartY : chunk.startY;
    const endX = useBleedRange ? chunk.drawEndX : chunk.endX;
    const endY = useBleedRange ? chunk.drawEndY : chunk.endY;
    const startDiagonal = startX + startY;
    const endDiagonal = endX + endY - 2;

    for (let diagonal = startDiagonal; diagonal <= endDiagonal; diagonal += 1) {
      for (let gridX = startX; gridX < endX; gridX += 1) {
        const gridY = diagonal - gridX;

        if (gridY >= startY && gridY < endY) {
          callback(gridX, gridY);
        }
      }
    }
  }
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
