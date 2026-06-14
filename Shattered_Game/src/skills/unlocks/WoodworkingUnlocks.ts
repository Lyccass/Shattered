import type { SkillUnlockEntry } from '../SkillUnlockTypes';

const BOW_TIERS = [
  { id: 'pine',      displayName: 'Pine',      rankRequired: 1 },
  { id: 'oak',       displayName: 'Oak',       rankRequired: 2 },
  { id: 'ash',       displayName: 'Ash',       rankRequired: 3 },
  { id: 'yew',       displayName: 'Yew',       rankRequired: 4 },
  { id: 'redwood',   displayName: 'Redwood',   rankRequired: 5 },
  { id: 'blackwood', displayName: 'Blackwood', rankRequired: 6 },
  { id: 'ebony',     displayName: 'Ebony',     rankRequired: 7 },
] as const;

const BOW_UNLOCKS: SkillUnlockEntry[] = BOW_TIERS.map((t) => ({
  skillId:       'woodworking' as const,
  rankRequired:  t.rankRequired,
  stageRequired: 5,
  kind:          'weapon' as const,
  refId:         `${t.id}_bow`,
  displayName:   `${t.displayName} Bows & Crossbows`,
  description:   `Craft ${t.displayName.toLowerCase()} bows and crossbows.`,
}));

export const WOODWORKING_UNLOCKS: SkillUnlockEntry[] = [
  // ── Gathering ──────────────────────────────────────────────────────────────
  {
    skillId: 'woodworking', rankRequired: 1, stageRequired: 1,
    kind: 'resource_node', refId: 'driftwood',
    displayName: 'Gather Driftwood',
    description: 'Collect driftwood from shore and fallen brush. No axe required.',
  },
  {
    skillId: 'woodworking', rankRequired: 1, stageRequired: 1,
    kind: 'resource_node', refId: 'pine_tree',
    displayName: 'Chop Pine',
    description: 'Fell pine trees for pine logs. Requires any axe.',
  },
  {
    skillId: 'woodworking', rankRequired: 2, stageRequired: 5,
    kind: 'resource_node', refId: 'oak_tree',
    displayName: 'Chop Oak',
    description: 'Fell oak trees for sturdy hardwood.',
  },
  {
    skillId: 'woodworking', rankRequired: 3, stageRequired: 5,
    kind: 'resource_node', refId: 'ash_tree',
    displayName: 'Chop Ash',
    description: 'Fell ash trees for lightweight strong timber.',
  },
  {
    skillId: 'woodworking', rankRequired: 4, stageRequired: 5,
    kind: 'resource_node', refId: 'yew_tree',
    displayName: 'Chop Yew',
    description: 'Fell yew trees for dense hardwood.',
  },
  {
    skillId: 'woodworking', rankRequired: 5, stageRequired: 5,
    kind: 'resource_node', refId: 'redwood_tree',
    displayName: 'Chop Redwood',
    description: 'Fell towering redwoods. Heavy axe recommended.',
  },
  {
    skillId: 'woodworking', rankRequired: 7, stageRequired: 1,
    kind: 'resource_node', refId: 'blackwood_tree',
    displayName: 'Chop Blackwood',
    description: 'Fell rare blackwood trees. Yields premium timber.',
  },
  {
    skillId: 'woodworking', rankRequired: 8, stageRequired: 5,
    kind: 'resource_node', refId: 'ebony_tree',
    displayName: 'Chop Ebony',
    description: 'Fell ancient ebony trees — the rarest timber known.',
  },

  // ── Ranged weapon crafting ─────────────────────────────────────────────────
  ...BOW_UNLOCKS,

  // ── Processing & crafting ──────────────────────────────────────────────────
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
