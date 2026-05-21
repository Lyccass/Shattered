import type Phaser from 'phaser';
import type { ContractBoardSystem } from '../../contracts/ContractBoardSystem';
import type {
  ContractBoardInteractionTarget,
  GenericDebugInteractionTarget,
  GroundItemInteractionTarget,
  InteractionHandlers,
  InteractionResult,
  InteractionTarget,
  MapTransitionInteractionTarget,
  NpcInteractionTarget,
  PlacedObjectInteractionTarget,
  ResourceNodeInteractionTarget,
  WorkbenchInteractionTarget,
} from '../../interactions/InteractionTypes';
import type { PlacedStructureSystem } from '../../interactions/PlacedStructureSystem';
import type { ResourceNodeSystem } from '../../interactions/ResourceNodeSystem';
import type { WorkbenchSystem } from '../../interactions/WorkbenchSystem';
import type { ObjectPlacementSystem } from '../../objects/ObjectPlacementSystem';
import type { PlayerSessionState } from '../../player/PlayerSessionState';
import { getMapDisplayName } from './MapDefinitions';

export class WorldInteractionHandlers {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly playerSessionState: PlayerSessionState,
    private readonly resourceNodeSystem: ResourceNodeSystem,
    private readonly workbenchSystem: WorkbenchSystem,
    private readonly contractBoardSystem: ContractBoardSystem,
    private readonly placedStructureSystem: PlacedStructureSystem,
    private readonly getPlacementSystem: () => ObjectPlacementSystem | undefined,
  ) {}

  build(): InteractionHandlers {
    return {
      onMapTransition: (target) => this.handleMapTransition(target),
      onResourceNode: (target) => this.handleResourceNode(target),
      onNpc: (target) => this.handleNpc(target),
      onWorkbench: (target) => this.handleWorkbench(target),
      onContractBoard: (target) => this.handleContractBoard(target),
      onPlacedObject: (target) => this.handlePlacedObject(target),
      onGenericDebug: (target) => this.handleGenericDebug(target),
      // Stub — overridden in WorldRuntimeCoordinator with the real collector
      onGroundItem: (target: GroundItemInteractionTarget) => ({
        ok: false,
        interactionType: 'ground_item' as const,
        targetId: target.dropId,
        message: 'Cannot pick up item.',
      }),
    };
  }

  inspectTarget(target: InteractionTarget): InteractionResult {
    switch (target.definition.interactionType) {
      case 'map_transition':
        return {
          ok: true,
          interactionType: 'map_transition',
          targetId: target.definition.id,
          message: `A route leading to ${getMapDisplayName((target as MapTransitionInteractionTarget).transition.targetMapId)}.`,
          toastKind: 'info',
        };
      case 'resource_node':
        return {
          ok: true,
          interactionType: 'resource_node',
          targetId: target.definition.id,
          message: describeResourceNode((target as ResourceNodeInteractionTarget).anchor.resourceNodeType),
          toastKind: 'info',
        };
      case 'npc':
        return {
          ok: true,
          interactionType: 'npc',
          targetId: target.definition.id,
          message: (target as NpcInteractionTarget).anchor.promptLabel
            ? `${(target as NpcInteractionTarget).anchor.promptLabel}.`
            : 'Someone worth talking to.',
          toastKind: 'info',
        };
      case 'workbench':
        return {
          ok: true,
          interactionType: 'workbench',
          targetId: target.definition.id,
          message: 'A rough workbench for simple field crafting.',
          toastKind: 'info',
        };
      case 'contract_board':
        return {
          ok: true,
          interactionType: 'contract_board',
          targetId: target.definition.id,
          message: 'A contract board covered in requests, notices, and harbour jobs.',
          toastKind: 'info',
        };
      case 'placed_object':
        return {
          ok: true,
          interactionType: 'placed_object',
          targetId: target.definition.id,
          message: (target as PlacedObjectInteractionTarget).placedObjectKind === 'campfire'
            ? 'A campfire. Good for warmth and brewing.'
            : 'A prepared firestarter waiting for a spark.',
          toastKind: 'info',
        };
      case 'generic_debug':
        return {
          ok: true,
          interactionType: 'generic_debug',
          targetId: target.definition.id,
          message: (target as GenericDebugInteractionTarget).anchor.message,
          toastKind: 'info',
        };
      case 'ground_item':
        return {
          ok: true,
          interactionType: 'ground_item',
          targetId: target.definition.id,
          message: (target as GroundItemInteractionTarget).definition.promptText,
          toastKind: 'info',
        };
    }
  }

  private handleMapTransition(target: MapTransitionInteractionTarget): InteractionResult {
    return {
      ok: true,
      sfxId: 'map_transition',
      interactionType: 'map_transition',
      targetId: target.definition.id,
      message: `Travelling to ${getMapDisplayName(target.transition.targetMapId)}.`,
      transitionRequest: {
        targetMapId: target.transition.targetMapId,
        targetSpawnId: target.transition.targetSpawnId,
      },
    };
  }

  private handleResourceNode(target: ResourceNodeInteractionTarget): InteractionResult {
    return this.resourceNodeSystem.gatherNode(
      target.anchor.id,
      this.playerSessionState,
      this.scene.time.now,
      this.getPlacementSystem(),
    );
  }

  private handleNpc(target: NpcInteractionTarget): InteractionResult {
    return {
      ok: true,
      interactionType: 'npc',
      targetId: target.definition.id,
      message: target.anchor.text,
    };
  }

  private handleWorkbench(target: WorkbenchInteractionTarget): InteractionResult {
    return this.workbenchSystem.useWorkbench(target.anchor.id, this.playerSessionState);
  }

  private handleContractBoard(target: ContractBoardInteractionTarget): InteractionResult {
    return this.contractBoardSystem.useBoard(target.anchor.id, this.playerSessionState);
  }

  private handlePlacedObject(target: PlacedObjectInteractionTarget): InteractionResult {
    const placementSystem = this.getPlacementSystem();

    if (!placementSystem) {
      return {
        ok: false,
        sfxId: 'invalid_action',
        interactionType: 'placed_object',
        targetId: target.placedObjectId,
        message: 'Nothing happens.',
      };
    }

    return this.placedStructureSystem.interactWithPlacedObject(
      target.placedObjectId,
      this.scene.time.now,
      this.playerSessionState,
      placementSystem,
    );
  }

  private handleGenericDebug(target: GenericDebugInteractionTarget): InteractionResult {
    return {
      ok: true,
      interactionType: 'generic_debug',
      targetId: target.definition.id,
      message: target.anchor.message,
    };
  }
}

function describeResourceNode(resourceNodeType: ResourceNodeInteractionTarget['anchor']['resourceNodeType']): string {
  switch (resourceNodeType) {
    case 'driftwood':
      return 'A scatter of driftwood. Dry enough to carry off and use.';
    case 'stone_pile':
      return 'A loose stone pile with a few pieces worth prying free.';
    case 'herb_patch':
      return 'A herb patch. Useful if you know what to brew with it.';
  }
}
