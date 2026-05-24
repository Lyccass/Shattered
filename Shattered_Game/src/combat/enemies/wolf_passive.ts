import { PLAYER_CONFIG } from '../../player/PlayerConfig';
import { STAB_2T } from '../AttackShapePresets';
import type { EnemyDefinition } from '../EnemyTypes';

export const WOLF_PASSIVE: EnemyDefinition = {
  id: 'wolf_passive',
  displayName: 'Wolf',
  tier: 1,
  maxHealth: 5,
  behavior: 'passive',
  moveSpeed: PLAYER_CONFIG.movementSpeed * 0.40,
  collisionRadiusTiles: 0.55,
  aggroRangeTiles: 0,
  leashRangeTiles: 10,
  deAggroRangeTiles: 15,
  lootTables: [
    { oneIn: 1, entries: [{ itemId: 'bone', weight: 1 }] },
    {
      oneIn: 1,
      entries: [
        { itemId: 'wolf_pelt_healthy', weight: 1 },
        { itemId: 'wolf_pelt_torn',    weight: 4 },
      ],
    },
  ],
  attacks: [
    {
      id: 'wolf_passive_bite',
      displayName: 'Bite',
      kind: 'stab',
      minRangeTiles: 0,
      maxRangeTiles: 2.0,
      damage: 1,
      timing: { windupMs: 600, activeMs: 160, recoveryMs: 900 },
      telegraph: STAB_2T,
      cooldownMs: 2_000,
      globalCooldownMs: 1_400,
    },
  ],
};
