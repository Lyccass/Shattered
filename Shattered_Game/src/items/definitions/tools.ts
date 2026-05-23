import type { ItemDefinition } from '../ItemTypes';

export const TOOL_ITEMS: ItemDefinition[] = [
  {
    id: 'firestarter_set',
    name: 'Firestarter Set',
    examine: 'A dry bundle of kindling tied for quick placement.',
    icon: '🔥',
    category: 'tool',
    stackable: false,
    weight: 0.4,
    value: 8,
    placementRules: {
      allowedSpaceTypes: ['personal_island', 'open_world'],
      mustBeWalkable: true,
      mustNotBeBlocked: true,
      durationMs: 45_000,
    },
    placementObjectDefinitionId: 'placed_firestarter_set',
  },
  {
    id: 'wooden_marker',
    name: 'Wooden Marker',
    examine: 'A simple carved marker for trails or camp notes.',
    icon: '📌',
    category: 'misc',
    stackable: false,
    weight: 0.1,
    value: 3,
  },
  {
    id: 'camp_supplies',
    name: 'Camp Supplies',
    examine: 'A bundled pack of rough camp essentials ready to hand off.',
    icon: '🎒',
    category: 'misc',
    stackable: false,
    weight: 1.2,
    value: 10,
  },
];
