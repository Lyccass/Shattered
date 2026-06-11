import type { ItemDefinition } from '../ItemTypes';

export const CONSUMABLE_ITEMS: ItemDefinition[] = [
  {
    id: 'warm_tea',
    name: 'Warm Tea',
    examine: 'A simple hot drink brewed over a campfire. Restores spirits.',
    icon: '🫖',
    category: 'consumable',
    stackable: false,
    weight: 0.2,
    value: 5,
    consume: {
      effectId: 'warm_tea_warmth',
      message: 'You drink warm tea.',
      hpRestore: 2,
    },
  },
  {
    id: 'bread',
    name: 'Bread',
    examine: 'A dense loaf of bread. Fills the stomach and mends wounds.',
    icon: '🍞',
    category: 'consumable',
    stackable: false,
    weight: 0.3,
    value: 3,
    consume: {
      message: 'You eat bread.',
      hpRestore: 3,
    },
  },
  {
    id: 'health_potion',
    name: 'Health Potion',
    examine: 'A swirling red liquid. Rapidly restores health.',
    icon: '⚗️',
    category: 'consumable',
    stackable: false,
    weight: 0.2,
    value: 25,
    consume: {
      message: 'You drink a health potion.',
      hpRestore: 8,
    },
  },
];
