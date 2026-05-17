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
      copper: 5,
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
      copper: 3,
      harborReputation: 1,
      xpRewards: {
        trade: 8,
      },
    },
    repeatable: true,
    interactionType: 'contract_board',
    tags: ['harbor', 'supplies', 'starter_contract'],
  },
];
