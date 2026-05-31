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
      { text: 'Welcome. Browse my wares — good stock, fair prices.' },
    ],
    options: [
      {
        id: 'shop',
        label: 'Show me your wares.',
        outcome: { kind: 'shop', shopId: 'maren_general' },
      },
      {
        id: 'contracts',
        label: 'Any work going?',
        outcome: { kind: 'contract_board', boardId: 'harbor_contract_board_01' },
      },
      {
        id: 'ask_place',
        label: "What is this place?",
        outcome: {
          kind: 'reply',
          npcText: 'Harbour Cove — crossroads of the archipelago. Everything passes through here eventually.',
        },
      },
      {
        id: 'bye',
        label: 'Farewell.',
        outcome: { kind: 'close' },
      },
    ],
  },
  {
    id: 'harbor_warden',
    displayName: 'Harbour Warden',
    color: 0x7090b0,
    behavior: 'stationary',
    ambientLines: [
      'Keep the docks clear.',
      'No trouble here.',
      'Move along.',
    ],
    dialogue: [
      { text: "State your business." },
    ],
    options: [
      {
        id: 'contracts',
        label: 'Any work for me?',
        outcome: { kind: 'contract_board', boardId: 'harbor_contract_board_01' },
      },
      {
        id: 'ask_danger',
        label: 'Is it safe out there?',
        outcome: {
          kind: 'reply',
          npcText: 'The outer islands are rough. Stick to known routes and you\'ll be fine. Probably.',
        },
      },
      {
        id: 'bye',
        label: 'Never mind.',
        outcome: { kind: 'close' },
      },
    ],
  },
  {
    id: 'island_hermit',
    displayName: 'Old Hermit',
    color: 0x8b7355,
    behavior: 'stationary',
    ambientLines: [
      'The gods left us gifts and curses alike.',
      'Hmm...',
      'These islands hold secrets.',
    ],
    dialogue: [
      { text: 'You have that look — someone new to the Wake.' },
    ],
    options: [
      {
        id: 'ask_wake',
        label: 'What is the Wake?',
        outcome: {
          kind: 'reply',
          npcText: 'The archipelago. Gods died here long ago. Their remains became the islands. Every rock, reef, and forest — once alive.',
        },
      },
      {
        id: 'ask_island',
        label: 'Tell me about my island.',
        outcome: {
          kind: 'reply',
          npcText: 'Yours is young — unclaimed land. Rare. Shape it carefully. What you build there will outlast you.',
        },
      },
      {
        id: 'bye',
        label: 'I\'ll leave you in peace.',
        outcome: { kind: 'close' },
      },
    ],
  },
];
