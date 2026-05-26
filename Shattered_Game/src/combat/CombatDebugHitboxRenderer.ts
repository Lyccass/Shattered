import Phaser from 'phaser';
import type { IsoTilemap } from '../world/IsoTilemap';
import type { PlayerAttackPhase } from './PlayerCombatState';
import type { PlayerAttackWorldShape } from './PlayerAttackTargeting';
import { snapToIsometricGridDirection } from './CombatGridDirection';

export class CombatDebugHitboxRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(9_500);
  }

  render({
    tilemap,
    playerTiles,
    enemyTiles,
    dodgeDirection,
    dodgeTileCount,
    playerAttackShape,
    playerAttackPhase,
  }: {
    tilemap: IsoTilemap | null;
    playerTiles: Array<{ x: number; y: number }>;
    enemyTiles: Array<{ x: number; y: number }>;
    dodgeDirection: Phaser.Math.Vector2 | null;
    dodgeTileCount: number;
    playerAttackShape: PlayerAttackWorldShape | null;
    playerAttackPhase: PlayerAttackPhase;
  }): void {
    if (!tilemap) {
      this.graphics.clear();
      return;
    }

    this.graphics.clear();

    drawTileSet(this.graphics, tilemap, playerTiles, 0x38bdf8, 0.28, 0.9);
    drawTileSet(this.graphics, tilemap, enemyTiles, 0xef4444, 0.28, 0.9);

    if (dodgeDirection && playerTiles[0]) {
      const [dgx, dgy] = snapToIsometricGridDirection(
        Math.atan2(dodgeDirection.y, dodgeDirection.x),
        tilemap.tileWidth,
        tilemap.tileHeight,
      );
      const dodgeTiles: Array<{ x: number; y: number }> = [];
      const playerTile = playerTiles[0];

      for (let step = 1; step <= dodgeTileCount; step++) {
        const tx = playerTile.x + dgx * step;
        const ty = playerTile.y + dgy * step;

        if (tilemap.isTileInBounds(tx, ty)) {
          dodgeTiles.push({ x: tx, y: ty });
        }
      }

      drawTileSet(this.graphics, tilemap, dodgeTiles, 0x22c55e, 0.30, 0.9);
    }

    if (
      (playerAttackPhase === 'windup' || playerAttackPhase === 'active')
      && playerAttackShape
    ) {
      const fillAlpha = playerAttackPhase === 'active' ? 0.40 : 0.16;
      const strokeAlpha = playerAttackPhase === 'active' ? 0.85 : 0.50;
      const color = playerAttackPhase === 'active' ? 0xfacc15 : 0xa5f3fc;

      drawAttackShape(this.graphics, playerAttackShape, color, fillAlpha, strokeAlpha);
    }
  }

  destroy(): void {
    this.graphics.destroy();
  }
}

function drawAttackShape(
  graphics: Phaser.GameObjects.Graphics,
  shape: PlayerAttackWorldShape,
  color: number,
  fillAlpha: number,
  strokeAlpha: number,
): void {
  if (shape.kind === 'cone') {
    drawCone(
      graphics,
      shape.originX, shape.originY,
      shape.facingRad, shape.rangePx, shape.halfAngleRad, shape.minRangePx,
      color, fillAlpha, strokeAlpha,
    );
  } else {
    drawRotatedRect(
      graphics,
      shape.centerX, shape.centerY,
      shape.lengthPx, shape.widthPx, shape.facingRad,
      color, fillAlpha, strokeAlpha,
    );
  }
}

function drawCone(
  graphics: Phaser.GameObjects.Graphics,
  originX: number,
  originY: number,
  facingRad: number,
  rangePx: number,
  halfAngleRad: number,
  minRangePx: number,
  color: number,
  fillAlpha: number,
  strokeAlpha: number,
  arcSteps = 14,
): void {
  graphics.lineStyle(2, color, strokeAlpha);
  graphics.fillStyle(color, fillAlpha);

  const startAngle = facingRad - halfAngleRad;
  const totalAngle = halfAngleRad * 2;

  if (minRangePx <= 0) {
    // Full wedge from origin.
    const points: Phaser.Geom.Point[] = [new Phaser.Geom.Point(originX, originY)];
    for (let i = 0; i <= arcSteps; i++) {
      const a = startAngle + (totalAngle * i) / arcSteps;
      points.push(new Phaser.Geom.Point(
        originX + Math.cos(a) * rangePx,
        originY + Math.sin(a) * rangePx,
      ));
    }
    graphics.fillPoints(points, true);
    graphics.strokePoints(points, true);
    return;
  }

  // Donut sector: outer arc forward, inner arc reversed.
  const outerPoints: Phaser.Geom.Point[] = [];
  const innerPoints: Phaser.Geom.Point[] = [];
  for (let i = 0; i <= arcSteps; i++) {
    const a = startAngle + (totalAngle * i) / arcSteps;
    outerPoints.push(new Phaser.Geom.Point(
      originX + Math.cos(a) * rangePx,
      originY + Math.sin(a) * rangePx,
    ));
    innerPoints.push(new Phaser.Geom.Point(
      originX + Math.cos(a) * minRangePx,
      originY + Math.sin(a) * minRangePx,
    ));
  }

  const ring: Phaser.Geom.Point[] = [...outerPoints, ...innerPoints.reverse()];
  graphics.fillPoints(ring, true);
  graphics.strokePoints(ring, true);
}

function drawRotatedRect(
  graphics: Phaser.GameObjects.Graphics,
  centerX: number,
  centerY: number,
  lengthPx: number,
  widthPx: number,
  rotationRad: number,
  color: number,
  fillAlpha: number,
  strokeAlpha: number,
): void {
  graphics.lineStyle(2, color, strokeAlpha);
  graphics.fillStyle(color, fillAlpha);

  const halfL = lengthPx / 2;
  const halfW = widthPx / 2;
  const cos = Math.cos(rotationRad);
  const sin = Math.sin(rotationRad);

  const corners = [
    { x: -halfL, y: -halfW },
    { x:  halfL, y: -halfW },
    { x:  halfL, y:  halfW },
    { x: -halfL, y:  halfW },
  ].map(({ x, y }) => new Phaser.Geom.Point(
    centerX + x * cos - y * sin,
    centerY + x * sin + y * cos,
  ));

  graphics.fillPoints(corners, true);
  graphics.strokePoints(corners, true);
}

function drawTileSet(
  graphics: Phaser.GameObjects.Graphics,
  tilemap: IsoTilemap,
  tiles: Array<{ x: number; y: number }>,
  color: number,
  fillAlpha: number,
  strokeAlpha: number,
): void {
  graphics.lineStyle(2, color, strokeAlpha);
  graphics.fillStyle(color, fillAlpha);

  for (const tile of tiles) {
    const points = tilemap.transform.getTileDiamondPoints(tile.x, tile.y);
    graphics.beginPath();
    graphics.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((p) => graphics.lineTo(p.x, p.y));
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
  }
}
