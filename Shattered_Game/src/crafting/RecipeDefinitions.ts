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
    xpRewards: {
      crafting: 10,
    },
  },
  {
    id: 'workbench_wooden_marker',
    displayName: 'Wooden Marker',
    stationType: 'workbench',
    description: 'A simple trail marker cut from spare wood.',
    inputs: [
      {
        kind: 'resource',
        id: 'wood',
        amount: 2,
      },
    ],
    outputs: [
      {
        kind: 'item',
        id: 'wooden_marker',
        amount: 1,
      },
    ],
    xpRewards: {
      crafting: 12,
    },
  },
  {
    id: 'workbench_camp_supplies',
    displayName: 'Camp Supplies',
    stationType: 'workbench',
    description: 'Bundle wood and stone into a compact field kit.',
    inputs: [
      {
        kind: 'resource',
        id: 'wood',
        amount: 1,
      },
      {
        kind: 'resource',
        id: 'stone',
        amount: 1,
      },
    ],
    outputs: [
      {
        kind: 'item',
        id: 'camp_supplies',
        amount: 1,
      },
    ],
    xpRewards: {
      crafting: 14,
    },
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
    xpRewards: {
      survival: 8,
    },
  },
];
