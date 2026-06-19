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
    dialogueTree: {
      startNodeId: 'intro',
      nodes: {
        intro: {
          npcText: 'Welcome. Browse my wares - good stock, fair prices.',
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
              label: 'What is this place?',
              nextNodeId: 'explain_place',
            },
            {
              id: 'bye',
              label: 'Fair winds.',
              end: true,
            },
          ],
        },
        explain_place: {
          npcText: 'Harbour Cove is the crossing point. Salvagers come in from the outer islands, builders come looking for nails, and everyone pretends the sea is predictable.',
          options: [
            {
              id: 'ask_work_after_place',
              label: 'What sort of work passes through?',
              outcome: { kind: 'contract_board', boardId: 'harbor_contract_board_01' },
            },
            {
              id: 'back',
              label: 'I wanted something else.',
              nextNodeId: 'intro',
            },
            {
              id: 'bye',
              label: 'I should get moving.',
              end: true,
            },
          ],
        },
      },
    },
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
    dialogueTree: {
      startNodeId: 'intro',
      nodes: {
        intro: {
          npcText: 'You have that look - someone new to the Wake.',
          options: [
            {
              id: 'ask_wake',
              label: 'What is the Wake?',
              nextNodeId: 'explain_wake',
            },
            {
              id: 'ask_island',
              label: 'Tell me about my island.',
              nextNodeId: 'explain_island',
            },
            {
              id: 'first_mark_intro',
              label: 'What mark are you carving?',
              conditions: [{ kind: 'quest_state', questId: 'the_first_mark', state: 'not_started' }],
              unavailableMode: 'hidden',
              nextNodeId: 'first_mark_offer',
            },
            {
              id: 'first_mark_make_spark',
              label: 'About the first mark...',
              conditions: [{ kind: 'quest_phase', questId: 'the_first_mark', phaseId: 'make_a_spark' }],
              unavailableMode: 'hidden',
              questAction: { kind: 'continue_quest', questId: 'the_first_mark' },
              end: true,
            },
            {
              id: 'first_mark_brought_tea',
              label: 'I brought something warm.',
              conditions: [
                { kind: 'quest_phase', questId: 'the_first_mark', phaseId: 'settle_the_lesson' },
                { kind: 'item_owned', itemId: 'warm_tea' },
              ],
              unavailableMode: 'hidden',
              questAction: {
                kind: 'continue_quest',
                questId: 'the_first_mark',
                objectiveId: 'bring_warm_tea',
              },
              end: true,
            },
            {
              id: 'first_mark_small_offering',
              label: 'I can make a small offering.',
              conditions: [
                { kind: 'quest_phase', questId: 'the_first_mark', phaseId: 'settle_the_lesson' },
                { kind: 'currency', copper: 10 },
              ],
              unavailableMode: 'hidden',
              questAction: {
                kind: 'continue_quest',
                questId: 'the_first_mark',
                objectiveId: 'pay_small_offering',
              },
              end: true,
            },
            {
              id: 'first_mark_done',
              label: 'How is the first mark holding?',
              conditions: [{ kind: 'quest_state', questId: 'the_first_mark', state: 'completed' }],
              unavailableMode: 'hidden',
              nextNodeId: 'first_mark_after',
            },
            {
              id: 'bye',
              label: 'I\'ll leave you in peace.',
              end: true,
            },
          ],
        },
        explain_wake: {
          npcText: 'The archipelago. Gods died here long ago. Their remains became the islands. Every rock, reef, and forest - once alive.',
          options: [
            {
              id: 'ask_mark_from_wake',
              label: 'And the marks?',
              conditions: [{ kind: 'quest_state', questId: 'the_first_mark', state: 'not_started' }],
              unavailableMode: 'hidden',
              nextNodeId: 'first_mark_offer',
            },
            {
              id: 'back',
              label: 'I had another question.',
              nextNodeId: 'intro',
            },
            {
              id: 'bye',
              label: 'That is enough for now.',
              end: true,
            },
          ],
        },
        explain_island: {
          npcText: 'Yours is young - unclaimed land. Rare. Shape it carefully. What you build there will outlast you.',
          options: [
            {
              id: 'ask_practical_lesson',
              label: 'Teach me something practical.',
              conditions: [{ kind: 'quest_state', questId: 'the_first_mark', state: 'not_started' }],
              unavailableMode: 'hidden',
              nextNodeId: 'first_mark_offer',
            },
            {
              id: 'back',
              label: 'I had another question.',
              nextNodeId: 'intro',
            },
            {
              id: 'bye',
              label: 'I will remember that.',
              end: true,
            },
          ],
        },
        first_mark_offer: {
          npcText: 'A mark is not a monument. It is proof that someone passed through and wanted the next soul to fare better.',
          options: [
            {
              id: 'ask_materials',
              label: 'What do I need?',
              nextNodeId: 'first_mark_materials',
            },
            {
              id: 'start_direct',
              label: 'I can help.',
              questAction: { kind: 'start_quest', questId: 'the_first_mark' },
              end: true,
            },
            {
              id: 'not_now',
              label: 'Not right now.',
              end: true,
            },
          ],
        },
        first_mark_materials: {
          npcText: 'Driftwood. Stone. A little patience. Strike one against the other and bring the spark back to me.',
          options: [
            {
              id: 'start_after_materials',
              label: 'I will make the firestarter.',
              questAction: { kind: 'start_quest', questId: 'the_first_mark' },
              end: true,
            },
            {
              id: 'back',
              label: 'Let me ask something else first.',
              nextNodeId: 'intro',
            },
            {
              id: 'bye',
              label: 'I will gather what I need.',
              end: true,
            },
          ],
        },
        first_mark_after: {
          npcText: 'Still there, if the rain has manners. If not, make another. Useful things should be repeatable.',
          options: [
            {
              id: 'back',
              label: 'I had another question.',
              nextNodeId: 'intro',
            },
            {
              id: 'bye',
              label: 'Safe paths, then.',
              end: true,
            },
          ],
        },
      },
    },
  },
];
