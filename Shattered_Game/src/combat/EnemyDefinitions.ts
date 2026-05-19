import type { EnemyDefinition } from './EnemyTypes';
import { PLAYER_CONFIG } from '../player/PlayerConfig';

export const ENEMY_DEFINITIONS: EnemyDefinition[] = [
  {
    id: 'training_wretch',
    displayName: 'Training Wretch',
    maxHealth: 5,
    moveSpeed: PLAYER_CONFIG.movementSpeed,
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
          windupMs: 1_200,
          activeMs: 280,
          recoveryMs: 1_100,
        },
        telegraph: {
          kind: 'ellipse',
          radiusXTiles: 2.75,
          radiusYTiles: 1.75,
        },
        cooldownMs: 3_600,
        globalCooldownMs: 2_800,
      },
      {
        id: 'wretch_cone',
        displayName: 'Cone Attack',
        kind: 'cone',
        minRangeTiles: 1.25,
        maxRangeTiles: 3.6,
        damage: 1,
        timing: {
          windupMs: 1_450,
          activeMs: 280,
          recoveryMs: 1_200,
        },
        telegraph: {
          kind: 'cone',
          rangeTiles: 3.6,
          angleDeg: 96,
        },
        cooldownMs: 2_800,
        globalCooldownMs: 2_300,
      },
      {
        id: 'wretch_stab',
        displayName: 'Stab Attack',
        kind: 'stab',
        minRangeTiles: 0,
        maxRangeTiles: 2.45,
        damage: 1,
        timing: {
          windupMs: 900,
          activeMs: 220,
          recoveryMs: 900,
        },
        telegraph: {
          kind: 'rectangle',
          widthTiles: 1,
          lengthTiles: 4.1,
        },
        cooldownMs: 2_000,
        globalCooldownMs: 1_700,
      },
    ],
  },
];
