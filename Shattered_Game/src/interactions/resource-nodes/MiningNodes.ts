import type { ResourceNodeDefinition } from './ResourceNodeDefinition';

// Metalworking resource nodes
// stone_pile: no tool required (loose surface rock).
// Ore veins: require a pickaxe (toolRequired: 'metalworking').
// Tool gatherTier determines bonus yield: +1 ore per tier above 1.

export const STONE_PILE_NODE: ResourceNodeDefinition = {
  type:         'stone_pile',
  skill:        'metalworking',
  xpReward:     25,
  respawnMs:    60_000,
  priority:     85,
  promptText:   'Press E: Gather Stone',
  inventoryKey: 'stone',
  levelRequired: 1,
};

type OreVeinConfig = {
  type:          ResourceNodeDefinition['type'];
  inventoryKey:  string;
  levelRequired: number;
  xpReward:      number;
  promptText:    string;
  respawnMs:     number;
};

const ORE_VEIN_CONFIGS: OreVeinConfig[] = [
  { type: 'copper_vein',   inventoryKey: 'copper_ore',   levelRequired: 1,  xpReward: 35,  promptText: 'Press E: Mine Copper',   respawnMs: 2_000   },
  { type: 'iron_vein',     inventoryKey: 'iron_ore',     levelRequired: 15, xpReward: 60,  promptText: 'Press E: Mine Iron',     respawnMs: 120_000 },
  { type: 'steel_vein',    inventoryKey: 'steel_ore',    levelRequired: 30, xpReward: 100, promptText: 'Press E: Mine Steel',    respawnMs: 150_000 },
  { type: 'cobalt_vein',   inventoryKey: 'cobalt_ore',   levelRequired: 45, xpReward: 160, promptText: 'Press E: Mine Cobalt',   respawnMs: 180_000 },
  { type: 'tungsten_vein', inventoryKey: 'tungsten_ore', levelRequired: 55, xpReward: 240, promptText: 'Press E: Mine Tungsten', respawnMs: 210_000 },
  { type: 'adamant_vein',  inventoryKey: 'adamant_ore',  levelRequired: 65, xpReward: 360, promptText: 'Press E: Mine Adamant',  respawnMs: 240_000 },
  { type: 'titanite_vein', inventoryKey: 'titanite_ore', levelRequired: 75, xpReward: 500, promptText: 'Press E: Mine Titanite', respawnMs: 300_000 },
];

const ORE_VEIN_NODES: ResourceNodeDefinition[] = ORE_VEIN_CONFIGS.map((cfg) => ({
  ...cfg,
  skill:        'metalworking',
  priority:     80,
  toolRequired: 'metalworking',
  yieldBase:    1,
  toolTierBonus: 1,
}));

export const MINING_NODES: readonly ResourceNodeDefinition[] = [
  STONE_PILE_NODE,
  ...ORE_VEIN_NODES,
];
