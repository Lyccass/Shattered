import type { SkillUnlockEntry } from '../SkillUnlockTypes';

export const METALWORKING_UNLOCKS: SkillUnlockEntry[] = [
  {
    skillId: 'metalworking', rankRequired: 1, stageRequired: 1,
    kind: 'resource_node', refId: 'stone_pile',
    displayName: 'Gather Stone',
    description: 'Break apart stone piles for raw stone.',
  },
  // Future: smelting, forging, mining ore nodes
];
