import { PLAYER_CONFIG } from '../../player/PlayerConfig';
import type { EnemyDefinition } from '../EnemyTypes';

export const WOLF_PASSIVE: EnemyDefinition = {
  id: 'wolf_passive',
  displayName: 'Wolf',
  tier: 1,
  maxHealth: 5,
  initiative: 8,
  mpPerTurn: 3,
  apPerTurn: 1,
  defense: 0,
  behavior: 'passive',
  moveSpeed: PLAYER_CONFIG.movementSpeed * 0.70,
  collisionRadiusTiles: 0.55,
  aggroRangeTiles: 0,
  leashRangeTiles: 10,
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
      apCost: 1,
      minRangeTiles: 0,
      maxRangeTiles: 1,
      damage: 2,
      damageType: 'pierce',
      hitChance: 75,
      statusEffect: { kind: 'bleeding', turns: 2, value: 1 },
    },
    {
      id: 'wolf_lunge',
      displayName: 'Lunge',
      apCost: 1,
      minRangeTiles: 2,
      maxRangeTiles: 5,
      damage: 2,
      damageType: 'crush',
      hitChance: 65,
      telegraph: { pattern: 'target_plus_adjacent', warningDamageMultiplier: 0.5 },
      forcedMovement: { kind: 'push', distance: 1 },
      cooldownTurns: 2,
    },
  ],
};
