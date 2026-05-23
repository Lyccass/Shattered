import type { RecipeDefinition } from './RecipeTypes';

export const RECIPE_DEFINITIONS: RecipeDefinition[] = [
  // ─── Workbench ────────────────────────────────────────────────────────────
  {
    id: 'workbench_firestarter_set',
    displayName: 'Firestarter Set',
    stationType: 'workbench',
    description: 'Tie together a small dry bundle that can be placed and lit later.',
    inputs: [{ id: 'wood', amount: 1 }],
    outputs: [{ id: 'firestarter_set', amount: 1 }],
    xpRewards: { woodworking: 40 },
  },
  {
    id: 'workbench_wooden_marker',
    displayName: 'Wooden Marker',
    stationType: 'workbench',
    description: 'A simple trail marker cut from spare wood.',
    inputs: [{ id: 'wood', amount: 2 }],
    outputs: [{ id: 'wooden_marker', amount: 1 }],
    xpRewards: { woodworking: 50 },
  },
  {
    id: 'workbench_camp_supplies',
    displayName: 'Camp Supplies',
    stationType: 'workbench',
    description: 'Bundle wood and stone into a compact field kit.',
    inputs: [
      { id: 'wood',  amount: 1 },
      { id: 'stone', amount: 1 },
    ],
    outputs: [{ id: 'camp_supplies', amount: 1 }],
    xpRewards: { woodworking: 60 },
    levelRequirements: { woodworking: 3 },
  },

  // ─── Campfire ─────────────────────────────────────────────────────────────
  {
    id: 'campfire_warm_tea',
    displayName: 'Warm Tea',
    stationType: 'campfire',
    requiredActiveObjectType: 'campfire',
    description: 'Steep gathered herbs over the fire for a warming drink.',
    inputs: [{ id: 'herb', amount: 1 }],
    outputs: [{ id: 'warm_tea', amount: 1 }],
    xpRewards: { alchemy: 30 },
  },

  // ─── By hand ──────────────────────────────────────────────────────────────
  {
    id: 'hand_firestarter_set',
    displayName: 'Firestarter Set',
    stationType: 'hand',
    description: 'Strike stone against dry wood to make a firestarter.',
    inputs: [
      { id: 'wood',  amount: 1 },
      { id: 'stone', amount: 1 },
    ],
    outputs: [{ id: 'firestarter_set', amount: 1 }],
    xpRewards: { woodworking: 35 },
  },
  {
    id: 'hand_warm_tea',
    displayName: 'Herbal Pouch',
    stationType: 'hand',
    description: 'Bundle herbs together for a crude remedy.',
    inputs: [{ id: 'herb', amount: 2 }],
    outputs: [{ id: 'warm_tea', amount: 1 }],
    xpRewards: { alchemy: 25 },
  },
];
