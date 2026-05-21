import type { PlayerInventoryState } from '../player/PlayerInventoryState';
import type { SkillId } from '../skills/SkillTypes';
import type { RecipeDefinition } from './RecipeTypes';

export function canCraftRecipe(
  recipe: RecipeDefinition,
  inventory: PlayerInventoryState,
  getSkillLevel?: (skillId: SkillId) => number,
): boolean {
  // Check material requirements
  const hasMaterials = recipe.inputs.every((input) => (
    input.kind === 'resource'
      ? inventory.hasAtLeast(input.id, input.amount)
      : inventory.hasItemAtLeast(input.id, input.amount)
  ));
  if (!hasMaterials) return false;

  // Check skill level requirements
  if (getSkillLevel && recipe.levelRequirements) {
    for (const [id, required] of Object.entries(recipe.levelRequirements) as [SkillId, number][]) {
      if (getSkillLevel(id) < required) return false;
    }
  }

  return true;
}

export function canCraftReasonText(
  recipe: RecipeDefinition,
  inventory: PlayerInventoryState,
  getSkillLevel?: (skillId: SkillId) => number,
): string | undefined {
  // Material check
  const missingInput = recipe.inputs.find((input) => (
    input.kind === 'resource'
      ? !inventory.hasAtLeast(input.id, input.amount)
      : !inventory.hasItemAtLeast(input.id, input.amount)
  ));
  if (missingInput) {
    return `Need ${missingInput.amount}x ${missingInput.id}`;
  }

  // Level check
  if (getSkillLevel && recipe.levelRequirements) {
    for (const [id, required] of Object.entries(recipe.levelRequirements) as [SkillId, number][]) {
      const current = getSkillLevel(id);
      if (current < required) {
        return `Requires ${id} level ${required} (you have ${current})`;
      }
    }
  }

  return undefined;
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
