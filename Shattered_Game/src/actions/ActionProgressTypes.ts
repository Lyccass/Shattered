import type { InteractionResult, InteractionType } from '../interactions/InteractionTypes';
import type { SfxEventId } from '../audio/SfxTypes';

export type ActionProgressSnapshot = {
  actionId: string;
  label: string;
  durationMs: number;
  elapsedMs: number;
  progress01: number;
  interactionType: InteractionType;
  targetId: string;
};

export type ActionProgressDefinition = {
  actionId: string;
  label: string;
  durationMs: number;
  interactionType: InteractionType;
  targetId: string;
  canContinue?: () => boolean;
  onComplete: () => InteractionResult;
  cancellationReason?: string;
  startSfxId?: SfxEventId;
  successSfxId?: SfxEventId;
  failureSfxId?: SfxEventId;
  cancelSfxId?: SfxEventId;
};

export type ActionProgressOutcome =
  | {
      kind: 'completed';
      result: InteractionResult;
      sfxEventId?: SfxEventId;
    }
  | {
      kind: 'cancelled';
      reason: string;
      sfxEventId?: SfxEventId;
    };
