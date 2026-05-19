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
        id: 'wretch_swipe',
        displayName: 'Swipe',
        kind: 'stab',
        minRangeTiles: 0,
        maxRangeTiles: 2.8,
        damage: 1,
        timing: {
          windupMs: 800,
          activeMs: 220,
          recoveryMs: 700,
        },
        telegraph: {
          kind: 'cone',
          rangeTiles: 2.8,
          angleDeg: 115,
        },
        cooldownMs: 1_400,
        globalCooldownMs: 1_000,
      },
      {
        id: 'wretch_roar',
        displayName: 'Roar',
        kind: 'cone',
        minRangeTiles: 0,
        maxRangeTiles: 3.5,
        damage: 1,
        timing: {
          windupMs: 1_600,
          activeMs: 350,
          recoveryMs: 1_400,
        },
        telegraph: {
          kind: 'cone',
          rangeTiles: 3.5,
          angleDeg: 125,
        },
        cooldownMs: 5_500,
        globalCooldownMs: 3_800,
        knockback: { forceTiles: 3.5 },
      },
      {
        id: 'wretch_jump',
        displayName: 'Leap',
        kind: 'jump',
        minRangeTiles: 4.5,
        maxRangeTiles: 9.5,
        damage: 2,
        timing: {
          windupMs: 1_200,
          activeMs: 280,
          recoveryMs: 1_200,
        },
        telegraph: {
          kind: 'circle',
          radiusTiles: 2.2,
        },
        cooldownMs: 5_500,
        globalCooldownMs: 4_200,
      },
    ],
  },
];

for (const def of ENEMY_DEFINITIONS) {
  for (const atk of def.attacks) {
    if (!(atk.cooldownMs > 0)) {
      throw new Error(`[EnemyDefinitions] ${def.id}.${atk.id}: cooldownMs must be > 0 (got ${atk.cooldownMs})`);
    }

    if (!(atk.globalCooldownMs > 0)) {
      throw new Error(`[EnemyDefinitions] ${def.id}.${atk.id}: globalCooldownMs must be > 0 (got ${atk.globalCooldownMs})`);
    }

    if (!(atk.timing.windupMs > 0 && atk.timing.activeMs > 0 && atk.timing.recoveryMs > 0)) {
      throw new Error(`[EnemyDefinitions] ${def.id}.${atk.id}: all timing values must be > 0`);
    }
  }
}
