import Phaser from 'phaser';

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
