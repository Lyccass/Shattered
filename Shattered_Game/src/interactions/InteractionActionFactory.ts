import type { ActionProgressDefinition } from '../actions/ActionProgressTypes';
import type { ObjectPlacementSystem } from '../objects/ObjectPlacementSystem';
import type { PlayerInventoryState } from '../player/PlayerInventoryState';
import type { PlayerSessionState } from '../player/PlayerSessionState';
import type { InteractionType } from './InteractionTypes';
import type { PlacedObjectInteractionTarget, ResourceNodeInteractionTarget } from './InteractionTypes';
import type { PlacedStructureSystem } from './PlacedStructureSystem';
import type { ResourceNodeSystem } from './ResourceNodeSystem';
import type { WorkbenchSystem } from './WorkbenchSystem';

const GATHER_DURATION_MS = 600;
const CRAFT_DURATION_MS = 1_000;

// Injected into the factory so canContinue can check player proximity
// without the factory depending on PlayerController directly.
export type RangeChecker = (
  interactionType: InteractionType,
  targetId: string,
  rangeTiles: number,
) => boolean;

// Creates ActionProgressDefinition objects for each interaction type.
// Keeps action-creation logic out of WorldRuntimeCoordinator and
// away from the systems themselves (which only know their own data).
export class InteractionActionFactory {
  constructor(
    private readonly resourceNodeSystem: ResourceNodeSystem,
    private readonly workbenchSystem: WorkbenchSystem,
    private readonly placedStructureSystem: PlacedStructureSystem,
    private readonly playerSessionState: PlayerSessionState,
    private readonly checkRange: RangeChecker,
    private readonly getObjectPlacementSystem: () => ObjectPlacementSystem | undefined,
    private readonly getNowMs: () => number,
  ) {}

  createGatherAction(target: ResourceNodeInteractionTarget): ActionProgressDefinition {
    const anchor = this.resourceNodeSystem.getNodeAnchor(target.anchor.id) ?? target.anchor;

    return {
      actionId: `gather:${anchor.id}`,
      label: `Gathering ${getResourceNodeLabel(anchor.resourceNodeType)}`,
      durationMs: GATHER_DURATION_MS,
      interactionType: 'resource_node',
      targetId: anchor.id,
      canContinue: () => this.checkRange(
        'resource_node',
        anchor.id,
        target.definition.interactionRangeTiles,
      ),
      onComplete: () => this.resourceNodeSystem.gatherNode(
        anchor.id,
        this.playerSessionState,
        this.getNowMs(),
        this.getObjectPlacementSystem(),
      ),
      cancellationReason: 'Gathering cancelled.',
      startSfxId: 'gather_start',
      successSfxId: 'gather_success',
      failureSfxId: 'invalid_action',
      cancelSfxId: 'action_cancelled',
    };
  }

  createWorkbenchCraftAction(workbenchId: string, recipeId: string): ActionProgressDefinition {
    const recipe = this.workbenchSystem.getRecipe(workbenchId, recipeId);

    if (!recipe) {
      throw new Error(
        `InteractionActionFactory: unknown recipe "${recipeId}" for workbench "${workbenchId}"`,
      );
    }

    return {
      actionId: `craft:${workbenchId}:${recipe.id}`,
      label: `Crafting ${recipe.displayName}`,
      durationMs: CRAFT_DURATION_MS,
      interactionType: 'workbench',
      targetId: workbenchId,
      canContinue: () => this.checkRange('workbench', workbenchId, 1),
      onComplete: () => this.workbenchSystem.craftRecipe(
        workbenchId,
        recipe.id,
        this.playerSessionState,
      ),
      cancellationReason: 'Crafting cancelled.',
      startSfxId: 'craft_start',
      successSfxId: 'craft_success',
      failureSfxId: 'craft_failed',
      cancelSfxId: 'action_cancelled',
    };
  }

  // Returns null if the placed object cannot be acted upon right now
  // (e.g. missing required inventory). All item-requirement checks
  // are delegated to PlacedStructureSystem.
  createPlacedObjectAction(
    target: PlacedObjectInteractionTarget,
    inventory: PlayerInventoryState,
  ): ActionProgressDefinition | null {
    const config = this.placedStructureSystem.getPlacedObjectActionConfig(
      target.placedObjectId,
      inventory,
    );

    if (!config) {
      return null;
    }

    const placedObjectId = config.placedObjectId;

    return {
      actionId: `placed:${placedObjectId}`,
      label: config.label,
      durationMs: config.durationMs,
      interactionType: 'placed_object',
      targetId: placedObjectId,
      canContinue: () => this.checkRange(
        'placed_object',
        placedObjectId,
        target.definition.interactionRangeTiles,
      ),
      onComplete: () => {
        const ops = this.getObjectPlacementSystem();

        if (!ops) {
          return {
            ok: false,
            sfxId: 'invalid_action',
            interactionType: 'placed_object',
            targetId: placedObjectId,
            message: 'Nothing happens.',
          };
        }

        return this.placedStructureSystem.interactWithPlacedObject(
          placedObjectId,
          this.getNowMs(),
          this.playerSessionState,
          ops,
        );
      },
      cancellationReason: config.cancellationReason,
      startSfxId: config.startSfxId,
      successSfxId: config.successSfxId,
      failureSfxId: config.failureSfxId,
      cancelSfxId: config.cancelSfxId,
    };
  }
}

function getResourceNodeLabel(resourceNodeType: string): string {
  switch (resourceNodeType) {
    case 'driftwood': return 'Driftwood';
    case 'stone_pile': return 'Stone';
    case 'herb_patch': return 'Herbs';
    default: return resourceNodeType;
  }
}
