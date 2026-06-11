import type { SkillUnlockEntry } from '../SkillUnlockTypes';

export const DEVOTION_UNLOCKS: SkillUnlockEntry[] = [
  {
    skillId: 'devotion',
    rankRequired: 1,
    stageRequired: 1,
    kind: 'devotion_ability',
    refId: 'devotion_mend',
    displayName: 'Mend',
    description: 'Devotion slot option. Restore a small amount of HP.',
  },
  {
    skillId: 'devotion',
    rankRequired: 1,
    stageRequired: 5,
    kind: 'devotion_ability',
    refId: 'devotion_ward',
    displayName: 'Ward',
    description: 'Devotion slot option. Protective buff for 2 turns.',
  },
];
