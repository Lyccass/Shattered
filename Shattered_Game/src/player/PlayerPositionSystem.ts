import Phaser from 'phaser';
import { PLAYER_CONFIG } from './PlayerConfig';

export class PlayerPositionSystem {
  getFeetPoint(sprite: Phaser.GameObjects.Sprite): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(sprite.x, this.getFeetYForSpriteY(sprite, sprite.y));
  }

  getFeetYForSpriteY(sprite: Phaser.GameObjects.Sprite, spriteY: number): number {
    return spriteY + PLAYER_CONFIG.feetAnchorFromCenterY * sprite.scaleY;
  }
}
