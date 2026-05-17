import type Phaser from 'phaser';
import type { ContractBoardSystem } from '../../contracts/ContractBoardSystem';
import type {
  ContractBoardInteractionTarget,
  GenericDebugInteractionTarget,
  InteractionHandlers,
  InteractionResult,
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
    };
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
