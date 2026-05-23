import type { ItemDefinition } from '../../ItemTypes';

export const ACCESSORY_ITEMS: ItemDefinition[] = [
  {
    id: 'iron_ring',
    name: 'Iron Ring',
    examine: 'Adds steadiness under pressure.',
    icon: '💍',
    category: 'equipment',
    stackable: false,
    weight: 0.05,
    value: 40,
    equipment: {
      slot: 'ring',
      requiredLevel: 1,
      armorStats: {
        physicalDefence: 0,
        dodgeBonus: 0,
        typeDefence: { slash: 0, pierce: 0, crush: 0 },
        elementalResistance: { poison: 0, fire: 0, cold: 0 },
        poise: 3,
        weight: 0.05,
        durability: 200,
        maxDurability: 200,
      },
    },
  },
];
