import type { CombatAnimationSnapshot, CombatAnimationStateId } from './CombatAnimationTypes';

export class CombatAnimationStateController {
  private currentState: CombatAnimationStateId = 'idle';
  private lockedUntilMs: number | null = null;

  requestState(state: CombatAnimationStateId, nowMs: number, durationMs = 0): void {
    this.currentState = state;
    this.lockedUntilMs =
      state === 'dead'
        ? Number.POSITIVE_INFINITY
        : durationMs > 0
          ? nowMs + durationMs
          : null;
  }

  syncMovementState(isMoving: boolean, nowMs: number): void {
    this.settleExpiredLock(nowMs);

    if (this.isLocked(nowMs) || this.currentState === 'dead') {
      return;
    }

    this.currentState = isMoving ? 'move' : 'idle';
  }

  getState(nowMs: number): CombatAnimationStateId {
    this.settleExpiredLock(nowMs);
    return this.currentState;
  }

  getSnapshot(nowMs: number): CombatAnimationSnapshot {
    this.settleExpiredLock(nowMs);
    return {
      state: this.currentState,
      lockedUntilMs: Number.isFinite(this.lockedUntilMs ?? 0) ? this.lockedUntilMs : null,
    };
  }

  private isLocked(nowMs: number): boolean {
    return this.lockedUntilMs !== null && this.lockedUntilMs > nowMs;
  }

  private settleExpiredLock(nowMs: number): void {
    if (this.lockedUntilMs === Number.POSITIVE_INFINITY) {
      return;
    }

    if (this.lockedUntilMs !== null && nowMs >= this.lockedUntilMs) {
      this.lockedUntilMs = null;

      if (this.currentState !== 'dead') {
        this.currentState = 'idle';
      }
    }
  }
}
