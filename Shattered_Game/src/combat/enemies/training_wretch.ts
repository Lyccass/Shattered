import { PLAYER_CONFIG } from '../../player/PlayerConfig';
import { CIRCLE_MD, CONE_3T, STAB_3T } from '../AttackShapePresets';
import type { EnemyDefinition } from '../EnemyTypes';

export const TRAINING_WRETCH: EnemyDefinition = {
  id: 'training_wretch',
  displayName: 'Training Wretch',
  tier: 1,
  maxHealth: 5,
  moveSpeed: PLAYER_CONFIG.movementSpeed * 0.42,
  collisionRadiusTiles: 0.65,
  aggroRangeTiles: 9.25,
  leashRangeTiles: 11,
  deAggroRangeTiles: 18,
  lootTables: [
    { oneIn: 1, entries: [{ itemId: 'wood',  count: 2, weight: 1 }] },
    { oneIn: 2, entries: [{ itemId: 'stone',         weight: 1 }] },
    { oneIn: 3, entries: [{ itemId: 'herb',          weight: 1 }] },
  ],
  attacks: [
    {
      id: 'wretch_swipe',
      displayName: 'Swipe',
      kind: 'stab',
      minRangeTiles: 0,
      maxRangeTiles: 3.0,
      damage: 1,
      timing: { windupMs: 900, activeMs: 220, recoveryMs: 1_100 },
      telegraph: STAB_3T,
      cooldownMs: 2_200,
      globalCooldownMs: 1_600,
    },
    {
      id: 'wretch_roar',
      displayName: 'Roar',
      kind: 'cone',
      minRangeTiles: 0,
      maxRangeTiles: 3.0,
      damage: 1,
      timing: { windupMs: 1_800, activeMs: 350, recoveryMs: 1_900 },
      telegraph: CONE_3T,
      cooldownMs: 7_500,
      globalCooldownMs: 5_000,
      knockback: { forceTiles: 3.5 },
    },
    {
      id: 'wretch_jump',
      displayName: 'Leap',
      kind: 'jump',
      minRangeTiles: 4.5,
      maxRangeTiles: 9.5,
      damage: 2,
      timing: { windupMs: 1_400, activeMs: 280, recoveryMs: 1_600 },
      telegraph: CIRCLE_MD,
      cooldownMs: 7_000,
      globalCooldownMs: 5_500,
    },
  ],
};
