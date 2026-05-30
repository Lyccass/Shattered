import { PLAYER_CONFIG } from '../../player/PlayerConfig';
import { CIRCLE_SM, CONE_3T, STAB_2T } from '../AttackShapePresets';
import type { EnemyDefinition } from '../EnemyTypes';

export const WOLF_AGGRESSIVE: EnemyDefinition = {
  id: 'wolf_aggressive',
  displayName: 'Wolf',
  tier: 1,
  maxHealth: 5,
  behavior: 'aggressive',
  moveSpeed: PLAYER_CONFIG.movementSpeed * 0.70,
  collisionRadiusTiles: 0.55,
  aggroRangeTiles: 8,
  leashRangeTiles: 14,
  deAggroRangeTiles: 20,
  retreatRangeTiles: 4.0,
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
      maxRangeTiles: 2.5,
      damage: 1,
      timing: { windupMs: 500, activeMs: 160, recoveryMs: 700 },
      telegraph: STAB_2T,
      cooldownMs: 1_200,
      globalCooldownMs: 900,
    },
    {
      id: 'wolf_roar',
      displayName: 'Roar',
      kind: 'cone',
      minRangeTiles: 0,
      maxRangeTiles: 2.5,
      damage: 1,
      timing: { windupMs: 1_000, activeMs: 250, recoveryMs: 1_200 },
      telegraph: CONE_3T,
      cooldownMs: 4_000,
      globalCooldownMs: 3_000,
      knockback: { forceTiles: 2.0 },
    },
    {
      id: 'wolf_lunge',
      displayName: 'Lunge',
      kind: 'jump',
      minRangeTiles: 2,
      maxRangeTiles: 6,
      damage: 1,
      timing: { windupMs: 900, activeMs: 200, recoveryMs: 1_000 },
      telegraph: CIRCLE_SM,
      cooldownMs: 3_500,
      globalCooldownMs: 2_800,
    },
  ],
};
