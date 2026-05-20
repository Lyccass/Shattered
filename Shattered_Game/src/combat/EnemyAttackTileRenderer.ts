import Phaser from 'phaser';
import { getDynamicDepth } from '../render/RenderLayers';
import type { IsoTilemap } from '../world/IsoTilemap';

export class EnemyAttackTileRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private tilemap: IsoTilemap | null = null;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
    this.graphics.setVisible(false);
  }

  setTilemap(tilemap: IsoTilemap | null): void {
    this.tilemap = tilemap;
    this.clear();
  }

  render(tiles: Array<{ x: number; y: number }>, shapeKind?: string): void {
    if (!this.tilemap || tiles.length === 0) {
      this.clear();
      return;
    }

    const color = resolveAttackColor(shapeKind ?? '');
    this.graphics.clear();
    this.graphics.fillStyle(color, 0.32);
    let maxDepthY = 0;

    tiles.forEach((tile) => {
      const points = this.tilemap!.transform.getTileDiamondPoints(tile.x, tile.y);
      maxDepthY = Math.max(maxDepthY, ...points.map((point) => point.y));
      this.graphics.beginPath();
      this.graphics.moveTo(points[0].x, points[0].y);
      points.slice(1).forEach((point) => this.graphics.lineTo(point.x, point.y));
      this.graphics.closePath();
      this.graphics.fillPath();
    });

    this.graphics.setDepth(getDynamicDepth(maxDepthY, 324));
    this.graphics.setVisible(true);
  }

  clear(): void {
    this.graphics.clear();
    this.graphics.setVisible(false);
  }

  destroy(): void {
    this.graphics.destroy();
  }
}

function resolveAttackColor(attackKind: string): number {
  switch (attackKind) {
    case 'jump':
      return 0xf97316;
    case 'stab':
      return 0xfbbf24;
    case 'cone':
      return 0xa855f7;
    default:
      return 0xf97316;
  }
}
