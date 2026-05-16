import type { RecipeDefinition } from './RecipeTypes';

export const RECIPE_DEFINITIONS: RecipeDefinition[] = [
  {
    id: 'workbench_firestarter_set',
    displayName: 'Firestarter Set',
    stationType: 'workbench',
    description: 'Tie together a small dry bundle that can be placed and lit later.',
    inputs: [
      {
        kind: 'resource',
        id: 'wood',
        amount: 1,
      },
    ],
    outputs: [
      {
        kind: 'item',
        id: 'firestarter_set',
        amount: 1,
      },
    ],
  },
  {
    id: 'campfire_warm_tea',
    displayName: 'Warm Tea',
    stationType: 'campfire',
    requiredActiveObjectType: 'campfire',
    description: 'Steep gathered herbs over the fire for a warming drink.',
    inputs: [
      {
        kind: 'resource',
        id: 'herb',
        amount: 1,
      },
    ],
    outputs: [
      {
        kind: 'item',
        id: 'warm_tea',
        amount: 1,
      },
    ],
  },
];
