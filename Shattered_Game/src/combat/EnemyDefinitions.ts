import type { EnemyDefinition } from './EnemyTypes';
import { PLAYER_CONFIG } from '../player/PlayerConfig';

export const ENEMY_DEFINITIONS: EnemyDefinition[] = [
  {
    id: 'training_wretch',
    displayName: 'Training Wretch',
    maxHealth: 5,
    lootTable: [
      { itemId: 'wood',  minCount: 1, maxCount: 3, chance: 1.0 },
      { itemId: 'stone', minCount: 1, maxCount: 1, chance: 0.6 },
      { itemId: 'herb',  minCount: 1, maxCount: 1, chance: 0.3 },
    ],
    moveSpeed: PLAYER_CONFIG.movementSpeed * 0.42,
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
          windupMs: 900,
          activeMs: 220,
          recoveryMs: 1_100,
        },
        telegraph: {
          kind: 'rectangle',
          lengthTiles: 2.8,
          widthTiles: 1.6,
        },
        cooldownMs: 2_200,
        globalCooldownMs: 1_600,
      },
      {
        id: 'wretch_roar',
        displayName: 'Roar',
        kind: 'cone',
        minRangeTiles: 0,
        maxRangeTiles: 3.5,
        damage: 1,
        timing: {
          windupMs: 1_800,
          activeMs: 350,
          recoveryMs: 1_900,
        },
        telegraph: {
          kind: 'rectangle',
          lengthTiles: 3.5,
          widthTiles: 2.4,
        },
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
        timing: {
          windupMs: 1_400,
          activeMs: 280,
          recoveryMs: 1_600,
        },
        telegraph: {
          kind: 'circle',
          radiusTiles: 2.2,
        },
        cooldownMs: 7_000,
        globalCooldownMs: 5_500,
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
