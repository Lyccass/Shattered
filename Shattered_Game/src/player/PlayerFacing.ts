import Phaser from 'phaser';

export type PlayerFacingDirection = 'up' | 'down' | 'left' | 'right';

export function resolveFacingFromIntent(
  intent: Phaser.Math.Vector2,
  previousFacing: PlayerFacingDirection,
): PlayerFacingDirection {
  if (intent.x !== 0 && intent.y === 0) {
    return intent.x < 0 ? 'left' : 'right';
  }

  if (intent.y !== 0 && intent.x === 0) {
    return intent.y < 0 ? 'up' : 'down';
  }

  return previousFacing;
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
