import type { SkillId, SkillXpDelta } from '../skills/SkillTypes';

export type CraftingStationType = 'workbench' | 'campfire' | 'hand';

// All items share a single ID space — no more resource/item kind split.
export type RecipeIngredient = {
  id: string;
  amount: number;
};

export type RecipeInput  = RecipeIngredient;
export type RecipeOutput = RecipeIngredient;

export type RecipeDefinition = {
  id: string;
  displayName: string;
  stationType: CraftingStationType;
  inputs: RecipeInput[];
  outputs: RecipeOutput[];
  xpRewards?: SkillXpDelta;
  levelRequirements?: Partial<Record<SkillId, number>>;
  requiredActiveObjectType?: string;
  description: string;
};
