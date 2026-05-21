import type { ResourceNodeDefinition } from './ResourceNodeDefinition';

// ── Woodworking resource nodes ────────────────────────────────────────────────
// Add new wood-type nodes here (oak, pine, mahogany…) as the game expands.

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

export const WOODCUTTING_NODES: readonly ResourceNodeDefinition[] = [
  DRIFTWOOD_NODE,
];
