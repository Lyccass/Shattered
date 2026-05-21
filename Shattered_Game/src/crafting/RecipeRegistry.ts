import type { RecipeDefinition, CraftingStationType } from './RecipeTypes';

export class RecipeRegistry {
  private readonly byId = new Map<string, RecipeDefinition>();

  constructor(definitions: readonly RecipeDefinition[]) {
    definitions.forEach((definition) => {
      this.byId.set(definition.id, definition);
    });
  }

  get(recipeId: string): RecipeDefinition {
    const definition = this.byId.get(recipeId);

    if (!definition) {
      throw new Error(`RecipeRegistry: unknown recipe "${recipeId}"`);
    }

    return definition;
  }

  listByStation(stationType: CraftingStationType): RecipeDefinition[] {
    return Array.from(this.byId.values()).filter(
      (definition) => definition.stationType === stationType,
    );
  }

  findHandRecipeForItems(itemA: string, itemB: string): RecipeDefinition | undefined {
    const ids = new Set([itemA, itemB]);
    return Array.from(this.byId.values()).find((recipe) => {
      if (recipe.stationType !== 'hand') return false;
      const inputIds = recipe.inputs.map((i) => i.id);
      return inputIds.length === 2
        ? ids.has(inputIds[0]) && ids.has(inputIds[1]) && inputIds[0] !== inputIds[1]
        : inputIds.length === 1 && ids.size === 1 && ids.has(inputIds[0]);
    });
  }
}
