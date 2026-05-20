import type { PlayerSessionState } from '../player/PlayerSessionState';
import type {
  PlayerItemDelta,
  PlayerItemKey,
  PlayerInventoryDelta,
} from '../player/PlayerInventoryState';
import type { ChoiceMenuOption } from '../interactions/ChoiceMenuTypes';
import type { ChoiceMenuHandler } from '../interactions/ChoiceMenuCoordinator';
import type { TaskJournalEntry } from '../tasks/TaskJournalTypes';
import type { MapContractBoardAnchor } from '../world/maps/MapTypes';
import type {
  ContractBoardInteractionTarget,
  InteractionResult,
} from '../interactions/InteractionTypes';
import { createSingleTileInteractionTiles } from '../interactions/InteractionTypes';
import type { ContractRegistry } from './ContractRegistry';
import type { ContractDefinition } from './ContractTypes';

type ContractBoardState = {
  mapId: string;
  anchor: MapContractBoardAnchor;
};

export class ContractBoardSystem {
  private currentBoards = new Map<string, ContractBoardState>();

  constructor(private readonly contractRegistry: ContractRegistry) {}

  setMapBoards(mapId: string, anchors: MapContractBoardAnchor[]): void {
    this.currentBoards = new Map(
      anchors.map((anchor) => [
        anchor.id,
        {
          mapId,
          anchor,
        },
      ]),
    );
  }

  createInteractionTargets(): ContractBoardInteractionTarget[] {
    return Array.from(this.currentBoards.values()).map((state) => ({
      definition: {
        id: state.anchor.id,
        interactionType: 'contract_board',
        promptText: `Press E: ${state.anchor.promptLabel ?? 'Check Contracts'}`,
        interactionRangeTiles: state.anchor.interactionRangeTiles ?? 1,
        priority: 85,
      },
      tiles: createSingleTileInteractionTiles(state.anchor.tileX, state.anchor.tileY),
      anchor: state.anchor,
    }));
  }

  getAvailableContracts(boardId: string, playerSessionState: PlayerSessionState): ContractDefinition[] {
    const state = this.currentBoards.get(boardId);

    if (!state) {
      return [];
    }

    return this.getContractsForBoard(state.anchor).filter((contract) => this.isContractAvailable(
      contract,
      playerSessionState,
    ));
  }

  // Returns a handler for ChoiceMenuCoordinator so the coordinator does not
  // need if-branches for each system type.
  createMenuHandler(boardId: string): ChoiceMenuHandler {
    return {
      title: 'Harbor Contracts',
      getOptions: (playerState) => this.getMenuOptions(boardId, playerState),
      onConfirm: (optionId, playerState) => {
        const result = this.selectContract(boardId, optionId, playerState);
        return { kind: 'result', result, closeMenu: true };
      },
    };
  }

  getMenuOptions(boardId: string, playerSessionState: PlayerSessionState): ChoiceMenuOption[] {
    return this.getContractsForBoard(this.requireBoardState(boardId).anchor).map((contract) => ({
      id: contract.id,
      label: this.getContractLabel(contract, playerSessionState),
      details: [
        `Need: ${this.getRequirementSummary(contract)}`,
        `Reward: ${this.getRewardSummary(contract)}`,
      ].join('\n'),
      disabledReason: this.isContractAvailable(contract, playerSessionState)
        ? undefined
        : 'Completed',
    }));
  }

  getJournalEntries(playerSessionState: PlayerSessionState): TaskJournalEntry[] {
    return playerSessionState
      .getAcceptedContractIds()
      .map((contractId) => this.contractRegistry.get(contractId))
      .map((contract) => ({
        id: contract.id,
        displayName: contract.displayName,
        requirementSummary: this.getRequirementSummary(contract),
        rewardSummary: this.getRewardSummary(contract),
        requirementsMet: this.canCompleteContract(contract, playerSessionState),
      }));
  }

  useBoard(boardId: string, playerSessionState: PlayerSessionState): InteractionResult {
    if (!this.currentBoards.has(boardId)) {
      return {
        ok: false,
        interactionType: 'contract_board',
        targetId: boardId,
        message: 'No contracts are posted here.',
      };
    }

    const availableContracts = this.getAvailableContracts(boardId, playerSessionState);
    const acceptedCompletableContract = availableContracts.find((contract) =>
      playerSessionState.isContractAccepted(contract.id)
      && this.canCompleteContract(contract, playerSessionState),
    );

    if (acceptedCompletableContract) {
      return this.selectContract(boardId, acceptedCompletableContract.id, playerSessionState);
    }

    const nextUnacceptedContract = availableContracts.find(
      (contract) => !playerSessionState.isContractAccepted(contract.id),
    );

    if (nextUnacceptedContract) {
      return this.selectContract(boardId, nextUnacceptedContract.id, playerSessionState);
    }

    const nextAcceptedContract = availableContracts.find((contract) =>
      playerSessionState.isContractAccepted(contract.id),
    );

    if (nextAcceptedContract) {
      return this.selectContract(boardId, nextAcceptedContract.id, playerSessionState);
    }

    const nextContract = availableContracts[0];

    if (!nextContract) {
      return {
        ok: false,
        interactionType: 'contract_board',
        targetId: boardId,
        message: 'No contracts are available right now.',
      };
    }

    return {
      ok: false,
      interactionType: 'contract_board',
      targetId: boardId,
      message: this.getMissingRequirementsMessage(nextContract),
    };
  }

  selectContract(
    boardId: string,
    contractId: string,
    playerSessionState: PlayerSessionState,
  ): InteractionResult {
    const boardState = this.requireBoardState(boardId);
    const contract = this.getContractsForBoard(boardState.anchor).find(
      (candidate) => candidate.id === contractId,
    );

    if (!contract) {
      return {
        ok: false,
        interactionType: 'contract_board',
        targetId: boardId,
        message: 'That contract is not posted here.',
      };
    }

    if (!this.isContractAvailable(contract, playerSessionState)) {
      return {
        ok: false,
        interactionType: 'contract_board',
        targetId: contract.id,
        message: `${contract.displayName} has already been completed.`,
      };
    }

    const wasAccepted = playerSessionState.isContractAccepted(contract.id);

    if (!wasAccepted) {
      playerSessionState.acceptContract(contract.id);
      return {
        ok: true,
        sfxId: 'contract_accepted',
        interactionType: 'contract_board',
        targetId: contract.id,
        message: `Accepted ${contract.displayName}. Bring ${this.getRequirementSummary(contract)}.`,
      };
    }

    if (this.canCompleteContract(contract, playerSessionState)) {
      return this.completeContract(contract, playerSessionState);
    }

    return {
      ok: true,
      interactionType: 'contract_board',
      targetId: contract.id,
      message: `Still need ${this.getRequirementSummary(contract)}.`,
    };
  }

  private getContractsForBoard(anchor: MapContractBoardAnchor): ContractDefinition[] {
    const contractIds = anchor.contractIds ?? [];

    return contractIds.map((contractId) => this.contractRegistry.get(contractId));
  }

  private canCompleteContract(
    contract: ContractDefinition,
    playerSessionState: PlayerSessionState,
  ): boolean {
    const inventory = playerSessionState.getInventoryState();

    const hasItems = Object.entries(contract.requiredItems ?? {}).every(
      ([itemId, amount]) => inventory.hasItemAtLeast(itemId as PlayerItemKey, amount ?? 0),
    );
    const hasResources = inventory.hasDelta(contract.requiredResources ?? {});

    return hasItems && hasResources;
  }

  private completeContract(
    contract: ContractDefinition,
    playerSessionState: PlayerSessionState,
  ): InteractionResult {
    const inventory = playerSessionState.getInventoryState();

    Object.entries(contract.requiredItems ?? {}).forEach(([itemId, amount]) => {
      if ((amount ?? 0) > 0) {
        inventory.consumeItem(itemId as PlayerItemKey, amount);
      }
    });

    inventory.consumeDelta(contract.requiredResources ?? {});

    if (contract.rewards.resourceDelta) {
      inventory.addDelta(contract.rewards.resourceDelta);
    }

    if (contract.rewards.itemDelta) {
      inventory.addItemDelta(contract.rewards.itemDelta);
    }

    if (contract.rewards.copper) {
      playerSessionState.getCurrencyState().addCopper(contract.rewards.copper);
    }

    if (contract.rewards.harborReputation) {
      playerSessionState.getReputationState().addHarborReputation(
        contract.rewards.harborReputation,
      );
    }

    playerSessionState.getSkillProgressionSystem().addXpDelta(contract.rewards.xpRewards ?? {});
    playerSessionState.completeContract(contract.id, contract.repeatable);

    return {
      ok: true,
      sfxId: 'contract_completed',
      interactionType: 'contract_board',
      targetId: contract.id,
      message: this.getCompletionMessage(contract),
      inventoryDelta: contract.requiredResources
        ? invertResourceDelta(contract.requiredResources)
        : undefined,
      itemDelta: contract.requiredItems
        ? invertItemRequirements(contract.requiredItems)
        : undefined,
      currencyDelta: contract.rewards.copper ? { copper: contract.rewards.copper } : undefined,
      reputationDelta: contract.rewards.harborReputation
        ? { harborReputation: contract.rewards.harborReputation }
        : undefined,
      xpDelta: contract.rewards.xpRewards,
    };
  }

  private requireBoardState(boardId: string): ContractBoardState {
    const state = this.currentBoards.get(boardId);

    if (!state) {
      throw new Error(`ContractBoardSystem: unknown board "${boardId}"`);
    }

    return state;
  }

  private isContractAvailable(
    contract: ContractDefinition,
    playerSessionState: PlayerSessionState,
  ): boolean {
    return contract.repeatable || !playerSessionState.isContractCompletedNonRepeatable(contract.id);
  }

  private getMissingRequirementsMessage(contract: ContractDefinition): string {
    return `Contract needs ${this.getRequirementSummary(contract)}.`;
  }

  private getCompletionMessage(contract: ContractDefinition): string {
    return `Completed ${contract.displayName}. Received ${this.getRewardSummary(contract)}.`;
  }

  private getRequirementSummary(contract: ContractDefinition): string {
    const itemParts = Object.entries(contract.requiredItems ?? {}).map(
      ([itemId, amount]) => `${amount} ${itemId.replaceAll('_', ' ')}`,
    );
    const resourceParts = Object.entries(contract.requiredResources ?? {}).map(
      ([resourceId, amount]) => `${amount} ${resourceId}`,
    );

    return [...itemParts, ...resourceParts].join(' + ') || 'nothing';
  }

  private getRewardSummary(contract: ContractDefinition): string {
    const rewardParts: string[] = [];

    if (contract.rewards.copper) {
      rewardParts.push(`${contract.rewards.copper} copper`);
    }

    if (contract.rewards.harborReputation) {
      rewardParts.push(`${contract.rewards.harborReputation} harbor reputation`);
    }

    if (contract.rewards.xpRewards) {
      Object.entries(contract.rewards.xpRewards).forEach(([skillId, amount]) => {
        rewardParts.push(`${amount} ${skillId} XP`);
      });
    }

    if (contract.rewards.itemDelta) {
      Object.entries(contract.rewards.itemDelta).forEach(([itemId, amount]) => {
        rewardParts.push(`${amount} ${itemId.replaceAll('_', ' ')}`);
      });
    }

    if (contract.rewards.resourceDelta) {
      Object.entries(contract.rewards.resourceDelta).forEach(([resourceId, amount]) => {
        rewardParts.push(`${amount} ${resourceId}`);
      });
    }

    return rewardParts.join(' + ') || 'payment';
  }

  private getContractLabel(
    contract: ContractDefinition,
    playerSessionState: PlayerSessionState,
  ): string {
    if (!this.isContractAvailable(contract, playerSessionState)) {
      return `${contract.displayName} (Completed)`;
    }

    if (playerSessionState.isContractAccepted(contract.id)) {
      return this.canCompleteContract(contract, playerSessionState)
        ? `${contract.displayName} (Ready)`
        : `${contract.displayName} (Accepted)`;
    }

    return contract.displayName;
  }
}

function invertResourceDelta(delta: PlayerInventoryDelta): PlayerInventoryDelta {
  return Object.fromEntries(
    Object.entries(delta).map(([key, value]) => [key, -(value ?? 0)]),
  ) as PlayerInventoryDelta;
}

function invertItemRequirements(requirements: Partial<Record<PlayerItemKey, number>>): PlayerItemDelta {
  return Object.fromEntries(
    Object.entries(requirements).map(([key, value]) => [key, -(value ?? 0)]),
  ) as PlayerItemDelta;
}
