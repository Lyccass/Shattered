import Phaser from 'phaser';
import { PLAYER_CONFIG } from './PlayerConfig';
import { getDynamicDepth, RENDER_DEPTHS } from '../render/RenderLayers';

export class PlayerVisualSystem {
  readonly shadow: Phaser.GameObjects.Ellipse;

  constructor(scene: Phaser.Scene, private readonly sprite: Phaser.GameObjects.Sprite) {
    this.sprite.setOrigin(PLAYER_CONFIG.originX, PLAYER_CONFIG.originY);
    this.shadow = scene.add.ellipse(
      sprite.x,
      sprite.y,
      PLAYER_CONFIG.shadowBaseWidth,
      PLAYER_CONFIG.shadowBaseHeight,
      PLAYER_CONFIG.shadowColor,
      PLAYER_CONFIG.shadowAlpha,
    );
    this.shadow.setDepth(RENDER_DEPTHS.SHADOW);
  }

  update(feetWorldY: number): void {
    this.sprite.setDepth(getDynamicDepth(feetWorldY, PLAYER_CONFIG.depthTieBreaker));
    this.shadow.setPosition(this.sprite.x, feetWorldY + PLAYER_CONFIG.shadowOffsetY);
    this.shadow.setDisplaySize(
      this.sprite.displayWidth * PLAYER_CONFIG.shadowWidthRatio,
      this.sprite.displayWidth * PLAYER_CONFIG.shadowHeightRatio,
    );
  }
}
