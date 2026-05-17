import Phaser from 'phaser';
import { CombatAnimationStateController } from '../combat/CombatAnimationStateController';
import type { CombatAnimationStateId } from '../combat/CombatAnimationTypes';
import { PLAYER_CONFIG } from './PlayerConfig';
import { getDynamicDepth } from '../render/RenderLayers';

export class PlayerVisualSystem {
  private readonly animationState = new CombatAnimationStateController();

  constructor(private readonly sprite: Phaser.GameObjects.Sprite) {
    this.sprite.setOrigin(PLAYER_CONFIG.originX, PLAYER_CONFIG.originY);
  }

  update(feetWorldY: number, nowMs: number, isMoving: boolean): void {
    this.animationState.syncMovementState(isMoving, nowMs);
    this.applyVisualState(this.animationState.getState(nowMs));
    this.sprite.setDepth(getDynamicDepth(feetWorldY, PLAYER_CONFIG.depthTieBreaker));
  }

  requestCombatState(state: CombatAnimationStateId, nowMs: number, durationMs = 0): void {
    this.animationState.requestState(state, nowMs, durationMs);
    this.applyVisualState(this.animationState.getState(nowMs));
  }

  getCombatState(nowMs: number): CombatAnimationStateId {
    return this.animationState.getState(nowMs);
  }

  private applyVisualState(state: CombatAnimationStateId): void {
    this.sprite.clearTint();
    this.sprite.setScale(PLAYER_CONFIG.visualScale);

    switch (state) {
      case 'attack_windup':
        this.sprite.setTint(0xfacc15);
        this.sprite.setScale(PLAYER_CONFIG.visualScale * 1.03);
        break;
      case 'attack_active':
        this.sprite.setTint(0xfb923c);
        this.sprite.setScale(PLAYER_CONFIG.visualScale * 1.06);
        break;
      case 'attack_recovery':
        this.sprite.setTint(0xe5e7eb);
        break;
      case 'dodge':
        this.sprite.setTint(0x38bdf8);
        this.sprite.setScale(PLAYER_CONFIG.visualScale * 0.96);
        break;
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
