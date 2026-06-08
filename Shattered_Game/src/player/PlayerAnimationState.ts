export type PlayerAnimationStateId = 'idle' | 'move' | 'dodge' | 'hurt' | 'dead';

export class PlayerAnimationStateController {
  private state: PlayerAnimationStateId = 'idle';
  private stateEndMs = 0;

  syncMovementState(isMoving: boolean, nowMs: number): void {
    if (this.isOverridden(nowMs)) return;
    this.state = isMoving ? 'move' : 'idle';
  }

  getState(nowMs: number): PlayerAnimationStateId {
    if (this.stateEndMs > 0 && nowMs >= this.stateEndMs) {
      this.state = 'idle';
      this.stateEndMs = 0;
    }
    return this.state;
  }

  requestState(state: PlayerAnimationStateId, nowMs: number, durationMs = 0): void {
    this.state = state;
    this.stateEndMs = durationMs > 0 ? nowMs + durationMs : 0;
  }

  reset(): void {
    this.state = 'idle';
    this.stateEndMs = 0;
  }

  private isOverridden(nowMs: number): boolean {
    return this.stateEndMs > 0 && nowMs < this.stateEndMs;
  }
}
