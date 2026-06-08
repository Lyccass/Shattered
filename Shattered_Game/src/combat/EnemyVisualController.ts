import Phaser from 'phaser';
import { getDynamicDepth } from '../render/RenderLayers';
import {
  ENEMY_WOLF_ATTACK_ANIMATION_KEY,
  ENEMY_WOLF_DEATH_ANIMATION_KEY,
  ENEMY_WOLF_IDLE_ANIMATION_KEY,
  ENEMY_WOLF_IDLE_SHEET_KEY,
  ENEMY_WOLF_RUN_ANIMATION_KEY,
  ENEMY_WOLF_WINDUP_ANIMATION_KEY,
} from './EnemyAssets';

export type EnemyTurnVisualState = 'idle' | 'moving' | 'windup' | 'attacking' | 'hurt' | 'dead';

const HIT_FLASH_MS = 120;

const SHADOW = { offsetY: 0, radiusX: 28, radiusY: 12, color: 0x020617, alpha: 0.2 };
const BAR    = { width: 40, height: 4, offsetY: 52 };
const WOLF = {
  originX: 0.5,
  originY: 0.68,
  scale: 2,
};

export class EnemyVisualController {
  private shadow:           Phaser.GameObjects.Ellipse  | null = null;
  private visual:           Phaser.GameObjects.Sprite   | null = null;
  private healthBarGfx:     Phaser.GameObjects.Graphics | null = null;
  private currentAnimKey:   string | null = null;
  private hitFlashUntilMs = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  spawn(worldX: number, worldY: number): void {
    this.destroy();
    this.shadow   = this.scene.add.ellipse(worldX, worldY + SHADOW.offsetY, SHADOW.radiusX, SHADOW.radiusY, SHADOW.color, SHADOW.alpha);
    this.visual   = this.scene.add.sprite(worldX, worldY, ENEMY_WOLF_IDLE_SHEET_KEY, 0);
    this.healthBarGfx = this.scene.add.graphics();
    this.visual.setOrigin(WOLF.originX, WOLF.originY);
    this.visual.setScale(WOLF.scale);
    this.visual.play(ENEMY_WOLF_IDLE_ANIMATION_KEY);
    this.currentAnimKey = ENEMY_WOLF_IDLE_ANIMATION_KEY;
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
  ): void {
    if (!this.visual) return;

    this.shadow?.setPosition(worldX, worldY + SHADOW.offsetY);
    this.shadow?.setDepth(getDynamicDepth(worldY, 4));

    this.visual.setPosition(worldX, worldY);
    this.visual.setFlipX(facingRightward);
    this.visual.setScale(WOLF.scale);
    this.visual.setDepth(getDynamicDepth(worldY, 8));
    this.visual.clearTint();

    const animKey = resolveAnimKey(visualState);
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
      this.visual.setScale(WOLF.scale * (1 + 0.12 * t));
    }

    this.updateHealthBar(hp, maxHp, worldX, worldY, visualState);

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
  ): void {
    if (!this.healthBarGfx) return;

    if (visualState === 'dead' || visualState === 'idle') {
      this.healthBarGfx.setVisible(false);
      return;
    }

    const pct = maxHp > 0 ? Math.max(0, hp / maxHp) : 0;
    const x = worldX - BAR.width / 2;
    const y = worldY - BAR.offsetY;

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

function resolveAnimKey(state: EnemyTurnVisualState): string {
  switch (state) {
    case 'moving':    return ENEMY_WOLF_RUN_ANIMATION_KEY;
    case 'windup':    return ENEMY_WOLF_WINDUP_ANIMATION_KEY;
    case 'attacking': return ENEMY_WOLF_ATTACK_ANIMATION_KEY;
    case 'dead':      return ENEMY_WOLF_DEATH_ANIMATION_KEY;
    default:          return ENEMY_WOLF_IDLE_ANIMATION_KEY;
  }
}
