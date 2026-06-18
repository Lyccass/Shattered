import type { ContractBoardSystem } from '../contracts/ContractBoardSystem';
import type {
  ChoiceMenuHandler,
  ChoiceMenuHandlerOutcome,
} from '../interactions/ChoiceMenuCoordinator';
import type { ChoiceMenuOption } from '../interactions/ChoiceMenuTypes';
import type { PlayerSessionState } from '../player/PlayerSessionState';
import type { QuestSystem } from '../quests/QuestSystem';
import type {
  NpcDefinition,
  NpcDialogueCondition,
  NpcDialogueOptionOutcome,
  NpcDialogueTreeOption,
} from './NpcTypes';

export class NpcDialogueMenuHandler implements ChoiceMenuHandler {
  readonly title: string;
  private currentNodeId: string | null;

  constructor(
    private readonly definition: NpcDefinition,
    private readonly anchorId: string,
    private readonly contractBoardSystem: ContractBoardSystem,
    private readonly questSystem?: QuestSystem,
  ) {
    this.title = definition.displayName;
    this.currentNodeId = definition.dialogueTree?.startNodeId ?? null;
  }

  getCurrentNpcText(): string | null {
    return this.getCurrentTreeNode()?.npcText ?? null;
  }

  getOptions(playerState: PlayerSessionState): ChoiceMenuOption[] {
    const node = this.getCurrentTreeNode();

    if (node) {
      return node.options
        .filter((option) => {
          const available = this.areConditionsMet(option.conditions ?? [], playerState);
          return available || option.unavailableMode !== 'hidden';
        })
        .map((option) => {
          const available = this.areConditionsMet(option.conditions ?? [], playerState);
          return {
            id: option.id,
            label: option.label,
            disabledReason: available
              ? undefined
              : option.unavailableReason ?? 'Unavailable',
          };
        });
    }

    return (this.definition.options ?? []).map((opt) => ({
      id: opt.id,
      label: opt.outcome.kind === 'quest' && this.questSystem
        ? this.questSystem.getQuestMenuLabel(opt.outcome.questId, playerState)
        : opt.label,
      disabledReason: opt.outcome.kind === 'quest'
        ? this.questSystem?.getQuestMenuDisabledReason(opt.outcome.questId, playerState)
        : undefined,
    }));
  }

  onConfirm(optionId: string, playerState: PlayerSessionState): ChoiceMenuHandlerOutcome {
    const node = this.getCurrentTreeNode();

    if (node) {
      const option = node.options.find((candidate) => candidate.id === optionId);
      if (!option) return { kind: 'none' };
      if (!this.areConditionsMet(option.conditions ?? [], playerState)) return { kind: 'none' };

      return this.resolveTreeOption(option, playerState);
    }

    const opt = this.definition.options?.find((o) => o.id === optionId);
    if (!opt) return { kind: 'none' };

    return this.resolveOutcome(opt.outcome, playerState, opt.outcome.kind === 'quest');
  }

  private resolveOutcome(
    outcome: NpcDialogueOptionOutcome,
    playerState: PlayerSessionState,
    closeQuestMenu: boolean,
  ): ChoiceMenuHandlerOutcome {
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

      case 'quest':
        if (!this.questSystem) {
          return {
            kind: 'result',
            result: {
              ok: false,
              interactionType: 'npc',
              targetId: this.anchorId,
              message: 'No quest is available here.',
              toastKind: 'error',
            },
            closeMenu: true,
          };
        }

        return {
          kind: 'result',
          result: this.questSystem.handleQuestNpcInteraction(
            outcome.questId,
            this.definition.id,
            playerState,
          ),
          closeMenu: closeQuestMenu,
        };
    }
  }

  private resolveTreeOption(
    option: NpcDialogueTreeOption,
    playerState: PlayerSessionState,
  ): ChoiceMenuHandlerOutcome {
    if (option.questAction) {
      if (!this.questSystem) {
        return {
          kind: 'result',
          result: {
            ok: false,
            interactionType: 'npc',
            targetId: this.anchorId,
            message: 'No quest is available here.',
            toastKind: 'error',
          },
          closeMenu: true,
        };
      }

      return {
        kind: 'result',
        result: this.questSystem.handleQuestNpcInteraction(
          option.questAction.questId,
          this.definition.id,
          playerState,
        ),
        closeMenu: option.end === true,
      };
    }

    if (option.outcome) {
      return this.resolveOutcome(option.outcome, playerState, option.end === true);
    }

    if (option.nextNodeId) {
      this.currentNodeId = option.nextNodeId;
      return {
        kind: 'result',
        result: {
          ok: true,
          interactionType: 'npc',
          targetId: this.anchorId,
          message: this.getCurrentTreeNode()?.npcText ?? '',
        },
      };
    }

    if (option.end) {
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
    }

    return { kind: 'none' };
  }

  private getCurrentTreeNode() {
    if (!this.definition.dialogueTree || !this.currentNodeId) {
      return null;
    }

    return this.definition.dialogueTree.nodes[this.currentNodeId] ?? null;
  }

  private areConditionsMet(
    conditions: NpcDialogueCondition[],
    playerState: PlayerSessionState,
  ): boolean {
    return conditions.every((condition) => {
      switch (condition.kind) {
        case 'quest_state':
          if (condition.state === 'not_started') {
            return !playerState.isQuestActive(condition.questId)
              && !playerState.isQuestCompleted(condition.questId);
          }
          if (condition.state === 'active') return playerState.isQuestActive(condition.questId);
          return playerState.isQuestCompleted(condition.questId);
        case 'quest_phase':
          return this.questSystem?.getActivePhaseId(condition.questId, playerState) === condition.phaseId;
        case 'skill_level':
          return playerState.getSkillLevel(condition.skillId) >= condition.level;
        case 'item_owned':
          return playerState.getInventoryState().hasAtLeast(condition.itemId, condition.count ?? 1);
        case 'reputation':
          return (playerState.getReputationSnapshot()[condition.faction] ?? 0) >= condition.minimum;
      }
    });
  }
}
