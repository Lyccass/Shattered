import type { ResourceNodeDefinition } from './ResourceNodeDefinition';

// Woodworking resource nodes
// driftwood: no tool required (shore/fallen debris, no chopping needed).
// Trees: require an axe equipped in main_hand (toolRequired: 'woodworking').
// Tool gatherTier (= axe material rank) adds bonus logs per chop.

export const DRIFTWOOD_NODE: ResourceNodeDefinition = {
  type:         'driftwood',
  skill:        'woodworking',
  xpReward:     25,
  respawnMs:    45_000,
  priority:     90,
  promptText:   'Press E: Gather Driftwood',
  inventoryKey: 'wood',
  levelRequired: 1,
};

type TreeConfig = {
  type:          ResourceNodeDefinition['type'];
  inventoryKey:  string;
  levelRequired: number;
  xpReward:      number;
  promptText:    string;
  respawnMs:     number;
};

const TREE_CONFIGS: TreeConfig[] = [
  { type: 'pine_tree',      inventoryKey: 'pine_log',      levelRequired: 1,  xpReward: 40,  promptText: 'Press E: Chop Pine',      respawnMs: 2_000   },
  { type: 'oak_tree',       inventoryKey: 'oak_log',       levelRequired: 15, xpReward: 70,  promptText: 'Press E: Chop Oak',       respawnMs: 90_000  },
  { type: 'ash_tree',       inventoryKey: 'ash_log',       levelRequired: 25, xpReward: 110, promptText: 'Press E: Chop Ash',       respawnMs: 110_000 },
  { type: 'yew_tree',       inventoryKey: 'yew_log',       levelRequired: 35, xpReward: 160, promptText: 'Press E: Chop Yew',       respawnMs: 130_000 },
  { type: 'redwood_tree',   inventoryKey: 'redwood_log',   levelRequired: 50, xpReward: 240, promptText: 'Press E: Chop Redwood',   respawnMs: 160_000 },
  { type: 'blackwood_tree', inventoryKey: 'blackwood_log', levelRequired: 65, xpReward: 360, promptText: 'Press E: Chop Blackwood', respawnMs: 200_000 },
  { type: 'ebony_tree',     inventoryKey: 'ebony_log',     levelRequired: 80, xpReward: 500, promptText: 'Press E: Chop Ebony',     respawnMs: 240_000 },
];

const TREE_NODES: ResourceNodeDefinition[] = TREE_CONFIGS.map((cfg) => ({
  ...cfg,
  skill:         'woodworking',
  priority:      88,
  toolRequired:  'woodworking',
  yieldBase:     1,
  toolTierBonus: 1,
}));

export const WOODCUTTING_NODES: readonly ResourceNodeDefinition[] = [
  DRIFTWOOD_NODE,
  ...TREE_NODES,
];
