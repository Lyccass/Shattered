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

const ANIM = {
  windupLiftMax:     8,
  windupSqueezeX:    0.06,
  windupSqueezeY:    0.08,
  jumpArcLiftMax:    44,
  jumpScaleX:        1.08,
  jumpScaleY:        0.94,
  landSquashX:       0.28,
  landSquashY:       0.22,
  windupScaleBump:   1.08,
  activeScaleBump:   1.12,
  recoveryScaleBump: 0.96,
  deadScale:         0.9,
  hitFlashScale:     0.12,
};

const SHADOW = {
  offsetY:  4,
  radiusX:  28,
  radiusY:  12,
  color:    0x020617,
  alpha:    0.2,
};

const BAR = {
  width:    40,
  height:   4,
  offsetY:  60,
};

export class EnemyVisualController {
  private static readonly HIT_FLASH_MS = 120;

  private shadow: Phaser.GameObjects.Ellipse | null = null;
  private visual: Phaser.GameObjects.Sprite | null = null;
  private healthBarGraphics: Phaser.GameObjects.Graphics | null = null;
  private currentAnimationKey: string | null = null;
  private hitFlashUntilMs = 0;
  private deathPosition: { x: number; y: number } | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  spawn(state: EnemyRuntimeState): void {
    this.destroy();
    this.shadow = this.scene.add.ellipse(state.worldX, state.worldY - SHADOW.offsetY, SHADOW.radiusX, SHADOW.radiusY, SHADOW.color, SHADOW.alpha);
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

    // Freeze visual position at the frame of death so the corpse never drifts.
    if (state.currentState === 'dead') {
      this.deathPosition ??= { x: state.worldX, y: state.worldY };
    } else {
      this.deathPosition = null;
    }
    const renderX = this.deathPosition?.x ?? state.worldX;
    const renderY = this.deathPosition?.y ?? state.worldY;

    const activeAttack = state.currentAttackId
      ? definition.attacks.find((attack) => attack.id === state.currentAttackId) ?? null
      : null;
    const phaseProgress = getPhaseProgress(state, nowMs);
    let lift = 0;
    let scaleX = 1;
    let scaleY = 1;

    if (activeAttack?.kind === 'jump') {
      if (state.currentState === 'windup') {
        lift = ANIM.windupLiftMax * easeOut(phaseProgress);
        scaleX = 1.0 + ANIM.windupSqueezeX * phaseProgress;
        scaleY = 1.0 - ANIM.windupSqueezeY * phaseProgress;
      } else if (state.currentState === 'active') {
        const arc = 4 * phaseProgress * (1 - phaseProgress);
        lift = ANIM.jumpArcLiftMax * arc;
        scaleX = ANIM.jumpScaleX;
        scaleY = ANIM.jumpScaleY;
      } else if (state.currentState === 'recovery') {
        const squash = Math.max(0, 1 - phaseProgress * 5);
        scaleX = 1.0 + ANIM.landSquashX * squash;
        scaleY = 1.0 - ANIM.landSquashY * squash;
      }
    }

    this.shadow?.setPosition(renderX, renderY - 4);
    this.shadow?.setScale(Math.max(0.7, 1 - lift / 50), Math.max(0.6, 1 - lift / 58));
    this.shadow?.setDepth(getDynamicDepth(renderY, 4));

    this.visual.setPosition(renderX, renderY - 8 - lift);
    this.visual.setScale(scaleX, scaleY);
    this.visual.setFlipX(Math.cos(state.facingRad) > 0);
    this.visual.clearTint();
    this.visual.setDepth(getDynamicDepth(renderY, 8));

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
        this.visual.setScale(scaleX * ANIM.windupScaleBump, scaleY * ANIM.windupScaleBump);
        break;
      case 'active':
        this.visual.setTint(activeAttack?.kind === 'jump' ? 0xffffff : 0xdc2626);
        this.visual.setScale(scaleX * ANIM.activeScaleBump, scaleY * ANIM.activeScaleBump);
        break;
      case 'recovery': {
        // Pop to 1.1× at start of recovery then settle — draws eye to the punish window
        const popT = Math.max(0, 1 - phaseProgress * 5);
        const recoveryScale = ANIM.recoveryScaleBump + 0.14 * popT;
        this.visual.setTint(0x4ade80);
        this.visual.setScale(scaleX * recoveryScale, scaleY * recoveryScale);
        break;
      }
      case 'dead':
        this.visual.setTint(0x6b7280);
        this.visual.setScale(ANIM.deadScale);
        break;
      default:
        break;
    }

    if (this.hitFlashUntilMs > 0 && nowMs < this.hitFlashUntilMs) {
      const flashT = (this.hitFlashUntilMs - nowMs) / EnemyVisualController.HIT_FLASH_MS;
      this.visual.setTint(0xffffff);
      this.visual.setScale(
        this.visual.scaleX * (1 + ANIM.hitFlashScale * flashT),
        this.visual.scaleY * (1 + ANIM.hitFlashScale * flashT),
      );
    }

    this.updateHealthBar(state, definition, lift, renderX, renderY);
  }

  destroy(): void {
    this.shadow?.destroy();
    this.shadow = null;
    this.visual?.destroy();
    this.visual = null;
    this.healthBarGraphics?.destroy();
    this.healthBarGraphics = null;
    this.currentAnimationKey = null;
    this.deathPosition = null;
  }

  private updateHealthBar(
    state: EnemyRuntimeState,
    definition: EnemyDefinition,
    lift: number,
    renderX: number,
    renderY: number,
  ): void {
    if (!this.healthBarGraphics) {
      return;
    }

    if (
      state.currentState === 'dead'
      || state.currentState === 'idle'
      || state.currentState === 'reset'
    ) {
      this.healthBarGraphics.setVisible(false);
      return;
    }

    const maxHp = definition.maxHealth;
    const pct = maxHp > 0 ? Math.max(0, state.health / maxHp) : 0;
    const barW = BAR.width;
    const barH = BAR.height;
    const x = renderX - barW / 2;
    const y = renderY - 8 - lift - BAR.offsetY;

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
    this.healthBarGraphics.setDepth(getDynamicDepth(renderY, 16));
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
