import type { EnemyDefinition } from './EnemyTypes';
import { TRAINING_WRETCH } from './enemies/training_wretch';
import { WOLF_AGGRESSIVE } from './enemies/wolf_aggressive';
import { WOLF_PASSIVE } from './enemies/wolf_passive';

export const ENEMY_DEFINITIONS: EnemyDefinition[] = [
  TRAINING_WRETCH,
  WOLF_AGGRESSIVE,
  WOLF_PASSIVE,
];

for (const def of ENEMY_DEFINITIONS) {
  for (const atk of def.attacks) {
    if (!(atk.apCost >= 1)) {
      throw new Error(`[EnemyDefinitions] ${def.id}.${atk.id}: apCost must be >= 1 (got ${atk.apCost})`);
    }
    if (!(atk.maxRangeTiles >= 1)) {
      throw new Error(`[EnemyDefinitions] ${def.id}.${atk.id}: maxRangeTiles must be >= 1 (got ${atk.maxRangeTiles})`);
    }
  }
}
