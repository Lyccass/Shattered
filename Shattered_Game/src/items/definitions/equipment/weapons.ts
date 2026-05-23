import { PLAYER_CONFIG } from '../../../player/PlayerConfig';
import type { ItemDefinition } from '../../ItemTypes';

// Attack speed and reach scale with weapon archetype, not material tier.
// Damage scales with tier (worn < iron < steel < mithril...).
// Each archetype has a distinct feel: swords are balanced, axes are fast/high stagger,
// hammers are slow/crushing, spears have reach, etc.

export const WEAPON_ITEMS: ItemDefinition[] = [
  {
    id: 'worn_shortsword',
    name: 'Worn Shortsword',
    examine: 'A battered blade, better than nothing.',
    icon: '🗡️',
    category: 'equipment',
    stackable: false,
    weight: 1.2,
    value: 5,
    equipment: {
      slot: 'main_hand',
      requiredLevel: 1,
      weaponStats: {
        damage: 2,
        damageType: 'slash',
        attackSpeedMs: 860,
        reachTiles: 1.0,
        staminaCost: 12,
        staggerImpact: 8,
        weight: 1.2,
        durability: 60,
        maxDurability: 100,
      },
    },
  },
  {
    id: 'iron_shortsword',
    name: 'Iron Shortsword',
    examine: 'A reliable blade for close quarters.',
    icon: '🗡️',
    category: 'equipment',
    stackable: false,
    weight: 1.5,
    value: 50,
    equipment: {
      slot: 'main_hand',
      requiredLevel: 5,
      weaponStats: {
        damage: 4,
        damageType: 'slash',
        attackSpeedMs: 860,
        reachTiles: 1.0,
        staminaCost: 12,
        staggerImpact: 10,
        weight: 1.5,
        durability: 100,
        maxDurability: 100,
      },
    },
  },
  {
    id: 'rusty_axe',
    name: 'Rusty Axe',
    examine: 'Heavy but brutal. Chips through armour.',
    icon: '🪓',
    category: 'equipment',
    stackable: false,
    weight: 2.0,
    value: 30,
    equipment: {
      slot: 'main_hand',
      requiredLevel: 3,
      weaponStats: {
        damage: 3,
        damageType: 'slash',
        attackSpeedMs: 760,
        reachTiles: 0.9,
        staminaCost: 14,
        staggerImpact: 14,
        weight: 2.0,
        durability: 70,
        maxDurability: 100,
      },
    },
  },
  {
    id: 'stone_hammer',
    name: 'Stone Hammer',
    examine: 'Slow and punishing. Crushes bone.',
    icon: '🔨',
    category: 'equipment',
    stackable: false,
    weight: 3.2,
    value: 20,
    equipment: {
      slot: 'main_hand',
      requiredLevel: 1,
      weaponStats: {
        damage: 5,
        damageType: 'crush',
        attackSpeedMs: 1100,
        reachTiles: 0.9,
        staminaCost: 18,
        staggerImpact: 22,
        weight: 3.2,
        durability: 80,
        maxDurability: 100,
      },
    },
  },
  {
    id: 'short_spear',
    name: 'Short Spear',
    examine: 'Longer reach, keeps enemies at distance.',
    icon: '🏹',
    category: 'equipment',
    stackable: false,
    weight: 1.8,
    value: 45,
    equipment: {
      slot: 'main_hand',
      requiredLevel: 4,
      weaponStats: {
        damage: 3,
        damageType: 'pierce',
        attackSpeedMs: 900,
        reachTiles: 1.5,
        staminaCost: 11,
        staggerImpact: 8,
        weight: 1.8,
        durability: 90,
        maxDurability: 100,
      },
    },
  },
];

// Suppress unused import warning — PLAYER_CONFIG kept for future weapon speed scaling
void PLAYER_CONFIG;
