import Phaser from 'phaser';
import type { IsoTilemap } from '../world/IsoTilemap';
import type { PlayerAttackPhase } from './PlayerCombatState';
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
    playerAttackTargetWorld,
    playerAttackPhase,
  }: {
    tilemap: IsoTilemap | null;
    playerTiles: Array<{ x: number; y: number }>;
    enemyTiles: Array<{ x: number; y: number }>;
    dodgeDirection: Phaser.Math.Vector2 | null;
    dodgeTileCount: number;
    playerAttackTargetWorld: { x: number; y: number } | null;
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
      && playerAttackTargetWorld
    ) {
      const targetTile = tilemap.transform.worldToTile(
        playerAttackTargetWorld.x,
        playerAttackTargetWorld.y,
      );
      const fillAlpha = playerAttackPhase === 'active' ? 0.52 : 0.22;
      const strokeAlpha = playerAttackPhase === 'active' ? 0.9 : 0.55;
      const color = playerAttackPhase === 'active' ? 0xfacc15 : 0x38bdf8;

      drawTileSet(this.graphics, tilemap, [targetTile], color, fillAlpha, strokeAlpha);
    }
  }

  destroy(): void {
    this.graphics.destroy();
  }
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
