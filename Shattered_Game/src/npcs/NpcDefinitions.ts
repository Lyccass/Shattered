import type { NpcDefinition } from './NpcTypes';

export const NPC_DEFINITIONS: NpcDefinition[] = [
  {
    id: 'trader_maren',
    displayName: 'Trader Maren',
    color: 0xd4a96a,
    behavior: 'patrol',
    ambientLines: [
      'Looking for something?',
      'Fine goods, fair prices.',
      'Safe travels, friend.',
      'The sea brings many things.',
    ],
    dialogue: [
      {
        text: 'Welcome. I deal in supplies and curiosities. Trading is coming soon.',
      },
    ],
  },
];
