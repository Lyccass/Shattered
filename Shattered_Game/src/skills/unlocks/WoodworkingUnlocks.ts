import type { SkillUnlockEntry } from '../SkillUnlockTypes';

export const WOODWORKING_UNLOCKS: SkillUnlockEntry[] = [
  {
    skillId: 'woodworking', rankRequired: 1, stageRequired: 1,
    kind: 'resource_node', refId: 'driftwood',
    displayName: 'Gather Driftwood',
    description: 'Collect driftwood from wood nodes.',
  },
  {
    skillId: 'woodworking', rankRequired: 1, stageRequired: 1,
    kind: 'recipe', refId: 'hand_firestarter_set',
    displayName: 'Firestarter Set (by hand)',
    description: 'Strike stone against wood — no workbench needed.',
  },
  {
    skillId: 'woodworking', rankRequired: 1, stageRequired: 1,
    kind: 'recipe', refId: 'workbench_firestarter_set',
    displayName: 'Firestarter Set (workbench)',
    description: 'Craft a dry fire bundle at a workbench.',
  },
  {
    skillId: 'woodworking', rankRequired: 1, stageRequired: 1,
    kind: 'recipe', refId: 'workbench_wooden_marker',
    displayName: 'Wooden Marker',
    description: 'Cut a trail marker from spare wood.',
  },
  {
    skillId: 'woodworking', rankRequired: 1, stageRequired: 3,
    kind: 'recipe', refId: 'workbench_camp_supplies',
    displayName: 'Camp Supplies',
    description: 'Bundle wood and stone into a compact field kit.',
  },
];
