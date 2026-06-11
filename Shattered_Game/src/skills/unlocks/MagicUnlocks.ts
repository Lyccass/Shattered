import type { SkillUnlockEntry } from '../SkillUnlockTypes';

export const MAGIC_UNLOCKS: SkillUnlockEntry[] = [
  {
    skillId: 'magic',
    rankRequired: 1,
    stageRequired: 1,
    kind: 'combat_spell',
    refId: 'spell_spark',
    displayName: 'Spark',
    description: 'Combat spell slot option. Light ranged magic damage.',
  },
  {
    skillId: 'magic',
    rankRequired: 1,
    stageRequired: 1,
    kind: 'utility_spell',
    refId: 'utility_homeward_mark',
    displayName: 'Homeward Mark',
    description: 'Utility spell slot option. Mark a safe return point.',
  },
  {
    skillId: 'magic',
    rankRequired: 1,
    stageRequired: 5,
    kind: 'combat_spell',
    refId: 'spell_barrier',
    displayName: 'Barrier',
    description: 'Combat spell slot option. Fortify yourself for 2 turns.',
  },
  {
    skillId: 'magic',
    rankRequired: 1,
    stageRequired: 8,
    kind: 'utility_spell',
    refId: 'utility_waystep',
    displayName: 'Waystep',
    description: 'Utility spell slot option. Traversal support outside combat.',
  },
  {
    skillId: 'magic',
    rankRequired: 2,
    stageRequired: 5,
    kind: 'utility_spell',
    refId: 'utility_camp_recall',
    displayName: 'Camp Recall',
    description: 'Utility spell slot option. Return to a prepared camp.',
  },
];
