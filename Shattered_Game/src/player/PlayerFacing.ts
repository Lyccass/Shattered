import Phaser from 'phaser';
import type { PlayerAnimationDirection } from './PlayerAssets';

export type PlayerFacingDirection = 'up' | 'down' | 'left' | 'right';

export function resolveFacingFromIntent(
  intent: Phaser.Math.Vector2,
  previousFacing: PlayerFacingDirection,
): PlayerFacingDirection {
  if (intent.lengthSq() === 0) {
    return previousFacing;
  }

  const absX = Math.abs(intent.x);
  const absY = Math.abs(intent.y);

  if (absY > absX) {
    return intent.y < 0 ? 'up' : 'down';
  }

  return intent.x < 0 ? 'left' : 'right';
}

// Maps tile-space 8-direction sectors to sprite animation directions.
// Tile-space derivation from world intent:
//   iso: worldX = (tx - ty) * tileWidth/2, worldY = (tx + ty) * tileHeight/2
//   inverse: tx = worldY/tileHeight + worldX/tileWidth
//            ty = worldY/tileHeight - worldX/tileWidth
//
// Sector layout (0=E tile, counter-clockwise every 45°):
//   0: E tile  → screen lower-right → right_down
//   1: SE diag → screen pure down   → down
//   2: S tile  → screen lower-left  → left_down
//   3: SW diag → screen pure left   → left_down
//   4: W tile  → screen upper-left  → left_up
//   5: NW diag → screen pure up     → up
//   6: N tile  → screen upper-right → right_up
//   7: NE diag → screen pure right  → right_down
const ANIM_DIR_BY_SECTOR: PlayerAnimationDirection[] = [
  'right_down',
  'down',
  'left_down',
  'left_down',
  'left_up',
  'up',
  'right_up',
  'right_down',
];

export function worldIntentToAnimationDirection(
  intent: Phaser.Math.Vector2,
  tileWidth: number,
  tileHeight: number,
): PlayerAnimationDirection {
  const tx = intent.y / tileHeight + intent.x / tileWidth;
  const ty = intent.y / tileHeight - intent.x / tileWidth;
  const angle = Math.atan2(ty, tx);
  const normalized = (angle + Math.PI * 2) % (Math.PI * 2);
  const sector = Math.floor((normalized + Math.PI / 8) / (Math.PI / 4)) % 8;

  return ANIM_DIR_BY_SECTOR[sector];
}

export function getFacingLookaheadWorldOffset(
  facing: PlayerFacingDirection,
  tileWidth: number,
  tileHeight: number,
): Phaser.Math.Vector2 {
  switch (facing) {
    case 'up':
      return new Phaser.Math.Vector2(0, -tileHeight);
    case 'down':
      return new Phaser.Math.Vector2(0, tileHeight);
    case 'left':
      return new Phaser.Math.Vector2(-tileWidth / 2, 0);
    case 'right':
      return new Phaser.Math.Vector2(tileWidth / 2, 0);
  }
}
