import { applyRecipeToInventory, canCraftRecipe } from '../crafting/RecipeInventory';
import type { RecipeRegistry } from '../crafting/RecipeRegistry';
import type { RecipeDefinition } from '../crafting/RecipeTypes';
import type { PlayerInventoryState } from '../player/PlayerInventoryState';
import type { MapWorkbenchAnchor } from '../world/maps/MapTypes';
import type { InteractionResult, WorkbenchInteractionTarget } from './InteractionTypes';
import { createSingleTileInteractionTiles } from './InteractionTypes';

type WorkbenchState = {
  mapId: string;
  anchor: MapWorkbenchAnchor;
};

export class WorkbenchSystem {
  private currentWorkbenches = new Map<string, WorkbenchState>();

  constructor(private readonly recipeRegistry: RecipeRegistry) {}

  setMapWorkbenches(mapId: string, anchors: MapWorkbenchAnchor[]): void {
    this.currentWorkbenches = new Map(
      anchors.map((anchor) => [
        anchor.id,
        {
          mapId,
          anchor,
        },
      ]),
    );
  }

  createInteractionTargets(): WorkbenchInteractionTarget[] {
    return Array.from(this.currentWorkbenches.values()).map((state) => ({
      definition: {
        id: state.anchor.id,
        interactionType: 'workbench',
        promptText: `Press E: Craft ${this.getPrimaryRecipe(state.anchor).displayName}`,
        interactionRangeTiles: state.anchor.interactionRangeTiles ?? 1,
        priority: 95,
      },
      tiles: createSingleTileInteractionTiles(state.anchor.tileX, state.anchor.tileY),
      anchor: state.anchor,
    }));
  }

  useWorkbench(workbenchId: string, inventory: PlayerInventoryState): InteractionResult {
    const state = this.currentWorkbenches.get(workbenchId);

    if (!state) {
      return {
        ok: false,
        interactionType: 'workbench',
        targetId: workbenchId,
        message: 'Nothing happens.',
      };
    }

    const recipe = this.getPrimaryRecipe(state.anchor);

    if (!canCraftRecipe(recipe, inventory)) {
      return {
        ok: false,
        interactionType: 'workbench',
        targetId: workbenchId,
        message: state.anchor.missingResourceMessage ?? this.getMissingResourceMessage(recipe),
      };
    }

    applyRecipeToInventory(recipe, inventory);
    const craftedItemId = recipe.outputs.find((output) => output.kind === 'item')?.id;

    return {
      ok: true,
      interactionType: 'workbench',
      targetId: workbenchId,
      message: state.anchor.successMessage ?? `You craft ${recipe.displayName}.`,
      inventoryDelta: this.getInventoryDelta(recipe),
      itemDelta: this.getItemDelta(recipe),
      placementItemId: craftedItemId,
    };
  }

  private getPrimaryRecipe(anchor: MapWorkbenchAnchor): RecipeDefinition {
    const stationType = anchor.stationType ?? 'workbench';
    const [recipe] = this.recipeRegistry.listByStation(stationType);

    if (!recipe) {
      throw new Error(`WorkbenchSystem: no recipes registered for station "${stationType}"`);
    }

    return recipe;
  }

  private getMissingResourceMessage(recipe: RecipeDefinition): string {
    const firstInput = recipe.inputs[0];

    if (!firstInput) {
      return 'You are missing materials.';
    }

    return `You need ${firstInput.amount} ${firstInput.id}.`;
  }

  private getInventoryDelta(recipe: RecipeDefinition): Record<string, number> {
    return recipe.inputs.reduce<Record<string, number>>((delta, input) => {
      if (input.kind === 'resource') {
        delta[input.id] = -input.amount;
      }
      return delta;
    }, {});
  }

  private getItemDelta(recipe: RecipeDefinition): Record<string, number> {
    return recipe.outputs.reduce<Record<string, number>>((delta, output) => {
      if (output.kind === 'item') {
        delta[output.id] = output.amount;
      }
      return delta;
    }, {});
  }
}
