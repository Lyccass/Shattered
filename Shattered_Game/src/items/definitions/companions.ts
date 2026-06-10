import type { ItemDefinition } from '../ItemTypes';

export const STARTING_COMPANION_IDS: Record<string, number> = {
  companion_wolf: 1,
};

export const COMPANION_ITEMS: ItemDefinition[] = [
  {
    id: 'companion_wolf',
    name: 'Wolf',
    examine: 'A tamed wolf. Fights by your side and can jump at distant targets.',
    icon: '🐺',
    category: 'misc',
    stackable: false,
    weight: 0,
    value: 0,
    companionId: 'wolf',
  },
  {
    id: 'companion_bronze_golem',
    name: 'Bronze Golem',
    examine: 'A small bronze automaton. Slow but hard to put down.',
    icon: '🪨',
    category: 'misc',
    stackable: false,
    weight: 0,
    value: 0,
    companionId: 'bronze_golem',
  },
  {
    id: 'companion_imp',
    name: 'Imp',
    examine: 'A mischievous imp. Fast, ranged, and causes bleeding.',
    icon: '👹',
    category: 'misc',
    stackable: false,
    weight: 0,
    value: 0,
    companionId: 'imp',
  },
];
