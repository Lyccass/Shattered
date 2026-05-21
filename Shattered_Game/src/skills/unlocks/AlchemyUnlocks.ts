import type { SkillUnlockEntry } from '../SkillUnlockTypes';

export const ALCHEMY_UNLOCKS: SkillUnlockEntry[] = [
  {
    skillId: 'alchemy', rankRequired: 1, stageRequired: 1,
    kind: 'resource_node', refId: 'herb_patch',
    displayName: 'Gather Herbs',
    description: 'Harvest wild herbs from patches.',
  },
  {
    skillId: 'alchemy', rankRequired: 1, stageRequired: 1,
    kind: 'recipe', refId: 'hand_warm_tea',
    displayName: 'Herbal Pouch (by hand)',
    description: 'Bundle two herbs into a crude remedy.',
  },
  {
    skillId: 'alchemy', rankRequired: 1, stageRequired: 1,
    kind: 'recipe', refId: 'campfire_warm_tea',
    displayName: 'Warm Tea (campfire)',
    description: 'Steep herbs over a campfire for a warming drink.',
  },
  // Future: potions, reagent processing, distillation
];
