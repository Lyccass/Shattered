import type { EnemyDefinition } from './EnemyTypes';
import { BADGER_AGGRESSIVE } from './enemies/badger_aggressive';
import { BADGER_PASSIVE } from './enemies/badger_passive';
import { BOAR_AGGRESSIVE } from './enemies/boar_aggressive';
import { BOAR_PASSIVE } from './enemies/boar_passive';
import { STAG_AGGRESSIVE } from './enemies/stag_aggressive';
import { STAG_PASSIVE } from './enemies/stag_passive';
import { WOLF_AGGRESSIVE } from './enemies/wolf_aggressive';
import { WOLF_PASSIVE } from './enemies/wolf_passive';

export const ENEMY_DEFINITIONS: EnemyDefinition[] = [
  BADGER_AGGRESSIVE,
  BADGER_PASSIVE,
  BOAR_AGGRESSIVE,
  BOAR_PASSIVE,
  STAG_AGGRESSIVE,
  STAG_PASSIVE,
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
