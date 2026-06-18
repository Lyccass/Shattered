import type { QuestDefinition } from './QuestTypes';

export const QUEST_DEFINITIONS: QuestDefinition[] = [
  {
    id: 'the_first_mark',
    displayName: 'The First Mark',
    description: 'Old Hermit teaches a practical field rite for marking safe paths through the Wake.',
    start: {
      npcId: 'island_hermit',
      dialogue: 'The Hermit points to the shore and asks you to make a small working mark from what the island gives.',
    },
    phases: [
      {
        id: 'make_a_spark',
        title: 'Make a Spark',
        journalHint: 'Use driftwood on stone to make a firestarter set, then return to Old Hermit.',
        completedLog: 'I struck driftwood against stone and made a firestarter set for the first mark.',
        turnInNpcId: 'island_hermit',
        completeDialogue: 'Good. A mark that cannot be made by hand is not worth trusting in bad weather.',
        objectives: [
          {
            id: 'combine_wood_and_stone',
            kind: 'use_item_on',
            itemId: 'wood',
            target: { kind: 'item', itemId: 'stone' },
            journalHint: 'Use driftwood on stone to make a firestarter set.',
            completedLog: 'I made a firestarter set by hand.',
          },
        ],
      },
      {
        id: 'settle_the_lesson',
        title: 'Settle the Lesson',
        journalHint: 'Settle the lesson with Old Hermit when you have something fitting to offer.',
        completedLog: 'I settled the lesson with Old Hermit and learned why small marks matter.',
        completeDialogue: 'A fair exchange. The Wake remembers people who leave useful signs behind them.',
        objectives: [
          {
            id: 'tea_or_copper',
            kind: 'any_of',
            journalHint: 'Find a fitting way to settle the lesson with Old Hermit.',
            completedLog: 'I settled the lesson one way or another.',
            options: [
              {
                id: 'bring_warm_tea',
                kind: 'deliver_item_to',
                npcId: 'island_hermit',
                itemId: 'warm_tea',
                count: 1,
                journalHint: 'Bring one warm tea to Old Hermit.',
                completedLog: 'I brought Old Hermit warm tea.',
              },
              {
                id: 'pay_small_offering',
                kind: 'pay_currency_to',
                npcId: 'island_hermit',
                copper: 10,
                journalHint: 'Offer 10 copper to Old Hermit.',
                completedLog: 'I offered Old Hermit 10 copper.',
              },
            ],
          },
        ],
      },
    ],
    rewards: {
      copper: 20,
      harborReputation: 1,
      itemDelta: { wooden_marker: 1 },
      xpRewards: { woodworking: 45, alchemy: 15, trade: 10 },
      unlocks: [
        { kind: 'activity', unlockId: 'harbor_waymarks', displayName: 'Harbor Waymarks' },
      ],
    },
    tags: ['template', 'osrs_style', 'tutorial'],
  },
];
