import type { PlayerInventoryState } from '../player/PlayerInventoryState';
import type { RecipeDefinition } from './RecipeTypes';

export function canCraftRecipe(
  recipe: RecipeDefinition,
  inventory: PlayerInventoryState,
): boolean {
  return recipe.inputs.every((input) => (
    input.kind === 'resource'
      ? inventory.hasAtLeast(input.id, input.amount)
      : inventory.hasItemAtLeast(input.id, input.amount)
  ));
}

export function applyRecipeToInventory(
  recipe: RecipeDefinition,
  inventory: PlayerInventoryState,
): void {
  recipe.inputs.forEach((input) => {
    if (input.kind === 'resource') {
      inventory.consumeDelta({ [input.id]: input.amount });
      return;
    }

    inventory.consumeItem(input.id, input.amount);
  });

  recipe.outputs.forEach((output) => {
    if (output.kind === 'resource') {
      inventory.add(output.id, output.amount);
      return;
    }

    inventory.addItem(output.id, output.amount);
  });
}
