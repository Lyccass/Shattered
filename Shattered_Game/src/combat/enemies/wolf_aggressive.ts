import { PLAYER_CONFIG } from '../../player/PlayerConfig';
import { CIRCLE_SM, CONE_3T, STAB_2T } from '../AttackShapePresets';
import type { EnemyDefinition } from '../EnemyTypes';

export const WOLF_AGGRESSIVE: EnemyDefinition = {
  id: 'wolf_aggressive',
  displayName: 'Wolf',
  tier: 1,
  maxHealth: 5,
  behavior: 'aggressive',
  moveSpeed: PLAYER_CONFIG.movementSpeed * 0.65,
  collisionRadiusTiles: 0.55,
  aggroRangeTiles: 5,
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
      id: 'wolf_bite',
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
    {
      id: 'wolf_roar',
      displayName: 'Roar',
      kind: 'cone',
      minRangeTiles: 0,
      maxRangeTiles: 3.0,
      damage: 1,
      timing: { windupMs: 1_200, activeMs: 250, recoveryMs: 1_400 },
      telegraph: CONE_3T,
      cooldownMs: 6_000,
      globalCooldownMs: 4_500,
      knockback: { forceTiles: 2.0 },
    },
    {
      id: 'wolf_lunge',
      displayName: 'Lunge',
      kind: 'jump',
      minRangeTiles: 3,
      maxRangeTiles: 6,
      damage: 1,
      timing: { windupMs: 1_000, activeMs: 200, recoveryMs: 1_200 },
      telegraph: CIRCLE_SM,
      cooldownMs: 5_000,
      globalCooldownMs: 4_000,
    },
  ],
};
