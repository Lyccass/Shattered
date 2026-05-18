import type { EnemyDefinition } from './EnemyTypes';

export const ENEMY_DEFINITIONS: EnemyDefinition[] = [
  {
    id: 'training_wretch',
    displayName: 'Training Wretch',
    maxHealth: 5,
    moveSpeed: 64,
    collisionRadiusTiles: 0.65,
    aggroRangeTiles: 9.25,
    leashRangeTiles: 11,
    attacks: [
      {
        id: 'wretch_jump',
        displayName: 'Jump Attack',
        kind: 'jump',
        minRangeTiles: 3.25,
        maxRangeTiles: 8.75,
        damage: 2,
        timing: {
          windupMs: 650,
          activeMs: 180,
          recoveryMs: 620,
        },
        telegraph: {
          kind: 'ellipse',
          radiusXTiles: 2.75,
          radiusYTiles: 1.75,
        },
        cooldownMs: 2_000,
      },
      {
        id: 'wretch_cone',
        displayName: 'Cone Attack',
        kind: 'cone',
        minRangeTiles: 1.25,
        maxRangeTiles: 3.6,
        damage: 1,
        timing: {
          windupMs: 850,
          activeMs: 180,
          recoveryMs: 700,
        },
        telegraph: {
          kind: 'cone',
          rangeTiles: 3.6,
          angleDeg: 96,
        },
        cooldownMs: 1_450,
      },
      {
        id: 'wretch_stab',
        displayName: 'Stab Attack',
        kind: 'stab',
        minRangeTiles: 0,
        maxRangeTiles: 2.45,
        damage: 1,
        timing: {
          windupMs: 520,
          activeMs: 140,
          recoveryMs: 520,
        },
        telegraph: {
          kind: 'rectangle',
          widthTiles: 1,
          lengthTiles: 4.1,
        },
        cooldownMs: 1_100,
      },
    ],
  },
];
