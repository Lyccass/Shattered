import type { EnemyDefinition } from './EnemyTypes';

export const ENEMY_DEFINITIONS: EnemyDefinition[] = [
  {
    id: 'training_wretch',
    displayName: 'Training Wretch',
    maxHealth: 1,
    moveSpeed: 64,
    collisionRadiusTiles: 0.65,
    attackRangeTiles: 2.3,
    aggroRangeTiles: 4.5,
    leashRangeTiles: 7,
    attackTiming: {
      windupMs: 900,
      activeMs: 180,
      recoveryMs: 700,
    },
    telegraphShape: {
      kind: 'circle',
      radiusTiles: 2.3,
    },
    attackCooldownMs: 900,
  },
];
