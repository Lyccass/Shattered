import type { ContractDefinition } from './ContractTypes';

export const CONTRACT_DEFINITIONS: ContractDefinition[] = [
  {
    id: 'warmth_for_the_dockhands',
    displayName: 'Warmth for the Dockhands',
    description: 'The harbor crew wants something hot after long shifts on the wet planks.',
    requiredItems: {
      warm_tea: 1,
    },
    rewards: {
      copper: 55,
      harborReputation: 1,
      xpRewards: {
        trade: 10,
      },
    },
    repeatable: true,
    interactionType: 'contract_board',
    tags: ['harbor', 'tea', 'starter_contract'],
  },
  {
    id: 'camp_supplies',
    displayName: 'Camp Supplies',
    description: 'The dockhands will pay for ready-made field kits they can carry onto the planks.',
    requiredItems: {
      firestarter_set: 1,
    },
    rewards: {
      copper: 37,
      harborReputation: 1,
      xpRewards: {
        trade: 8,
      },
    },
    repeatable: true,
    interactionType: 'contract_board',
    tags: ['harbor', 'supplies', 'starter_contract'],
  },
  {
    id: 'clear_the_shores',
    displayName: 'Clear the Shores',
    description: 'The monsters are pressing closer to the harbour. Push them back. The warden is paying.',
    rewards: {
      copper: 120,
      harborReputation: 3,
      xpRewards: {
        melee: 40,
        defence: 20,
      },
    },
    repeatable: false,
    interactionType: 'contract_board',
    tags: ['harbor', 'combat', 'worldstate'],
    minWorldState: { monsterPressure: 30 },
  },
  {
    id: 'corruption_survey',
    displayName: 'Survey the Corruption',
    description: 'Something is spreading through the outer islands. Chart the affected areas and report back.',
    rewards: {
      copper: 85,
      harborReputation: 2,
      xpRewards: {
        trade: 15,
        melee: 10,
      },
    },
    repeatable: false,
    interactionType: 'contract_board',
    tags: ['harbor', 'exploration', 'worldstate'],
    minWorldState: { corruption: 20 },
  },
];
