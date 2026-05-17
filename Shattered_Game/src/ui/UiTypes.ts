import type { ActionProgressSnapshot } from '../actions/ActionProgressTypes';
import type { ActiveEffectSnapshot } from '../effects/EffectTypes';
import type { ChoiceMenuStateSnapshot } from '../interactions/ChoiceMenuTypes';
import type { ActiveInteraction, InteractionResult } from '../interactions/InteractionTypes';
import type { PlacementPreviewState } from '../interactions/PlacementModeSystem';
import type { CurrencySnapshot } from '../player/PlayerCurrencyState';
import type { PlayerInventorySnapshot } from '../player/PlayerInventoryState';
import type { ReputationSnapshot } from '../player/PlayerReputationState';
import type { SkillId, SkillSnapshot } from '../skills/SkillTypes';
import type { TaskJournalEntry } from '../tasks/TaskJournalTypes';
import type { ToastKind } from './ToastTypes';

export type UiStateSnapshot = {
  activeInteraction: ActiveInteraction | null;
  choiceMenu: ChoiceMenuStateSnapshot | null;
  inventory: PlayerInventorySnapshot;
  currency: CurrencySnapshot;
  reputation: ReputationSnapshot;
  skills: SkillSnapshot[];
  activeTaskCount: number;
  journalEntries: TaskJournalEntry[];
  activeEffects: ActiveEffectSnapshot[];
  placementState: PlacementPreviewState | null;
  actionProgress: ActionProgressSnapshot | null;
};

export type UiHandledResult = Pick<InteractionResult, 'ok' | 'message' | 'xpDelta' | 'toastKind'>;

export type SkillToastEntry = {
  skillId: SkillId;
  amount: number;
};
