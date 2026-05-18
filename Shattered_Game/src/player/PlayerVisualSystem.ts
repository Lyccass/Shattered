import Phaser from 'phaser';
import { CombatAnimationStateController } from '../combat/CombatAnimationStateController';
import type { CombatAnimationStateId } from '../combat/CombatAnimationTypes';
import {
  PLAYER_ATTACK_ANIMATION_KEY,
  PLAYER_DASH_ANIMATION_KEY,
  PLAYER_DEAD_ANIMATION_KEY,
  PLAYER_HURT_ANIMATION_KEY,
  PLAYER_IDLE_ANIMATION_KEY,
  PLAYER_SPRINT_ANIMATION_KEY,
  PLAYER_SPRINT_UP_ANIMATION_KEY,
  PLAYER_WALK_ANIMATION_KEY,
  PLAYER_WALK_UP_ANIMATION_KEY,
} from './PlayerAssets';
import { PLAYER_CONFIG } from './PlayerConfig';
import { getDynamicDepth } from '../render/RenderLayers';
import type { PlayerFacingDirection } from './PlayerFacing';

type HorizontalFacing = 'left' | 'right';

export class PlayerVisualSystem {
  private readonly animationState = new CombatAnimationStateController();
  private currentAnimationKey: string | null = null;

  constructor(private readonly sprite: Phaser.GameObjects.Sprite) {
    this.sprite.setOrigin(PLAYER_CONFIG.originX, PLAYER_CONFIG.originY);
  }

  update(
    feetWorldY: number,
    nowMs: number,
    isMoving: boolean,
    isSprinting: boolean,
    facingDirection: PlayerFacingDirection,
    horizontalFacing: HorizontalFacing,
  ): void {
    this.animationState.syncMovementState(isMoving, nowMs);
    this.applyVisualState(
      this.animationState.getState(nowMs),
      isMoving,
      isSprinting,
      facingDirection,
      horizontalFacing,
    );
    this.sprite.setDepth(getDynamicDepth(feetWorldY, PLAYER_CONFIG.depthTieBreaker));
  }

  requestCombatState(state: CombatAnimationStateId, nowMs: number, durationMs = 0): void {
    this.animationState.requestState(state, nowMs, durationMs);
  }

  getCombatState(nowMs: number): CombatAnimationStateId {
    return this.animationState.getState(nowMs);
  }

  private applyVisualState(
    state: CombatAnimationStateId,
    isMoving: boolean,
    isSprinting: boolean,
    facingDirection: PlayerFacingDirection,
    horizontalFacing: HorizontalFacing,
  ): void {
    this.sprite.clearTint();
    this.sprite.setScale(PLAYER_CONFIG.visualScale);
    this.sprite.setFlipX(horizontalFacing === 'left');

    const animationKey = resolveAnimationKey(state, isMoving, isSprinting, facingDirection);
    const ignoreIfPlaying = animationKey === this.currentAnimationKey;

    if (!ignoreIfPlaying) {
      this.sprite.play(animationKey, ignoreIfPlaying);
      this.currentAnimationKey = animationKey;
    }

    switch (state) {
      case 'hurt':
        this.sprite.setTint(0xef4444);
        break;
      case 'dead':
        this.sprite.setTint(0x6b7280);
        this.sprite.setScale(PLAYER_CONFIG.visualScale * 0.92);
        break;
      default:
        break;
    }
  }
}

function resolveAnimationKey(
  state: CombatAnimationStateId,
  isMoving: boolean,
  isSprinting: boolean,
  facingDirection: PlayerFacingDirection,
): string {
  switch (state) {
    case 'move':
      if (isSprinting) {
        return facingDirection === 'up'
          ? PLAYER_SPRINT_UP_ANIMATION_KEY
          : PLAYER_SPRINT_ANIMATION_KEY;
      }

      return facingDirection === 'up'
        ? PLAYER_WALK_UP_ANIMATION_KEY
        : PLAYER_WALK_ANIMATION_KEY;
    case 'attack_windup':
    case 'attack_active':
      return PLAYER_ATTACK_ANIMATION_KEY;
    case 'attack_recovery':
      if (isMoving) {
        if (isSprinting) {
          return facingDirection === 'up'
            ? PLAYER_SPRINT_UP_ANIMATION_KEY
            : PLAYER_SPRINT_ANIMATION_KEY;
        }

        return facingDirection === 'up'
          ? PLAYER_WALK_UP_ANIMATION_KEY
          : PLAYER_WALK_ANIMATION_KEY;
      }

      return PLAYER_IDLE_ANIMATION_KEY;
    case 'dodge':
      return PLAYER_DASH_ANIMATION_KEY;
    case 'hurt':
      return PLAYER_HURT_ANIMATION_KEY;
    case 'dead':
      return PLAYER_DEAD_ANIMATION_KEY;
    case 'idle':
    default:
      return PLAYER_IDLE_ANIMATION_KEY;
  }
}
