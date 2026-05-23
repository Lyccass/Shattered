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
    if (!(atk.cooldownMs > 0)) {
      throw new Error(`[EnemyDefinitions] ${def.id}.${atk.id}: cooldownMs must be > 0 (got ${atk.cooldownMs})`);
    }

    if (!(atk.globalCooldownMs > 0)) {
      throw new Error(`[EnemyDefinitions] ${def.id}.${atk.id}: globalCooldownMs must be > 0 (got ${atk.globalCooldownMs})`);
    }

    if (!(atk.timing.windupMs > 0 && atk.timing.activeMs > 0 && atk.timing.recoveryMs > 0)) {
      throw new Error(`[EnemyDefinitions] ${def.id}.${atk.id}: all timing values must be > 0`);
    }
  }
}
