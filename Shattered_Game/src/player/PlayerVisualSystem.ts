import Phaser from 'phaser';
import { PlayerAnimationStateController, type PlayerAnimationStateId } from './PlayerAnimationState';
import {
  PLAYER_DASH_ANIMATION_KEY,
  PLAYER_DEAD_ANIMATION_KEY,
  getPlayerDirectionalAnimationKey,
  PLAYER_HURT_ANIMATION_KEY,
  PLAYER_IDLE_ANIMATION_KEY,
  PLAYER_SPRINT_ANIMATION_KEY,
  PLAYER_SPRINT_UP_ANIMATION_KEY,
  PLAYER_WALK_ANIMATION_KEY,
  PLAYER_WALK_UP_ANIMATION_KEY,
  type PlayerAnimationDirection,
} from './PlayerAssets';
import { PLAYER_CONFIG } from './PlayerConfig';
import { getDynamicDepth } from '../render/RenderLayers';
import type { PlayerFacingDirection } from './PlayerFacing';

type HorizontalFacing = 'left' | 'right';

export class PlayerVisualSystem {
  private readonly animationState = new PlayerAnimationStateController();
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
    lateralIntentX = 0,
  ): void {
    this.animationState.syncMovementState(isMoving, nowMs);
    this.applyVisualState(
      this.animationState.getState(nowMs),
      isMoving,
      isSprinting,
      facingDirection,
      horizontalFacing,
      lateralIntentX,
    );
    this.sprite.setDepth(getDynamicDepth(feetWorldY, PLAYER_CONFIG.depthTieBreaker));
  }

  requestCombatState(state: PlayerAnimationStateId, nowMs: number, durationMs = 0): void {
    this.animationState.requestState(state, nowMs, durationMs);
  }

  resetCombatState(): void {
    this.animationState.reset();
  }

  getCombatState(nowMs: number): PlayerAnimationStateId {
    return this.animationState.getState(nowMs);
  }

  private applyVisualState(
    state: PlayerAnimationStateId,
    isMoving: boolean,
    isSprinting: boolean,
    facingDirection: PlayerFacingDirection,
    horizontalFacing: HorizontalFacing,
    lateralIntentX: number,
  ): void {
    this.sprite.clearTint();
    this.sprite.setScale(PLAYER_CONFIG.visualScale);
    this.sprite.setFlipX(false);

    const animationKey = resolveAnimationKey(
      state,
      isMoving,
      isSprinting,
      facingDirection,
      horizontalFacing,
      lateralIntentX,
    );
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
  state: PlayerAnimationStateId,
  _isMoving: boolean,
  isSprinting: boolean,
  facingDirection: PlayerFacingDirection,
  horizontalFacing: HorizontalFacing,
  lateralIntentX: number,
): string {
  const direction = resolveAnimationDirection(facingDirection, horizontalFacing, lateralIntentX);

  switch (state) {
    case 'move':
      if (isSprinting) {
        return getPlayerDirectionalAnimationKey(
          facingDirection === 'up' ? PLAYER_SPRINT_UP_ANIMATION_KEY : PLAYER_SPRINT_ANIMATION_KEY,
          direction,
        );
      }
      return getPlayerDirectionalAnimationKey(
        facingDirection === 'up' ? PLAYER_WALK_UP_ANIMATION_KEY : PLAYER_WALK_ANIMATION_KEY,
        direction,
      );
    case 'dodge':
      return getPlayerDirectionalAnimationKey(PLAYER_DASH_ANIMATION_KEY, direction);
    case 'hurt':
      return getPlayerDirectionalAnimationKey(PLAYER_HURT_ANIMATION_KEY, direction);
    case 'dead':
      return getPlayerDirectionalAnimationKey(PLAYER_DEAD_ANIMATION_KEY, direction);
    case 'idle':
    default:
      return getPlayerDirectionalAnimationKey(PLAYER_IDLE_ANIMATION_KEY, direction);
  }
}

function resolveAnimationDirection(
  facingDirection: PlayerFacingDirection,
  horizontalFacing: HorizontalFacing,
  lateralIntentX: number,
): PlayerAnimationDirection {
  if (facingDirection === 'up') {
    if (Math.abs(lateralIntentX) <= 0.001) {
      return 'up';
    }
    return horizontalFacing === 'left' ? 'left_up' : 'right_up';
  }

  if (facingDirection === 'down') {
    return 'down';
  }

  return horizontalFacing === 'left' ? 'left_down' : 'right_down';
}
