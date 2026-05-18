import type { EnemyDefinition } from './EnemyTypes';

export const ENEMY_DEFINITIONS: EnemyDefinition[] = [
  {
    id: 'training_wretch',
    displayName: 'Training Wretch',
    maxHealth: 1,
    moveSpeed: 64,
    collisionRadiusTiles: 0.65,
    aggroRangeTiles: 5.25,
    leashRangeTiles: 7,
    attacks: [
      {
        id: 'wretch_jump',
        displayName: 'Jump Attack',
        kind: 'jump',
        minRangeTiles: 2.1,
        maxRangeTiles: 4.25,
        timing: {
          windupMs: 950,
          activeMs: 220,
          recoveryMs: 760,
        },
        telegraph: {
          kind: 'ellipse',
          radiusXTiles: 1.95,
          radiusYTiles: 1.25,
        },
        cooldownMs: 2_000,
      },
      {
        id: 'wretch_cone',
        displayName: 'Cone Attack',
        kind: 'cone',
        minRangeTiles: 1.25,
        maxRangeTiles: 2.9,
        timing: {
          windupMs: 850,
          activeMs: 180,
          recoveryMs: 700,
        },
        telegraph: {
          kind: 'cone',
          rangeTiles: 2.9,
          angleDeg: 72,
        },
        cooldownMs: 1_450,
      },
      {
        id: 'wretch_stab',
        displayName: 'Stab Attack',
        kind: 'stab',
        minRangeTiles: 0,
        maxRangeTiles: 2.1,
        timing: {
          windupMs: 520,
          activeMs: 140,
          recoveryMs: 520,
        },
        telegraph: {
          kind: 'rectangle',
          widthTiles: 1,
          lengthTiles: 2.8,
        },
        cooldownMs: 1_100,
      },
    ],
  },
];
