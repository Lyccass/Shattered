import type { EnemySpawnDefinition } from './EnemyTypes';

export const COMBAT_SANDBOX_SPAWNS: EnemySpawnDefinition[] = [
  {
    id: 'wild_wolf_aggressive_01',
    definitionId: 'wolf_aggressive',
    mapId: 'test_wild_island',
    tileX: 76,
    tileY: 96,
  },
  {
    id: 'wild_wolf_passive_01',
    definitionId: 'wolf_passive',
    mapId: 'test_wild_island',
    tileX: 108,
    tileY: 96,
  },
  {
    id: 'wild_wolf_passive_02',
    definitionId: 'wolf_passive',
    mapId: 'test_wild_island',
    tileX: 63,
    tileY: 65,
  },
];
