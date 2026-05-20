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
import type { EnemyDefinition, EnemyRuntimeState } from './EnemyTypes';

export class EnemyVisualController {
  private static readonly HIT_FLASH_MS = 120;

  private shadow: Phaser.GameObjects.Ellipse | null = null;
  private visual: Phaser.GameObjects.Sprite | null = null;
  private healthBarGraphics: Phaser.GameObjects.Graphics | null = null;
  private currentAnimationKey: string | null = null;
  private hitFlashUntilMs = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  spawn(state: EnemyRuntimeState): void {
    this.destroy();
    this.shadow = this.scene.add.ellipse(state.worldX, state.worldY - 4, 28, 12, 0x020617, 0.2);
    this.visual = this.scene.add.sprite(state.worldX, state.worldY - 8, ENEMY_WOLF_IDLE_SHEET_KEY, 0);
    this.healthBarGraphics = this.scene.add.graphics();
    this.visual.setOrigin(0.5, 0.4);
    this.visual.setScale(2);
    this.visual.play(ENEMY_WOLF_IDLE_ANIMATION_KEY);
    this.currentAnimationKey = ENEMY_WOLF_IDLE_ANIMATION_KEY;
  }

  flashHit(nowMs: number): void {
    this.hitFlashUntilMs = nowMs + EnemyVisualController.HIT_FLASH_MS;
  }

  applyState(
    state: EnemyRuntimeState,
    definition: EnemyDefinition,
    nowMs: number,
    isActuallyMoving: boolean,
  ): void {
    if (!this.visual) {
      return;
    }

    const activeAttack = state.currentAttackId
      ? definition.attacks.find((attack) => attack.id === state.currentAttackId) ?? null
      : null;
    const phaseProgress = getPhaseProgress(state, nowMs);
    let lift = 0;
    let scaleX = 1;
    let scaleY = 1;

    if (activeAttack?.kind === 'jump') {
      if (state.currentState === 'windup') {
        lift = 8 * easeOut(phaseProgress);
        scaleX = 1.0 + 0.06 * phaseProgress;
        scaleY = 1.0 - 0.08 * phaseProgress;
      } else if (state.currentState === 'active') {
        const arc = 4 * phaseProgress * (1 - phaseProgress);
        lift = 44 * arc;
        scaleX = 1.08;
        scaleY = 0.94;
      } else if (state.currentState === 'recovery') {
        const squash = Math.max(0, 1 - phaseProgress * 5);
        scaleX = 1.0 + 0.28 * squash;
        scaleY = 1.0 - 0.22 * squash;
      }
    }

    this.shadow?.setPosition(state.worldX, state.worldY - 4);
    this.shadow?.setScale(Math.max(0.7, 1 - lift / 50), Math.max(0.6, 1 - lift / 58));
    this.shadow?.setDepth(getDynamicDepth(state.worldY, 4));

    this.visual.setPosition(state.worldX, state.worldY - 8 - lift);
    this.visual.setScale(scaleX, scaleY);
    this.visual.setFlipX(Math.cos(state.facingRad) > 0);
    this.visual.clearTint();
    this.visual.setDepth(getDynamicDepth(state.worldY, 8));

    const animationKey = resolveEnemyAnimationKey(
      state.currentState,
      isActuallyMoving,
      activeAttack?.kind ?? null,
    );

    if (animationKey !== this.currentAnimationKey) {
      this.visual.play(animationKey);
      this.currentAnimationKey = animationKey;
    }

    switch (state.currentState) {
      case 'windup':
        this.visual.setTint(0xf59e0b);
        this.visual.setScale(scaleX * 1.08, scaleY * 1.08);
        break;
      case 'active':
        this.visual.setTint(activeAttack?.kind === 'jump' ? 0xffffff : 0xdc2626);
        this.visual.setScale(scaleX * 1.12, scaleY * 1.12);
        break;
      case 'recovery':
        this.visual.setTint(0xfb7185);
        this.visual.setScale(scaleX * 0.96, scaleY * 0.96);
        break;
      case 'dead':
        this.visual.setTint(0x6b7280);
        this.visual.setScale(0.9);
        break;
      default:
        break;
    }

    if (this.hitFlashUntilMs > 0 && nowMs < this.hitFlashUntilMs) {
      const flashT = (this.hitFlashUntilMs - nowMs) / EnemyVisualController.HIT_FLASH_MS;
      this.visual.setTint(0xffffff);
      this.visual.setScale(
        this.visual.scaleX * (1 + 0.12 * flashT),
        this.visual.scaleY * (1 + 0.12 * flashT),
      );
    }

    this.updateHealthBar(state, definition, lift);
  }

  destroy(): void {
    this.shadow?.destroy();
    this.shadow = null;
    this.visual?.destroy();
    this.visual = null;
    this.healthBarGraphics?.destroy();
    this.healthBarGraphics = null;
    this.currentAnimationKey = null;
  }

  private updateHealthBar(
    state: EnemyRuntimeState,
    definition: EnemyDefinition,
    lift: number,
  ): void {
    if (!this.healthBarGraphics) {
      return;
    }

    if (state.currentState === 'dead') {
      this.healthBarGraphics.setVisible(false);
      return;
    }

    const maxHp = definition.maxHealth;
    const pct = maxHp > 0 ? Math.max(0, state.health / maxHp) : 0;
    const barW = 40;
    const barH = 4;
    const x = state.worldX - barW / 2;
    const y = state.worldY - 8 - lift - 60;

    this.healthBarGraphics.clear();
    this.healthBarGraphics.fillStyle(0x7f1d1d, 0.92);
    this.healthBarGraphics.fillRect(x, y, barW, barH);

    if (pct > 0) {
      const filledW = Math.round(barW * pct);
      this.healthBarGraphics.fillStyle(0x22c55e, 1);
      this.healthBarGraphics.fillRect(x, y, filledW, barH);
    }

    this.healthBarGraphics.lineStyle(1, 0x000000, 0.55);
    this.healthBarGraphics.strokeRect(x, y, barW, barH);
    this.healthBarGraphics.setDepth(getDynamicDepth(state.worldY, 16));
    this.healthBarGraphics.setVisible(true);
  }
}

function resolveEnemyAnimationKey(
  state: EnemyRuntimeState['currentState'],
  isActuallyMoving: boolean,
  activeAttackKind: string | null,
): string {
  switch (state) {
    case 'approach':
    case 'reset':
      return isActuallyMoving ? ENEMY_WOLF_RUN_ANIMATION_KEY : ENEMY_WOLF_IDLE_ANIMATION_KEY;
    case 'windup':
      return ENEMY_WOLF_WINDUP_ANIMATION_KEY;
    case 'active':
      return activeAttackKind === 'jump' ? ENEMY_WOLF_RUN_ANIMATION_KEY : ENEMY_WOLF_ATTACK_ANIMATION_KEY;
    case 'dead':
      return ENEMY_WOLF_DEATH_ANIMATION_KEY;
    case 'idle':
    case 'aggro':
    case 'recovery':
    case 'hurt':
    default:
      return ENEMY_WOLF_IDLE_ANIMATION_KEY;
  }
}

function getPhaseProgress(state: EnemyRuntimeState, nowMs: number): number {
  if (state.phaseStartedAtMs === null || state.phaseEndsAtMs === null) {
    return 0;
  }

  const duration = Math.max(1, state.phaseEndsAtMs - state.phaseStartedAtMs);
  return Phaser.Math.Clamp((nowMs - state.phaseStartedAtMs) / duration, 0, 1);
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}
