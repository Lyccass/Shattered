import type {
  ActionProgressDefinition,
  ActionProgressOutcome,
  ActionProgressSnapshot,
} from './ActionProgressTypes';

type ActiveActionState = ActionProgressDefinition & {
  elapsedMs: number;
};

export class ActionProgressSystem {
  private activeAction: ActiveActionState | null = null;

  start(definition: ActionProgressDefinition): ActionProgressOutcome | null {
    const cancelOutcome = this.cancel(
      definition.cancellationReason ?? 'Action cancelled.',
    );

    this.activeAction = {
      ...definition,
      elapsedMs: 0,
    };

    return cancelOutcome;
  }

  update(deltaMs: number): ActionProgressOutcome | null {
    if (!this.activeAction) {
      return null;
    }

    if (this.activeAction.canContinue && !this.activeAction.canContinue()) {
      return this.cancel(this.activeAction.cancellationReason ?? 'Action cancelled.');
    }

    this.activeAction.elapsedMs += Math.max(0, deltaMs);

    if (this.activeAction.elapsedMs < this.activeAction.durationMs) {
      return null;
    }

    const completedAction = this.activeAction;
    this.activeAction = null;
    const result = completedAction.onComplete();

    return {
      kind: 'completed',
      result,
      sfxEventId: result.ok ? completedAction.successSfxId : completedAction.failureSfxId,
    };
  }

  cancel(reason = 'Action cancelled.'): ActionProgressOutcome | null {
    if (!this.activeAction) {
      return null;
    }

    const cancelledAction = this.activeAction;
    this.activeAction = null;

    return {
      kind: 'cancelled',
      reason,
      sfxEventId: cancelledAction.cancelSfxId,
    };
  }

  isActive(): boolean {
    return this.activeAction !== null;
  }

  getSnapshot(): ActionProgressSnapshot | null {
    if (!this.activeAction) {
      return null;
    }

    return {
      actionId: this.activeAction.actionId,
      label: this.activeAction.label,
      durationMs: this.activeAction.durationMs,
      elapsedMs: this.activeAction.elapsedMs,
      progress01: Math.min(1, this.activeAction.elapsedMs / this.activeAction.durationMs),
      interactionType: this.activeAction.interactionType,
      targetId: this.activeAction.targetId,
    };
  }
}
