import type { PlayerFacingDirection } from './PlayerFacing';

export function getFacingTileOffset(facing: PlayerFacingDirection): { x: number; y: number } {
  switch (facing) {
    case 'up':
      return { x: -1, y: -1 };
    case 'down':
      return { x: 1, y: 1 };
    case 'left':
      return { x: -1, y: 1 };
    case 'right':
      return { x: 1, y: -1 };
  }
}
