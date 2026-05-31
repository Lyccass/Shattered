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
import {
  isContractBoardTarget,
  isGenericDebugTarget,
  isGroundItemTarget,
  isMapTransitionTarget,
  isNpcTarget,
  isPlacedObjectTarget,
  isResourceNodeTarget,
  isWorkbenchTarget,
} from '../../interactions/InteractionTypes';
import type { PlacedStructureSystem } from '../../interactions/PlacedStructureSystem';
import type { ResourceNodeSystem } from '../../interactions/ResourceNodeSystem';
import type { WorkbenchSystem } from '../../interactions/WorkbenchSystem';
import type { ObjectPlacementSystem } from '../../objects/ObjectPlacementSystem';
import type { PlayerSessionState } from '../../player/PlayerSessionState';
import type { NpcRegistry } from '../../npcs/NpcRegistry';
import type { NpcSystem } from '../../npcs/NpcSystem';
import { NpcDialogueMenuHandler } from '../../npcs/NpcDialogueMenuHandler';
import type { ChoiceMenuHandler } from '../../interactions/ChoiceMenuCoordinator';
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
    private readonly npcRegistry?: NpcRegistry,
    private readonly getNpcSystem?: () => NpcSystem | null,
  ) {}

  createNpcDialogueMenuHandler(target: NpcInteractionTarget): ChoiceMenuHandler | null {
    const npcDefId = target.anchor.npcDefinitionId;
    if (!npcDefId || !this.npcRegistry?.has(npcDefId)) return null;

    const def = this.npcRegistry.get(npcDefId);
    if (!def.options?.length) return null;

    const greetingLine = def.dialogue[0]?.text;
    if (greetingLine) {
      this.getNpcSystem?.()?.showBubble(target.definition.id, greetingLine, this.scene.time.now);
    }

    return new NpcDialogueMenuHandler(def, target.definition.id, this.contractBoardSystem);
  }

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
    const { id, interactionType } = target.definition;
    if (isMapTransitionTarget(target)) return {
      ok: true, interactionType: 'map_transition', targetId: id,
      message: `A route leading to ${getMapDisplayName(target.transition.targetMapId)}.`,
      toastKind: 'info',
    };
    if (isResourceNodeTarget(target)) return {
      ok: true, interactionType: 'resource_node', targetId: id,
      message: describeResourceNode(target.anchor.resourceNodeType),
      toastKind: 'info',
    };
    if (isNpcTarget(target)) return {
      ok: true, interactionType: 'npc', targetId: id,
      message: target.anchor.promptLabel ? `${target.anchor.promptLabel}.` : 'Someone worth talking to.',
      toastKind: 'info',
    };
    if (isWorkbenchTarget(target)) return {
      ok: true, interactionType: 'workbench', targetId: id,
      message: 'A rough workbench for simple field crafting.',
      toastKind: 'info',
    };
    if (isContractBoardTarget(target)) return {
      ok: true, interactionType: 'contract_board', targetId: id,
      message: 'A contract board covered in requests, notices, and harbour jobs.',
      toastKind: 'info',
    };
    if (isPlacedObjectTarget(target)) return {
      ok: true, interactionType: 'placed_object', targetId: id,
      message: target.placedObjectKind === 'campfire'
        ? 'A campfire. Good for warmth and brewing.'
        : 'A prepared firestarter waiting for a spark.',
      toastKind: 'info',
    };
    if (isGenericDebugTarget(target)) return {
      ok: true, interactionType: 'generic_debug', targetId: id,
      message: target.anchor.message,
      toastKind: 'info',
    };
    if (isGroundItemTarget(target)) return {
      ok: true, interactionType: 'ground_item', targetId: id,
      message: target.definition.promptText,
      toastKind: 'info',
    };
    throw new Error(`Unhandled interaction type: ${interactionType}`);
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
    const npcDefId = target.anchor.npcDefinitionId;
    const nowMs = this.scene.time.now;

    if (npcDefId && this.npcRegistry?.has(npcDefId)) {
      const def = this.npcRegistry.get(npcDefId);
      const dialogueLine = def.dialogue[0]?.text ?? target.anchor.text;
      this.getNpcSystem?.()?.showBubble(target.definition.id, dialogueLine, nowMs);

      if (def.shopId) {
        return {
          ok: true,
          interactionType: 'npc',
          targetId: target.definition.id,
          message: dialogueLine,
          openShopId: def.shopId,
        };
      }

      return {
        ok: true,
        interactionType: 'npc',
        targetId: target.definition.id,
        message: dialogueLine,
      };
    }

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
