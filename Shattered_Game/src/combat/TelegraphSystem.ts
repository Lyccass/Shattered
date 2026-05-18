import Phaser from 'phaser';
import { getDynamicDepth, RENDER_DEPTHS } from '../render/RenderLayers';
import { TelegraphStore } from './TelegraphStore';
import type { TelegraphDefinition, TelegraphSnapshot } from './TelegraphTypes';

export class TelegraphSystem {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly store = new TelegraphStore();

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(RENDER_DEPTHS.DEBUG - 60);
    this.graphics.setVisible(false);
  }

  showTelegraph(definition: TelegraphDefinition): void {
    this.store.showTelegraph(definition);
  }

  removeTelegraph(id: string): boolean {
    const removed = this.store.removeTelegraph(id);

    if (removed) {
      this.render([]);
    }

    return removed;
  }

  update(nowMs: number): void {
    this.render(this.store.getSnapshots(nowMs));
  }

  clear(): void {
    this.store.clear();
    this.render([]);
  }

  destroy(): void {
    this.clear();
    this.graphics.destroy();
  }

  private render(telegraphs: TelegraphSnapshot[]): void {
    this.graphics.clear();

    if (telegraphs.length === 0) {
      this.graphics.setVisible(false);
      return;
    }

    let maxDepthY = 0;

    telegraphs.forEach((telegraph) => {
      const color = telegraph.warningColor ?? 0xef4444;
      const strokeAlpha = telegraph.strokeAlpha ?? telegraph.alpha;
      const fillAlpha = telegraph.alpha * (telegraph.fillAlphaMultiplier ?? 0.18);
      maxDepthY = Math.max(maxDepthY, telegraph.worldY);
      this.graphics.lineStyle(2, color, strokeAlpha);
      this.graphics.fillStyle(color, fillAlpha);

      switch (telegraph.shape.kind) {
        case 'circle':
          this.graphics.fillCircle(telegraph.worldX, telegraph.worldY, telegraph.shape.radius);
          this.graphics.strokeCircle(telegraph.worldX, telegraph.worldY, telegraph.shape.radius);
          break;

        case 'ellipse':
          this.graphics.fillEllipse(
            telegraph.worldX,
            telegraph.worldY,
            telegraph.shape.radiusX * 2,
            telegraph.shape.radiusY * 2,
          );
          this.graphics.strokeEllipse(
            telegraph.worldX,
            telegraph.worldY,
            telegraph.shape.radiusX * 2,
            telegraph.shape.radiusY * 2,
          );
          break;

        case 'rectangle': {
          const points = createRotatedRectanglePoints(
            telegraph.worldX,
            telegraph.worldY,
            telegraph.shape.width,
            telegraph.shape.height,
            telegraph.shape.rotationRad ?? 0,
          );
          this.graphics.beginPath();
          this.graphics.moveTo(points[0].x, points[0].y);
          points.slice(1).forEach((point) => this.graphics.lineTo(point.x, point.y));
          this.graphics.closePath();
          this.graphics.fillPath();
          this.graphics.strokePath();
          break;
        }

        case 'line': {
          const rotation = telegraph.shape.rotationRad ?? 0;
          const halfLength = telegraph.shape.length / 2;
          const dx = Math.cos(rotation) * halfLength;
          const dy = Math.sin(rotation) * halfLength;
          this.graphics.lineBetween(
            telegraph.worldX - dx,
            telegraph.worldY - dy,
            telegraph.worldX + dx,
            telegraph.worldY + dy,
          );
          this.graphics.fillCircle(
            telegraph.worldX - dx,
            telegraph.worldY - dy,
            telegraph.shape.thickness / 2,
          );
          this.graphics.fillCircle(
            telegraph.worldX + dx,
            telegraph.worldY + dy,
            telegraph.shape.thickness / 2,
          );
          break;
        }

        case 'polygon':
          if (telegraph.shape.points.length >= 2) {
            const points = telegraph.shape.points.map((point) =>
              new Phaser.Math.Vector2(telegraph.worldX + point.x, telegraph.worldY + point.y),
            );
            this.graphics.beginPath();
            this.graphics.moveTo(points[0].x, points[0].y);
            points.slice(1).forEach((point) => this.graphics.lineTo(point.x, point.y));
            this.graphics.closePath();
            this.graphics.fillPath();
            this.graphics.strokePath();
          }
          break;
      }
    });

    this.graphics.setDepth(getDynamicDepth(maxDepthY, 325));
    this.graphics.setVisible(true);
  }
}

function createRotatedRectanglePoints(
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  rotationRad: number,
): Phaser.Math.Vector2[] {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const localPoints = [
    new Phaser.Math.Vector2(-halfWidth, -halfHeight),
    new Phaser.Math.Vector2(halfWidth, -halfHeight),
    new Phaser.Math.Vector2(halfWidth, halfHeight),
    new Phaser.Math.Vector2(-halfWidth, halfHeight),
  ];

  return localPoints.map((point) => {
    const rotated = point.clone().rotate(rotationRad);
    rotated.x += centerX;
    rotated.y += centerY;
    return rotated;
  });
}
