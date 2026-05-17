import type {
  PlayerItemKey,
  PlayerResourceKey,
} from '../player/PlayerInventoryState';
import type { SkillXpDelta } from '../skills/SkillTypes';

export type CraftingStationType = 'workbench' | 'campfire';

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
  requiredActiveObjectType?: string;
  description: string;
};
