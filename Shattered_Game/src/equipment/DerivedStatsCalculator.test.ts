import { describe, expect, it } from 'vitest';
import { computeDerivedStats } from './DerivedStatsCalculator';
import { EquipmentRegistry } from './EquipmentRegistry';

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
    const rankTen = computeDerivedStats({}, registry, {
      melee: 100,
      ranged: 1,
      magic: 1,
      devotion: 1,
    });

    expect(rankOne.weaponArchetype).toBe('fists');
    expect(rankOne.damageType).toBe('crush');
    expect(rankOne.attack).toBe(1);
    expect(rankTen.attack).toBe(10);
  });
});
