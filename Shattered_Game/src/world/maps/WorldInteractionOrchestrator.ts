import type { ChoiceMenuCoordinator } from '../../interactions/ChoiceMenuCoordinator';
import type { InteractionActionFactory } from '../../interactions/InteractionActionFactory';
import type { InteractionSystem } from '../../interactions/InteractionSystem';
import type {
  ContractBoardInteractionTarget,
  InteractionResult,
  InteractionTarget,
  PlacedObjectInteractionTarget,
  ResourceNodeInteractionTarget,
  WorkbenchInteractionTarget,
} from '../../interactions/InteractionTypes';
import type { PlayerSessionState } from '../../player/PlayerSessionState';
import type { ContractBoardSystem } from '../../contracts/ContractBoardSystem';
import type { WorkbenchSystem } from '../../interactions/WorkbenchSystem';
import {
  getInteractionMenuTitle,
  getInteractionUseDetails,
  getInteractionUseLabel,
} from './InteractionMenuCopy';
import type { WorldActionBroker } from './WorldActionBroker';
import type { WorldInteractionHandlers } from './WorldInteractionHandlers';

type InteractionTargetType = InteractionTarget['definition']['interactionType'];

export type DeferredInteractionAction = {
  kind: 'deferred_interaction_action';
  interactionType: InteractionTargetType;
  targetId: string;
  action: 'use' | 'inspect';
};

type WorldInteractionOrchestratorDeps = {
  actionBroker: WorldActionBroker;
  actionFactory: InteractionActionFactory;
  choiceMenuCoordinator: ChoiceMenuCoordinator;
  contractBoardSystem: ContractBoardSystem;
  interactionHandlers: WorldInteractionHandlers;
  interactionSystem: InteractionSystem;
  isTargetStillInRange: (
    interactionType: InteractionTargetType,
    targetId: string,
    rangeTiles: number,
  ) => boolean;
  loadMap: (mapId: string, spawnId: string) => void;
  playerSessionState: PlayerSessionState;
  rebuildInteractionTargets: () => void;
  setActiveInteractionTiles: (tiles: Array<{ x: number; y: number }> | null) => void;
  workbenchSystem: WorkbenchSystem;
};

export class WorldInteractionOrchestrator {
  constructor(private readonly deps: WorldInteractionOrchestratorDeps) {}

  confirmChoiceMenu(): InteractionResult | DeferredInteractionAction | null {
    const confirmResult = this.deps.choiceMenuCoordinator.confirm(this.deps.playerSessionState);

    switch (confirmResult.kind) {
      case 'none':
        return null;

      case 'disabled':
        return {
          ok: false,
          sfxId: 'invalid_action',
          interactionType: 'generic_debug',
          targetId: 'choice_menu',
          message: confirmResult.reason,
        };

      case 'craft':
        this.deps.actionBroker.start(
          this.deps.actionFactory.createWorkbenchCraftAction(
            confirmResult.workbenchId,
            confirmResult.recipeId,
          ),
        );
        return null;

      case 'use_target':
        if (this.isTargetInRange(confirmResult.target)) {
          return this.executeTargetUse(confirmResult.target);
        }

        return {
          kind: 'deferred_interaction_action',
          interactionType: confirmResult.target.definition.interactionType,
          targetId: confirmResult.target.definition.id,
          action: 'use',
        };

      case 'inspect_target':
        if (this.isTargetInRange(confirmResult.target)) {
          return this.inspectTarget(confirmResult.target);
        }

        return {
          kind: 'deferred_interaction_action',
          interactionType: confirmResult.target.definition.interactionType,
          targetId: confirmResult.target.definition.id,
          action: 'inspect',
        };

      case 'result': {
        const result = confirmResult.result;
        this.deps.actionBroker.emitResultSfx(result);
        this.deps.rebuildInteractionTargets();
        return result;
      }
    }
  }

  executeTargetUse(target: InteractionTarget): InteractionResult | null {
    if (this.tryOpenSystemMenu(target)) {
      return null;
    }

    if (target.definition.interactionType === 'resource_node') {
      this.markActiveTiles(target);
      this.deps.actionBroker.start(
        this.deps.actionFactory.createGatherAction(target as ResourceNodeInteractionTarget),
      );
      return null;
    }

    if (target.definition.interactionType === 'workbench') {
      const workbenchTarget = target as WorkbenchInteractionTarget;
      const recipes = this.deps.workbenchSystem.getRecipesForWorkbench(workbenchTarget.anchor.id);

      if (recipes.length === 1) {
        this.markActiveTiles(target);
        this.deps.actionBroker.start(
          this.deps.actionFactory.createWorkbenchCraftAction(
            workbenchTarget.anchor.id,
            recipes[0].id,
          ),
        );
        return null;
      }
    }

    if (target.definition.interactionType === 'placed_object') {
      const action = this.deps.actionFactory.createPlacedObjectAction(
        target as PlacedObjectInteractionTarget,
        this.deps.playerSessionState.getInventoryState(),
      );

      if (action) {
        this.markActiveTiles(target);
        this.deps.actionBroker.start(action);
        return null;
      }
    }

    const result = this.deps.interactionSystem.triggerTarget(target);
    this.deps.actionBroker.emitResultSfx(result);

    if (result.transitionRequest) {
      this.deps.loadMap(result.transitionRequest.targetMapId, result.transitionRequest.targetSpawnId);
    } else {
      this.deps.rebuildInteractionTargets();
    }

    return result;
  }

  inspectTarget(target: InteractionTarget): InteractionResult {
    const result = this.deps.interactionHandlers.inspectTarget(target);
    this.deps.actionBroker.emitResultSfx(result);
    return result;
  }

  openInteractionChoiceMenuForTarget(target: InteractionTarget): boolean {
    return this.deps.choiceMenuCoordinator.tryOpen(
      {
        title: getInteractionMenuTitle(target),
        getOptions: () => [
          {
            id: 'use',
            label: getInteractionUseLabel(target),
            details: getInteractionUseDetails(target),
          },
          {
            id: 'inspect',
            label: 'Inspect',
            details: 'Take a closer look.',
          },
        ],
        onConfirm: (optionId) => {
          if (optionId === 'use') {
            return { kind: 'use_target', target };
          }

          if (optionId === 'inspect') {
            return { kind: 'inspect_target', target };
          }

          return { kind: 'none' };
        },
      },
      this.deps.playerSessionState,
    );
  }

  private isTargetInRange(target: InteractionTarget): boolean {
    return this.deps.isTargetStillInRange(
      target.definition.interactionType,
      target.definition.id,
      target.definition.interactionRangeTiles,
    );
  }

  private markActiveTiles(target: InteractionTarget): void {
    this.deps.setActiveInteractionTiles(target.tiles.map((tile) => ({ x: tile.x, y: tile.y })));
  }

  private tryOpenSystemMenu(target: InteractionTarget): boolean {
    if (target.definition.interactionType === 'workbench') {
      const workbenchTarget = target as WorkbenchInteractionTarget;
      const handler = this.deps.workbenchSystem.createMenuHandler(workbenchTarget.anchor.id);
      return this.deps.choiceMenuCoordinator.tryOpen(handler, this.deps.playerSessionState);
    }

    if (target.definition.interactionType === 'contract_board') {
      const contractBoardTarget = target as ContractBoardInteractionTarget;
      const handler = this.deps.contractBoardSystem.createMenuHandler(contractBoardTarget.anchor.id);
      return this.deps.choiceMenuCoordinator.tryOpen(handler, this.deps.playerSessionState);
    }

    return false;
  }
}
