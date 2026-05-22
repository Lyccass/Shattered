import type { ActionProgressSystem } from '../actions/ActionProgressSystem';
import type { ContractBoardSystem } from '../contracts/ContractBoardSystem';
import type { ChoiceMenuCoordinator } from '../interactions/ChoiceMenuCoordinator';
import type { InteractionSystem } from '../interactions/InteractionSystem';
import type { PlacementModeSystem } from '../interactions/PlacementModeSystem';
import type { PlayerSessionState } from '../player/PlayerSessionState';
import type { UiStateSnapshot } from './UiTypes';

// Collects UI state from all relevant subsystems into a single snapshot.
// Owned by WorldRuntimeCoordinator, which passes it to GameScene/UiManager.
export class UiStateAggregator {
  constructor(
    private readonly playerSessionState: PlayerSessionState,
    private readonly interactionSystem: InteractionSystem,
    private readonly actionProgressSystem: ActionProgressSystem,
    private readonly choiceMenuCoordinator: ChoiceMenuCoordinator,
    private readonly placementModeSystem: PlacementModeSystem,
    private readonly contractBoardSystem: ContractBoardSystem,
    private readonly getNowMs: () => number,
  ) {}

  getSnapshot(): UiStateSnapshot {
    return {
      activeInteraction: this.interactionSystem.getActiveInteraction(),
      choiceMenu: this.choiceMenuCoordinator.getSnapshot(),
      inventory: this.playerSessionState.getInventorySnapshot(),
      currency: this.playerSessionState.getCurrencySnapshot(),
      reputation: this.playerSessionState.getReputationSnapshot(),
      skills: this.playerSessionState.getSkillSnapshots(),
      activeTaskCount: this.playerSessionState.getAcceptedContractIds().length,
      journalEntries: this.contractBoardSystem.getJournalEntries(this.playerSessionState),
      activeEffects: this.playerSessionState.getActiveEffects(this.getNowMs()),
      placementState: this.placementModeSystem.getState(),
      actionProgress: this.actionProgressSystem.getSnapshot(),
      equipment: this.playerSessionState.getEquipmentSnapshot(),
    };
  }
}
