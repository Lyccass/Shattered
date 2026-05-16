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
}
