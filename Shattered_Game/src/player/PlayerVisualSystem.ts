import Phaser from 'phaser';
import { PLAYER_CONFIG } from './PlayerConfig';
import { getDynamicDepth } from '../render/RenderLayers';

export class PlayerVisualSystem {
  constructor(private readonly sprite: Phaser.GameObjects.Sprite) {
    this.sprite.setOrigin(PLAYER_CONFIG.originX, PLAYER_CONFIG.originY);
  }

  update(feetWorldY: number): void {
    this.sprite.setDepth(getDynamicDepth(feetWorldY, PLAYER_CONFIG.depthTieBreaker));
  }
}
