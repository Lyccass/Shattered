import type { EnemyDefinition } from './EnemyTypes';
import { PLAYER_CONFIG } from '../player/PlayerConfig';

export const ENEMY_DEFINITIONS: EnemyDefinition[] = [
  {
    id: 'training_wretch',
    displayName: 'Training Wretch',
    tier: 1,
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
    deAggroRangeTiles: 18,
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
  {
    id: 'wolf_aggressive',
    displayName: 'Wolf',
    tier: 1,
    maxHealth: 5,
    behavior: 'aggressive',
    moveSpeed: PLAYER_CONFIG.movementSpeed * 0.65,
    collisionRadiusTiles: 0.55,
    aggroRangeTiles: 5,
    leashRangeTiles: 10,
    deAggroRangeTiles: 15,
    lootTable: [
      { itemId: 'wood', minCount: 1, maxCount: 1, chance: 0.4 },
    ],
    attacks: [
      {
        id: 'wolf_bite',
        displayName: 'Bite',
        kind: 'stab',
        minRangeTiles: 0,
        maxRangeTiles: 1.8,
        damage: 1,
        timing: { windupMs: 600, activeMs: 160, recoveryMs: 900 },
        telegraph: { kind: 'rectangle', lengthTiles: 1.8, widthTiles: 1.2 },
        cooldownMs: 2_000,
        globalCooldownMs: 1_400,
      },
      {
        id: 'wolf_lunge',
        displayName: 'Lunge',
        kind: 'jump',
        minRangeTiles: 3,
        maxRangeTiles: 6,
        damage: 1,
        timing: { windupMs: 1_000, activeMs: 200, recoveryMs: 1_200 },
        telegraph: { kind: 'circle', radiusTiles: 1.4 },
        cooldownMs: 5_000,
        globalCooldownMs: 4_000,
      },
    ],
  },
  {
    id: 'wolf_passive',
    displayName: 'Wolf',
    tier: 1,
    maxHealth: 5,
    behavior: 'passive',
    moveSpeed: PLAYER_CONFIG.movementSpeed * 0.65,
    collisionRadiusTiles: 0.55,
    aggroRangeTiles: 0,
    leashRangeTiles: 10,
    deAggroRangeTiles: 15,
    lootTable: [
      { itemId: 'wood', minCount: 1, maxCount: 1, chance: 0.4 },
    ],
    attacks: [
      {
        id: 'wolf_passive_bite',
        displayName: 'Bite',
        kind: 'stab',
        minRangeTiles: 0,
        maxRangeTiles: 1.8,
        damage: 1,
        timing: { windupMs: 600, activeMs: 160, recoveryMs: 900 },
        telegraph: { kind: 'rectangle', lengthTiles: 1.8, widthTiles: 1.2 },
        cooldownMs: 2_000,
        globalCooldownMs: 1_400,
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
