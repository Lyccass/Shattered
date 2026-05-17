import { applyRecipeToInventory, canCraftRecipe } from '../crafting/RecipeInventory';
import type { RecipeRegistry } from '../crafting/RecipeRegistry';
import type { RecipeDefinition } from '../crafting/RecipeTypes';
import type { ChoiceMenuOption } from './ChoiceMenuTypes';
import type { PlayerSessionState } from '../player/PlayerSessionState';
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
        promptText: this.getRecipesForWorkbench(state.anchor.id).length > 1
          ? 'Press E: Use Workbench'
          : `Press E: Craft ${this.getPrimaryRecipe(state.anchor).displayName}`,
        interactionRangeTiles: state.anchor.interactionRangeTiles ?? 1,
        priority: 95,
      },
      tiles: createSingleTileInteractionTiles(state.anchor.tileX, state.anchor.tileY),
      anchor: state.anchor,
    }));
  }

  getRecipesForWorkbench(workbenchId: string): RecipeDefinition[] {
    const state = this.currentWorkbenches.get(workbenchId);

    if (!state) {
      return [];
    }

    return this.recipeRegistry.listByStation(state.anchor.stationType ?? 'workbench');
  }

  getMenuOptions(workbenchId: string, playerSessionState: PlayerSessionState): ChoiceMenuOption[] {
    return this.getRecipesForWorkbench(workbenchId).map((recipe) => ({
      id: recipe.id,
      label: recipe.displayName,
      details: `${this.getRequirementSummary(recipe)} -> ${this.getOutputSummary(recipe)}`,
      disabledReason: canCraftRecipe(recipe, playerSessionState.getInventoryState())
        ? undefined
        : this.getMissingResourceMessage(recipe),
    }));
  }

  craftRecipe(
    workbenchId: string,
    recipeId: string,
    playerSessionState: PlayerSessionState,
  ): InteractionResult {
    const state = this.currentWorkbenches.get(workbenchId);

    if (!state) {
      return {
        ok: false,
        interactionType: 'workbench',
        targetId: workbenchId,
        message: 'Nothing happens.',
      };
    }

    const recipe = this.getRecipesForWorkbench(workbenchId).find((candidate) => candidate.id === recipeId);

    if (!recipe) {
      return {
        ok: false,
        interactionType: 'workbench',
        targetId: workbenchId,
        message: 'That recipe is not available here.',
      };
    }

    const inventory = playerSessionState.getInventoryState();

    if (!canCraftRecipe(recipe, inventory)) {
      return {
        ok: false,
        interactionType: 'workbench',
        targetId: workbenchId,
        message: this.getMissingResourceMessage(recipe),
      };
    }

    applyRecipeToInventory(recipe, inventory);
    playerSessionState.getSkillProgressionSystem().addXpDelta(recipe.xpRewards ?? {});
    const craftedItemId = recipe.outputs.find((output) => output.kind === 'item')?.id;

    return {
      ok: true,
      interactionType: 'workbench',
      targetId: workbenchId,
      message: `You craft ${recipe.displayName}.`,
      inventoryDelta: this.getInventoryDelta(recipe),
      itemDelta: this.getItemDelta(recipe),
      placementItemId: craftedItemId,
    };
  }

  useWorkbench(workbenchId: string, playerSessionState: PlayerSessionState): InteractionResult {
    const recipes = this.getRecipesForWorkbench(workbenchId);
    const [recipe] = recipes;

    if (!recipe) {
      return {
        ok: false,
        interactionType: 'workbench',
        targetId: workbenchId,
        message: 'Nothing happens.',
      };
    }

    return this.craftRecipe(workbenchId, recipe.id, playerSessionState);
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
    return `Need ${this.getRequirementSummary(recipe)}.`;
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
    const delta = recipe.inputs.reduce<Record<string, number>>((nextDelta, input) => {
      if (input.kind === 'item') {
        nextDelta[input.id] = (nextDelta[input.id] ?? 0) - input.amount;
      }
      return nextDelta;
    }, {});

    recipe.outputs.forEach((output) => {
      if (output.kind === 'item') {
        delta[output.id] = (delta[output.id] ?? 0) + output.amount;
      }
    });

    return delta;
  }

  private getRequirementSummary(recipe: RecipeDefinition): string {
    return recipe.inputs
      .map((input) => `${input.amount} ${input.id.replaceAll('_', ' ')}`)
      .join(' + ');
  }

  private getOutputSummary(recipe: RecipeDefinition): string {
    return recipe.outputs
      .map((output) => `${output.amount} ${output.id.replaceAll('_', ' ')}`)
      .join(' + ');
  }
}
