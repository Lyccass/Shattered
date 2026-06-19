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
        journalHint: 'Bring a firestarter set to Old Hermit. You can make one from a pine log and stone, buy one, or get one another way.',
        completedLog: 'I brought a firestarter set back to Old Hermit.',
        turnInNpcId: 'island_hermit',
        completeDialogue: 'Good. A mark that cannot be made by hand is not worth trusting in bad weather.',
        objectives: [
          {
            id: 'have_firestarter_set',
            kind: 'fetch',
            itemId: 'firestarter_set',
            count: 1,
            journalHint: 'Have one firestarter set in your inventory.',
            completedLog: 'I got hold of a firestarter set.',
          },
        ],
      },
      {
        id: 'settle_the_lesson',
        title: 'Settle the Lesson',
        journalHint: 'Settle the lesson with Old Hermit by offering your firestarter set or a few copper.',
        completedLog: 'I settled the lesson with Old Hermit and learned why small marks matter.',
        completeDialogue: 'A fair exchange. The Wake remembers people who leave useful signs behind them.',
        objectives: [
          {
            id: 'firestarter_or_copper',
            kind: 'any_of',
            journalHint: 'Find a fitting way to settle the lesson with Old Hermit.',
            completedLog: 'I settled the lesson one way or another.',
            options: [
              {
                id: 'bring_firestarter_set',
                kind: 'deliver_item_to',
                npcId: 'island_hermit',
                itemId: 'firestarter_set',
                count: 1,
                journalHint: 'Bring one firestarter set to Old Hermit.',
                completedLog: 'I gave Old Hermit the firestarter set I made.',
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
      xpRewards: { woodworking: 45, trade: 10 },
      unlocks: [
        { kind: 'activity', unlockId: 'harbor_waymarks', displayName: 'Harbor Waymarks' },
      ],
    },
    tags: ['template', 'osrs_style', 'tutorial'],
  },
];
