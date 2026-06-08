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
      hitChance: 75,
    },
    {
      id: 'wolf_lunge',
      displayName: 'Lunge',
      apCost: 1,
      minRangeTiles: 0,
      maxRangeTiles: 2,
      damage: 2,
      hitChance: 65,
      cooldownTurns: 2,
    },
  ],
};
