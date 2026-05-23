import type { PlayerInventoryState } from '../player/PlayerInventoryState';
import type { SkillId } from '../skills/SkillTypes';
import type { RecipeDefinition } from './RecipeTypes';

export function canCraftRecipe(
  recipe: RecipeDefinition,
  inventory: PlayerInventoryState,
  getSkillLevel?: (skillId: SkillId) => number,
): boolean {
  const hasMaterials = recipe.inputs.every((input) => inventory.hasAtLeast(input.id, input.amount));
  if (!hasMaterials) return false;

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
  const missingInput = recipe.inputs.find((input) => !inventory.hasAtLeast(input.id, input.amount));
  if (missingInput) {
    return `Need ${missingInput.amount}x ${missingInput.id}`;
  }

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
  for (const input of recipe.inputs) {
    inventory.consume(input.id, input.amount);
  }
  for (const output of recipe.outputs) {
    inventory.add(output.id, output.amount);
  }
}
