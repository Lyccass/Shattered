import Phaser from 'phaser';
import { getDynamicDepth } from '../render/RenderLayers';
import type { EnemyVisualId } from './EnemyTypes';
import {
  getEnemyAnimationKey,
  getEnemyVisualDefinition,
  type EnemyVisualDefinition,
} from './EnemyVisualDefinitions';

export type EnemyTurnVisualState = 'idle' | 'moving' | 'windup' | 'attacking' | 'hurt' | 'dead';

const HIT_FLASH_MS = 120;

const SHADOW = { color: 0x020617, alpha: 0.2 };
const BAR    = { width: 40, height: 4 };

export class EnemyVisualController {
  private shadow:           Phaser.GameObjects.Ellipse  | null = null;
  private visual:           Phaser.GameObjects.Sprite   | null = null;
  private healthBarGfx:     Phaser.GameObjects.Graphics | null = null;
  private currentAnimKey:   string | null = null;
  private hitFlashUntilMs = 0;
  private visualDefinition: EnemyVisualDefinition = getEnemyVisualDefinition('wolf');

  constructor(private readonly scene: Phaser.Scene) {}

  spawn(worldX: number, worldY: number, visualId: EnemyVisualId): void {
    this.destroy();
    this.visualDefinition = getEnemyVisualDefinition(visualId);
    const idleAnimation = this.visualDefinition.animations.idle;
    const shadow = this.visualDefinition.shadow;
    this.shadow = this.scene.add.ellipse(
      worldX,
      worldY + shadow.offsetY,
      shadow.radiusX,
      shadow.radiusY,
      SHADOW.color,
      SHADOW.alpha,
    );
    this.visual = this.scene.add.sprite(worldX, worldY, idleAnimation.sheetKey, 0);
    this.healthBarGfx = this.scene.add.graphics();
    this.visual.setOrigin(this.visualDefinition.originX, this.visualDefinition.originY);
    this.visual.setScale(this.visualDefinition.scale);
    this.currentAnimKey = getEnemyAnimationKey(this.visualDefinition.id, 'idle');
    this.visual.play(this.currentAnimKey);
  }

  flashHit(nowMs: number): void {
    this.hitFlashUntilMs = nowMs + HIT_FLASH_MS;
  }

  /**
   * Updates sprite position, animation, tints, and health bar each frame.
   * Call from EnemySystem.update() regardless of combat state.
   */
  applyTurnState(
    worldX: number,
    worldY: number,
    facingRightward: boolean,
    hp: number,
    maxHp: number,
    visualState: EnemyTurnVisualState,
    nowMs: number,
    showHealthBar = false,
  ): void {
    if (!this.visual) return;

    const shadow = this.visualDefinition.shadow;
    this.shadow?.setPosition(worldX, worldY + shadow.offsetY);
    this.shadow?.setDepth(getDynamicDepth(worldY, 4));

    this.visual.setPosition(worldX, worldY);
    this.visual.setFlipX(facingRightward);
    this.visual.setScale(this.visualDefinition.scale);
    this.visual.setDepth(getDynamicDepth(worldY, 8));
    this.visual.clearTint();

    const animKey = getEnemyAnimationKey(this.visualDefinition.id, visualState);
    if (animKey !== this.currentAnimKey) {
      this.visual.play(animKey);
      this.currentAnimKey = animKey;
    }

    switch (visualState) {
      case 'windup':
        this.visual.setTint(0xf59e0b);
        break;
      case 'attacking':
        this.visual.setTint(0xdc2626);
        break;
      case 'hurt':
        this.visual.setTint(0xffffff);
        break;
      case 'dead':
        this.visual.setTint(0x6b7280);
        break;
      default:
        break;
    }

    // Hit flash overrides tint
    if (nowMs < this.hitFlashUntilMs) {
      this.visual.setTint(0xffffff);
      const t = (this.hitFlashUntilMs - nowMs) / HIT_FLASH_MS;
      this.visual.setScale(this.visualDefinition.scale * (1 + 0.12 * t));
    }

    this.updateHealthBar(hp, maxHp, worldX, worldY, visualState, showHealthBar);

    if (this.healthBarGfx) {
      this.healthBarGfx.setDepth(getDynamicDepth(worldY, 16));
    }
  }

  setVisible(visible: boolean): void {
    this.visual?.setVisible(visible);
    this.shadow?.setVisible(visible);
    this.healthBarGfx?.setVisible(visible);
  }

  getWorldPosition(): { x: number; y: number } | null {
    if (!this.visual) return null;
    return { x: this.visual.x, y: this.visual.y };
  }

  destroy(): void {
    this.shadow?.destroy();
    this.shadow = null;
    this.visual?.destroy();
    this.visual = null;
    this.healthBarGfx?.destroy();
    this.healthBarGfx = null;
    this.currentAnimKey = null;
  }

  private updateHealthBar(
    hp: number,
    maxHp: number,
    worldX: number,
    worldY: number,
    visualState: EnemyTurnVisualState,
    showHealthBar: boolean,
  ): void {
    if (!this.healthBarGfx) return;

    if (visualState === 'dead' || !showHealthBar) {
      this.healthBarGfx.setVisible(false);
      return;
    }

    const pct = maxHp > 0 ? Math.max(0, hp / maxHp) : 0;
    const x = worldX - BAR.width / 2;
    const y = worldY - this.visualDefinition.healthBarOffsetY;

    this.healthBarGfx.clear();
    this.healthBarGfx.fillStyle(0x7f1d1d, 0.92);
    this.healthBarGfx.fillRect(x, y, BAR.width, BAR.height);

    if (pct > 0) {
      this.healthBarGfx.fillStyle(0x22c55e, 1);
      this.healthBarGfx.fillRect(x, y, Math.round(BAR.width * pct), BAR.height);
    }

    this.healthBarGfx.lineStyle(1, 0x000000, 0.55);
    this.healthBarGfx.strokeRect(x, y, BAR.width, BAR.height);
    this.healthBarGfx.setVisible(true);
  }
}
