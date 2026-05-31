import type { ContractBoardSystem } from '../contracts/ContractBoardSystem';
import type {
  ChoiceMenuHandler,
  ChoiceMenuHandlerOutcome,
} from '../interactions/ChoiceMenuCoordinator';
import type { ChoiceMenuOption } from '../interactions/ChoiceMenuTypes';
import type { PlayerSessionState } from '../player/PlayerSessionState';
import type { NpcDefinition } from './NpcTypes';

export class NpcDialogueMenuHandler implements ChoiceMenuHandler {
  readonly title: string;

  constructor(
    private readonly definition: NpcDefinition,
    private readonly anchorId: string,
    private readonly contractBoardSystem: ContractBoardSystem,
  ) {
    this.title = definition.displayName;
  }

  getOptions(_playerState: PlayerSessionState): ChoiceMenuOption[] {
    return (this.definition.options ?? []).map((opt) => ({
      id: opt.id,
      label: opt.label,
    }));
  }

  onConfirm(optionId: string, _playerState: PlayerSessionState): ChoiceMenuHandlerOutcome {
    const opt = this.definition.options?.find((o) => o.id === optionId);
    if (!opt) return { kind: 'none' };

    const { outcome } = opt;

    switch (outcome.kind) {
      case 'close':
        return {
          kind: 'result',
          result: {
            ok: true,
            interactionType: 'npc',
            targetId: this.anchorId,
            message: 'Farewell.',
          },
          closeMenu: true,
        };

      case 'shop':
        return {
          kind: 'result',
          result: {
            ok: true,
            interactionType: 'npc',
            targetId: this.anchorId,
            message: 'Browse freely.',
            openShopId: outcome.shopId,
          },
          closeMenu: true,
        };

      case 'reply':
        return {
          kind: 'result',
          result: {
            ok: true,
            interactionType: 'npc',
            targetId: this.anchorId,
            message: outcome.npcText,
          },
        };

      case 'contract_board': {
        const handler = this.contractBoardSystem.createMenuHandler(outcome.boardId);
        return { kind: 'open_menu', handler };
      }
    }
  }
}
