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
    },
  },
];
