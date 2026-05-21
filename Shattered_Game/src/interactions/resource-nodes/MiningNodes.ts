import type { ResourceNodeDefinition } from './ResourceNodeDefinition';

// ── Metalworking resource nodes ───────────────────────────────────────────────
// Add new ore / mineral nodes here (iron, copper, coal…) as metalworking expands.

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

export const MINING_NODES: readonly ResourceNodeDefinition[] = [
  STONE_PILE_NODE,
];
