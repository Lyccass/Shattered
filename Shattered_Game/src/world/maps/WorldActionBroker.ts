import type { ActionProgressDefinition } from '../../actions/ActionProgressTypes';
import type { ActionProgressSystem } from '../../actions/ActionProgressSystem';
import type { GameEventBus } from '../../events/GameEventBus';
import type { InteractionResult } from '../../interactions/InteractionTypes';

export type ActionUpdate = {
  transitionRequest?: { targetMapId: string; targetSpawnId: string };
  uiResult: InteractionResult;
};

export class WorldActionBroker {
  constructor(
    private readonly actionProgressSystem: ActionProgressSystem,
    private readonly eventBus: GameEventBus,
    private readonly onInfoResult: (result: InteractionResult) => void,
  ) {}

  update(deltaMs: number): ActionUpdate | null {
    const outcome = this.actionProgressSystem.update(deltaMs);

    if (!outcome) {
      return null;
    }

    if (outcome.kind === 'cancelled') {
      this.eventBus.emitSfx(outcome.sfxEventId ?? 'action_cancelled');
      this.pushInfoResult(outcome.reason);
      return null;
    }

    const sfxId = outcome.sfxEventId ?? outcome.result.sfxId;
    if (sfxId) this.eventBus.emitSfx(sfxId);
    if (outcome.result.xpDelta) this.eventBus.emitSfx('xp_gain');

    return {
      transitionRequest: outcome.result.transitionRequest,
      uiResult: outcome.result,
    };
  }

  start(action: ActionProgressDefinition): void {
    const cancelled = this.actionProgressSystem.start(action);

    if (cancelled?.kind === 'cancelled') {
      this.eventBus.emitSfx(cancelled.sfxEventId ?? 'action_cancelled');
      this.pushInfoResult(cancelled.reason);
    }

    if (action.startSfxId) {
      this.eventBus.emitSfx(action.startSfxId);
    }
  }

  cancel(reason = 'Action cancelled.'): string | null {
    const outcome = this.actionProgressSystem.cancel(reason);

    if (!outcome) {
      return null;
    }

    this.eventBus.emitSfx(outcome.sfxEventId ?? 'action_cancelled');
    return reason;
  }

  emitResultSfx(result: InteractionResult): void {
    if (result.sfxId) this.eventBus.emitSfx(result.sfxId);
    if (result.xpDelta) this.eventBus.emitSfx('xp_gain');
  }

  private pushInfoResult(message: string): void {
    this.onInfoResult({
      ok: false,
      interactionType: 'generic_debug',
      targetId: 'action_progress',
      message,
      toastKind: 'info',
    });
  }
}
