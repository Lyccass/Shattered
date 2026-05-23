import type { ItemDefinition } from '../../ItemTypes';

// Armour tradeoffs:
//   Leather  — light, high dodge bonus, low physical defence
//   Chain    — medium, balanced
//   Plate    — heavy, high physical defence, low dodge

export const ARMOR_ITEMS: ItemDefinition[] = [
  // ── Off-hand ─────────────────────────────────────────────────────────────
  {
    id: 'wooden_round_shield',
    name: 'Wooden Round Shield',
    examine: 'Light protection, helps dodge and block.',
    icon: '🛡️',
    category: 'equipment',
    stackable: false,
    weight: 1.5,
    value: 20,
    equipment: {
      slot: 'off_hand',
      requiredLevel: 1,
      armorStats: {
        physicalDefence: 1,
        dodgeBonus: 8,
        typeDefence: { slash: 2, pierce: 1, crush: 0 },
        elementalResistance: { poison: 0, fire: 0, cold: 0 },
        poise: 3,
        weight: 1.5,
        durability: 80,
        maxDurability: 100,
      },
    },
  },

  // ── Head ─────────────────────────────────────────────────────────────────
  {
    id: 'leather_cap',
    name: 'Leather Cap',
    examine: 'Supple hide. Light and mobile.',
    icon: '🧢',
    category: 'equipment',
    stackable: false,
    weight: 0.4,
    value: 15,
    equipment: {
      slot: 'head',
      requiredLevel: 1,
      armorStats: {
        physicalDefence: 1,
        dodgeBonus: 4,
        typeDefence: { slash: 1, pierce: 1, crush: 0 },
        elementalResistance: { poison: 1, fire: 0, cold: 1 },
        poise: 0,
        weight: 0.4,
        durability: 80,
        maxDurability: 100,
      },
    },
  },

  // ── Body ─────────────────────────────────────────────────────────────────
  {
    id: 'leather_vest',
    name: 'Leather Vest',
    examine: 'Core protection without slowing you down.',
    icon: '🧥',
    category: 'equipment',
    stackable: false,
    weight: 1.5,
    value: 35,
    equipment: {
      slot: 'body',
      requiredLevel: 1,
      armorStats: {
        physicalDefence: 3,
        dodgeBonus: 0,
        typeDefence: { slash: 2, pierce: 2, crush: 1 },
        elementalResistance: { poison: 1, fire: 0, cold: 2 },
        poise: 2,
        weight: 1.5,
        durability: 100,
        maxDurability: 100,
      },
    },
  },

  // ── Legs ─────────────────────────────────────────────────────────────────
  {
    id: 'leather_pants',
    name: 'Leather Pants',
    examine: 'Keeps you moving. Modest protection.',
    icon: '👖',
    category: 'equipment',
    stackable: false,
    weight: 0.9,
    value: 25,
    equipment: {
      slot: 'legs',
      requiredLevel: 1,
      armorStats: {
        physicalDefence: 2,
        dodgeBonus: 2,
        typeDefence: { slash: 1, pierce: 1, crush: 0 },
        elementalResistance: { poison: 0, fire: 0, cold: 1 },
        poise: 1,
        weight: 0.9,
        durability: 100,
        maxDurability: 100,
      },
    },
  },

  // ── Feet ─────────────────────────────────────────────────────────────────
  {
    id: 'leather_boots',
    name: 'Leather Boots',
    examine: 'Soft soles. Quiet steps.',
    icon: '👢',
    category: 'equipment',
    stackable: false,
    weight: 0.5,
    value: 18,
    equipment: {
      slot: 'feet',
      requiredLevel: 1,
      armorStats: {
        physicalDefence: 1,
        dodgeBonus: 4,
        typeDefence: { slash: 0, pierce: 1, crush: 0 },
        elementalResistance: { poison: 0, fire: 0, cold: 2 },
        poise: 0,
        weight: 0.5,
        durability: 100,
        maxDurability: 100,
      },
    },
  },

  // ── Gloves ───────────────────────────────────────────────────────────────
  {
    id: 'leather_gloves',
    name: 'Leather Gloves',
    examine: 'A firm grip for weapon handling.',
    icon: '🧤',
    category: 'equipment',
    stackable: false,
    weight: 0.3,
    value: 12,
    equipment: {
      slot: 'gloves',
      requiredLevel: 1,
      armorStats: {
        physicalDefence: 1,
        dodgeBonus: 3,
        typeDefence: { slash: 0, pierce: 0, crush: 0 },
        elementalResistance: { poison: 0, fire: 0, cold: 1 },
        poise: 0,
        weight: 0.3,
        durability: 100,
        maxDurability: 100,
      },
    },
  },

  // ── Back ─────────────────────────────────────────────────────────────────
  {
    id: 'hunters_cloak',
    name: "Hunter's Cloak",
    examine: 'Blends into shadow. Light elemental resistance.',
    icon: '🧣',
    category: 'equipment',
    stackable: false,
    weight: 0.6,
    value: 28,
    equipment: {
      slot: 'back',
      requiredLevel: 3,
      armorStats: {
        physicalDefence: 1,
        dodgeBonus: 5,
        typeDefence: { slash: 0, pierce: 0, crush: 0 },
        elementalResistance: { poison: 2, fire: 0, cold: 3 },
        poise: 0,
        weight: 0.6,
        durability: 80,
        maxDurability: 100,
      },
    },
  },
];
