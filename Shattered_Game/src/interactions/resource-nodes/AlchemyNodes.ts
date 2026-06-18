import type { ResourceNodeDefinition } from './ResourceNodeDefinition';

// Alchemy resource nodes
// Add new herb / mushroom / reagent nodes here as alchemy expands.

export const HERB_PATCH_NODE: ResourceNodeDefinition = {
  type:         'herb_patch',
  skill:        'alchemy',
  xpReward:     25,
  respawnMs:    50_000,
  priority:     80,
  promptText:   'Press E: Gather Herbs',
  inventoryKey: 'herb',
  levelRequired: 1,
};

export const ALCHEMY_NODES: readonly ResourceNodeDefinition[] = [
  HERB_PATCH_NODE,
];
