import type {
  PlayerItemKey,
  PlayerResourceKey,
} from '../player/PlayerInventoryState';
import type { SkillId, SkillXpDelta } from '../skills/SkillTypes';

export type CraftingStationType = 'workbench' | 'campfire' | 'hand';

export type RecipeInput =
  | {
      kind: 'resource';
      id: PlayerResourceKey;
      amount: number;
    }
  | {
      kind: 'item';
      id: PlayerItemKey;
      amount: number;
    };

export type RecipeOutput =
  | {
      kind: 'resource';
      id: PlayerResourceKey;
      amount: number;
    }
  | {
      kind: 'item';
      id: PlayerItemKey;
      amount: number;
    };

export type RecipeDefinition = {
  id: string;
  displayName: string;
  stationType: CraftingStationType;
  inputs: RecipeInput[];
  outputs: RecipeOutput[];
  xpRewards?: SkillXpDelta;
  // Absolute skill levels (1–100) required to attempt this recipe.
  levelRequirements?: Partial<Record<SkillId, number>>;
  requiredActiveObjectType?: string;
  description: string;
};
