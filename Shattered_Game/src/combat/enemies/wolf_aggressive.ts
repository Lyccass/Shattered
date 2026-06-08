import { PLAYER_CONFIG } from '../../player/PlayerConfig';
import type { EnemyDefinition } from '../EnemyTypes';

export const WOLF_AGGRESSIVE: EnemyDefinition = {
  id: 'wolf_aggressive',
  displayName: 'Wolf',
  tier: 1,
  maxHealth: 5,
  initiative: 6,
  mpPerTurn: 3,
  apPerTurn: 1,
  defense: 0,
  behavior: 'aggressive',
  moveSpeed: PLAYER_CONFIG.movementSpeed * 0.70,
  collisionRadiusTiles: 0.55,
  aggroRangeTiles: 8,
  leashRangeTiles: 14,
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
      hitChance: 80,
    },
    {
      id: 'wolf_roar',
      displayName: 'Roar',
      apCost: 1,
      minRangeTiles: 0,
      maxRangeTiles: 2,
      damage: 1,
      hitChance: 90,
      statusEffect: { kind: 'slowed', turns: 2, value: 1 },
      cooldownTurns: 3,
    },
  ],
};
