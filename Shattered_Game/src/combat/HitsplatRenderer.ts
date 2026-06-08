import Phaser from 'phaser';
import { getDynamicDepth } from '../render/RenderLayers';

const HOLD_MS = 600;     // stays fully visible before fading
const FADE_MS = 800;     // then fades out over this long
const FLOAT_DIST = 32;

export class HitsplatRenderer {
  constructor(private readonly scene: Phaser.Scene) {}

  show(
    worldX: number,
    worldY: number,
    damage: number,
    delayMs = 0,
    label?: string,
    color?: string,
  ): void {
    const offsetX = (Math.random() - 0.5) * 10;
    const isMiss = damage === 0;
    const textValue = isMiss ? 'Miss' : label ? `${label} -${damage}` : String(damage);
    const text = this.scene.add.text(worldX + offsetX, worldY - 36, textValue, {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '14px',
      color: color ?? (isMiss ? '#94a3b8' : '#facc15'),
      stroke: '#000000',
      strokeThickness: 3,
    });
    text.setOrigin(0.5, 1);
    text.setDepth(getDynamicDepth(worldY, 20));
    text.setAlpha(0);

    // Float up quickly, hold, then fade out slowly
    this.scene.tweens.add({
      targets: text,
      y: worldY - 36 - FLOAT_DIST,
      duration: HOLD_MS,
      delay: delayMs,
      ease: 'Cubic.Out',
      onStart: () => text.setAlpha(1),
      onComplete: () => {
        this.scene.tweens.add({
          targets: text,
          alpha: 0,
          duration: FADE_MS,
          ease: 'Linear',
          onComplete: () => text.destroy(),
        });
      },
    });
  }

  destroy(): void {
    // Tweens auto-destroy their text targets on complete; no tracking needed.
  }
}
