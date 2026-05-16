import type { ItemDefinition } from './ItemTypes';

export const ITEM_DEFINITIONS: ItemDefinition[] = [
  {
    id: 'firestarter_set',
    displayName: 'Firestarter Set',
    description: 'A dry bundle of kindling tied for quick placement.',
    stackable: true,
    placeable: true,
    placementObjectDefinitionId: 'placed_firestarter_set',
  },
  {
    id: 'warm_tea',
    displayName: 'Warm Tea',
    description: 'A simple hot drink brewed over a campfire.',
    stackable: true,
    placeable: false,
  },
];
