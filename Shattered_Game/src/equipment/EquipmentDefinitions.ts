import type { EquipmentDefinition } from './EquipmentTypes';

export const EQUIPMENT_DEFINITIONS: EquipmentDefinition[] = [
  // ── Weapons ────────────────────────────────────────────────────
  {
    id: 'worn_shortsword',
    displayName: 'Worn Shortsword',
    description: 'A battered blade, better than nothing.',
    slot: 'main_hand',
    requiredLevel: 1,
    weaponStats: {
      damage: 2, damageType: 'slash',
      attackSpeedMs: 860, reachTiles: 1.0, staminaCost: 12,
      staggerImpact: 8, weight: 1.2, durability: 60, maxDurability: 100,
    },
  },
  {
    id: 'iron_shortsword',
    displayName: 'Iron Shortsword',
    description: 'A reliable blade for close quarters.',
    slot: 'main_hand',
    requiredLevel: 5,
    weaponStats: {
      damage: 4, damageType: 'slash',
      attackSpeedMs: 860, reachTiles: 1.0, staminaCost: 12,
      staggerImpact: 10, weight: 1.5, durability: 100, maxDurability: 100,
    },
  },
  {
    id: 'rusty_axe',
    displayName: 'Rusty Axe',
    description: 'Heavy but brutal. Chips through armour.',
    slot: 'main_hand',
    requiredLevel: 3,
    weaponStats: {
      damage: 3, damageType: 'slash',
      attackSpeedMs: 760, reachTiles: 0.9, staminaCost: 14,
      staggerImpact: 14, weight: 2.0, durability: 70, maxDurability: 100,
    },
  },
  {
    id: 'stone_hammer',
    displayName: 'Stone Hammer',
    description: 'Slow and punishing. Crushes bone.',
    slot: 'main_hand',
    requiredLevel: 1,
    weaponStats: {
      damage: 5, damageType: 'crush',
      attackSpeedMs: 1100, reachTiles: 0.9, staminaCost: 18,
      staggerImpact: 22, weight: 3.2, durability: 80, maxDurability: 100,
    },
  },
  {
    id: 'short_spear',
    displayName: 'Short Spear',
    description: 'Longer reach, keeps enemies at distance.',
    slot: 'main_hand',
    requiredLevel: 4,
    weaponStats: {
      damage: 3, damageType: 'pierce',
      attackSpeedMs: 900, reachTiles: 1.5, staminaCost: 11,
      staggerImpact: 8, weight: 1.8, durability: 90, maxDurability: 100,
    },
  },

  // ── Off-hand ───────────────────────────────────────────────────
  {
    id: 'wooden_round_shield',
    displayName: 'Wooden Round Shield',
    description: 'Light protection, helps dodge and block.',
    slot: 'off_hand',
    requiredLevel: 1,
    armorStats: {
      physicalDefence: 1, dodgeBonus: 8,
      typeDefence: { slash: 2, pierce: 1, crush: 0 },
      elementalResistance: { poison: 0, fire: 0, cold: 0 },
      poise: 3, weight: 1.5, durability: 80, maxDurability: 100,
    },
  },

  // ── Head ───────────────────────────────────────────────────────
  {
    id: 'leather_cap',
    displayName: 'Leather Cap',
    description: 'Supple hide. Light and mobile.',
    slot: 'head',
    requiredLevel: 1,
    armorStats: {
      physicalDefence: 1, dodgeBonus: 4,
      typeDefence: { slash: 1, pierce: 1, crush: 0 },
      elementalResistance: { poison: 1, fire: 0, cold: 1 },
      poise: 0, weight: 0.4, durability: 80, maxDurability: 100,
    },
  },

  // ── Body ───────────────────────────────────────────────────────
  {
    id: 'leather_vest',
    displayName: 'Leather Vest',
    description: 'Core protection without slowing you down.',
    slot: 'body',
    requiredLevel: 1,
    armorStats: {
      physicalDefence: 3, dodgeBonus: 0,
      typeDefence: { slash: 2, pierce: 2, crush: 1 },
      elementalResistance: { poison: 1, fire: 0, cold: 2 },
      poise: 2, weight: 1.5, durability: 100, maxDurability: 100,
    },
  },

  // ── Legs ───────────────────────────────────────────────────────
  {
    id: 'leather_pants',
    displayName: 'Leather Pants',
    description: 'Keeps you moving. Modest protection.',
    slot: 'legs',
    requiredLevel: 1,
    armorStats: {
      physicalDefence: 2, dodgeBonus: 2,
      typeDefence: { slash: 1, pierce: 1, crush: 0 },
      elementalResistance: { poison: 0, fire: 0, cold: 1 },
      poise: 1, weight: 0.9, durability: 100, maxDurability: 100,
    },
  },

  // ── Feet ───────────────────────────────────────────────────────
  {
    id: 'leather_boots',
    displayName: 'Leather Boots',
    description: 'Soft soles. Quiet steps.',
    slot: 'feet',
    requiredLevel: 1,
    armorStats: {
      physicalDefence: 1, dodgeBonus: 4,
      typeDefence: { slash: 0, pierce: 1, crush: 0 },
      elementalResistance: { poison: 0, fire: 0, cold: 2 },
      poise: 0, weight: 0.5, durability: 100, maxDurability: 100,
    },
  },

  // ── Gloves ────────────────────────────────────────────────────
  {
    id: 'leather_gloves',
    displayName: 'Leather Gloves',
    description: 'A firm grip for weapon handling.',
    slot: 'gloves',
    requiredLevel: 1,
    armorStats: {
      physicalDefence: 1, dodgeBonus: 3,
      typeDefence: { slash: 0, pierce: 0, crush: 0 },
      elementalResistance: { poison: 0, fire: 0, cold: 1 },
      poise: 0, weight: 0.3, durability: 100, maxDurability: 100,
    },
  },

  // ── Back ──────────────────────────────────────────────────────
  {
    id: 'hunters_cloak',
    displayName: "Hunter's Cloak",
    description: 'Blends into shadow. Light resistance.',
    slot: 'back',
    requiredLevel: 3,
    armorStats: {
      physicalDefence: 1, dodgeBonus: 5,
      typeDefence: { slash: 0, pierce: 0, crush: 0 },
      elementalResistance: { poison: 2, fire: 0, cold: 3 },
      poise: 0, weight: 0.6, durability: 80, maxDurability: 100,
    },
  },

  // ── Ring ──────────────────────────────────────────────────────
  {
    id: 'iron_ring',
    displayName: 'Iron Ring',
    description: 'Adds steadiness under pressure.',
    slot: 'ring',
    requiredLevel: 1,
    armorStats: {
      physicalDefence: 0, dodgeBonus: 0,
      typeDefence: { slash: 0, pierce: 0, crush: 0 },
      elementalResistance: { poison: 0, fire: 0, cold: 0 },
      poise: 3, weight: 0.05, durability: 200, maxDurability: 200,
    },
  },
];
