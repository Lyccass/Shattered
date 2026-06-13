import { describe, expect, it } from 'vitest';
import { computeDerivedStats } from './DerivedStatsCalculator';
import { EquipmentRegistry } from './EquipmentRegistry';
import type { ItemDefinition } from '../items/ItemTypes';

describe('computeDerivedStats combat HP scaling', () => {
  const registry = new EquipmentRegistry();

  it('starts level-1 combat characters at 10 HP', () => {
    const stats = computeDerivedStats({}, registry, {
      melee: 1,
      ranged: 1,
      magic: 1,
      devotion: 1,
    });

    expect(stats.combatLevel).toBe(1);
    expect(stats.maxHp).toBe(10);
  });

  it('caps max combat HP at 100', () => {
    const stats = computeDerivedStats({}, registry, {
      melee: 100,
      ranged: 100,
      magic: 100,
      devotion: 100,
    });

    expect(stats.combatLevel).toBe(100);
    expect(stats.maxHp).toBe(100);
  });

  it('uses fists when no weapon is equipped and scales max hit by melee rank', () => {
    const rankOne = computeDerivedStats({}, registry, {
      melee: 1,
      ranged: 1,
      magic: 1,
      devotion: 1,
    });
    const rankOneStageTen = computeDerivedStats({}, registry, {
      melee: 10,
      ranged: 1,
      magic: 1,
      devotion: 1,
    });
    const rankTen = computeDerivedStats({}, registry, {
      melee: 100,
      ranged: 1,
      magic: 1,
      devotion: 1,
    });

    expect(rankOne.weaponArchetype).toBe('fists');
    expect(rankOne.damageType).toBe('crush');
    expect(rankOne.attack).toBe(1);
    expect(rankOneStageTen.attack).toBe(1);
    expect(rankTen.attack).toBe(10);
  });

  it('adds weapon damage to the combat style rank for max hit', () => {
    const tungstenSword: ItemDefinition = {
      id: 'test_tungsten_sword',
      name: 'Test Tungsten Sword',
      examine: 'A weapon used by stat tests.',
      icon: '',
      category: 'equipment',
      stackable: false,
      weight: 1,
      value: 1,
      equipment: {
        slot: 'main_hand',
        requiredLevel: 1,
        weaponStats: {
          archetype: 'sword',
          attackShape: { kind: 'arc', angleDeg: 120, rangeTiles: 1.5 },
          damage: 11,
          damageType: 'slash',
          reachTiles: 1,
          staminaCost: 10,
          staggerImpact: 4,
          weight: 1,
          durability: 80,
          maxDurability: 100,
        },
      },
    };
    const swordRegistry: EquipmentRegistry = {
      has: (id: string) => id === tungstenSword.id,
      get: (id: string) => id === tungstenSword.id ? tungstenSword : undefined,
      getAll: () => [tungstenSword],
    };

    const stats = computeDerivedStats({ main_hand: tungstenSword.id }, swordRegistry, {
      melee: 100,
      ranged: 1,
      magic: 1,
      devotion: 1,
    });

    expect(stats.attack).toBe(20);
  });

  it('scales ranged weapon max hit by ranged rank instead of melee rank', () => {
    const bow: ItemDefinition = {
      id: 'test_copper_bow',
      name: 'Test Copper Bow',
      examine: 'A bow used by stat tests.',
      icon: '',
      category: 'equipment',
      stackable: false,
      weight: 1,
      value: 1,
      equipment: {
        slot: 'main_hand',
        requiredLevel: 1,
        weaponStats: {
          archetype: 'bow',
          attackShape: { kind: 'thrust', lengthTiles: 4, widthTiles: 1 },
          damage: 1,
          damageType: 'pierce',
          reachTiles: 4,
          staminaCost: 10,
          staggerImpact: 4,
          weight: 1,
          durability: 80,
          maxDurability: 100,
        },
      },
    };
    const bowRegistry: EquipmentRegistry = {
      has: (id: string) => id === bow.id,
      get: (id: string) => id === bow.id ? bow : undefined,
      getAll: () => [bow],
    };

    const stats = computeDerivedStats({ main_hand: bow.id }, bowRegistry, {
      melee: 1,
      ranged: 100,
      magic: 1,
      devotion: 1,
    });

    expect(stats.weaponArchetype).toBe('bow');
    expect(stats.attack).toBe(10);
    expect(stats.accuracy).toBe(108);  // bow archetype base accuracy plus ranged skill level
    expect(stats.combatStyleLevel).toBe(100); // ranged skill, not melee
    expect(stats.combatStyleRank).toBe(10);
  });
});
