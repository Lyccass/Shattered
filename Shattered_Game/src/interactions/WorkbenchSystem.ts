import { applyRecipeToInventory, canCraftRecipe } from '../crafting/RecipeInventory';
import type { RecipeRegistry } from '../crafting/RecipeRegistry';
import type { RecipeDefinition } from '../crafting/RecipeTypes';
import type { ChoiceMenuOption } from './ChoiceMenuTypes';
import type { ChoiceMenuHandler } from './ChoiceMenuCoordinator';
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
      anchors.map((anchor) => [anchor.id, { mapId, anchor }]),
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

  getRecipe(workbenchId: string, recipeId: string): RecipeDefinition | null {
    return this.getRecipesForWorkbench(workbenchId).find((recipe) => recipe.id === recipeId) ?? null;
  }

  getMenuOptions(workbenchId: string, playerSessionState: PlayerSessionState): ChoiceMenuOption[] {
    return this.getRecipesForWorkbench(workbenchId).map((recipe) => ({
      id: recipe.id,
      label: recipe.displayName,
      details: [
        `Need: ${this.getRequirementSummary(recipe)}`,
        `Makes: ${this.getOutputSummary(recipe)}`,
        `XP: ${this.getXpRewardSummary(recipe)}`,
      ].join('\n'),
      disabledReason: canCraftRecipe(recipe, playerSessionState.getInventoryState(), (id) => playerSessionState.getSkillProgressionSystem().getLevel(id))
        ? undefined
        : this.getMissingResourceMessage(recipe),
    }));
  }

  // Returns a handler object for ChoiceMenuCoordinator so the coordinator
  // does not need to know about workbench internals.
  createMenuHandler(workbenchId: string): ChoiceMenuHandler {
    return {
      title: 'Workbench Recipes',
      getOptions: (playerState) => this.getMenuOptions(workbenchId, playerState),
      onConfirm: (optionId, _playerState) => {
        const recipe = this.getRecipe(workbenchId, optionId);

        if (!recipe) {
          return { kind: 'none' };
        }

        return { kind: 'craft', workbenchId, recipeId: recipe.id };
      },
    };
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
        sfxId: 'craft_failed',
        interactionType: 'workbench',
        targetId: workbenchId,
        message: 'Nothing happens.',
      };
    }

    const recipe = this.getRecipesForWorkbench(workbenchId).find((candidate) => candidate.id === recipeId);

    if (!recipe) {
      return {
        ok: false,
        sfxId: 'craft_failed',
        interactionType: 'workbench',
        targetId: workbenchId,
        message: 'That recipe is not available here.',
      };
    }

    const inventory = playerSessionState.getInventoryState();

    if (!canCraftRecipe(recipe, inventory, (id) => playerSessionState.getSkillProgressionSystem().getLevel(id))) {
      return {
        ok: false,
        sfxId: 'craft_failed',
        interactionType: 'workbench',
        targetId: workbenchId,
        message: this.getMissingResourceMessage(recipe),
      };
    }

    applyRecipeToInventory(recipe, inventory);
    playerSessionState.getSkillProgressionSystem().addXpDelta(recipe.xpRewards ?? {});
    const craftedItemId = recipe.outputs[0]?.id;

    return {
      ok: true,
      sfxId: 'craft_success',
      interactionType: 'workbench',
      targetId: workbenchId,
      message: `You craft ${recipe.displayName}.`,
      inventoryDelta: this.getInputDelta(recipe),
      itemDelta: this.getOutputDelta(recipe),
      placementItemId: craftedItemId,
      xpDelta: recipe.xpRewards,
    };
  }

  useWorkbench(workbenchId: string, playerSessionState: PlayerSessionState): InteractionResult {
    const recipes = this.getRecipesForWorkbench(workbenchId);
    const [recipe] = recipes;

    if (!recipe) {
      return {
        ok: false,
        sfxId: 'craft_failed',
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

  private getInputDelta(recipe: RecipeDefinition): Record<string, number> {
    return recipe.inputs.reduce<Record<string, number>>((delta, input) => {
      delta[input.id] = -(input.amount);
      return delta;
    }, {});
  }

  private getOutputDelta(recipe: RecipeDefinition): Record<string, number> {
    return recipe.outputs.reduce<Record<string, number>>((delta, output) => {
      delta[output.id] = (delta[output.id] ?? 0) + output.amount;
      return delta;
    }, {});
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

  private getXpRewardSummary(recipe: RecipeDefinition): string {
    if (!recipe.xpRewards || Object.keys(recipe.xpRewards).length === 0) {
      return 'none';
    }

    return Object.entries(recipe.xpRewards)
      .map(([skillId, amount]) => `+${amount} ${skillId}`)
      .join(' + ');
  }
}
