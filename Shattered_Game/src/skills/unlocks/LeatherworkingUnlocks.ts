import type { SkillUnlockEntry } from '../SkillUnlockTypes';

// Skinning is triggered post-combat on enemy corpses (not world resource nodes).
// Tool: skinning knife in inventory. Tier determines hide quality / bonus yield.
// Leather tier progression: Rawhide → Leather → Thick Leather → Boarhide →
//   Scalehide → Drakehide → Wyrmhide

const ARMOUR_TIERS = [
  { id: 'rawhide',       displayName: 'Rawhide',       rankRequired: 1 },
  { id: 'leather',       displayName: 'Leather',       rankRequired: 2 },
  { id: 'thick_leather', displayName: 'Thick Leather', rankRequired: 3 },
  { id: 'boarhide',      displayName: 'Boarhide',      rankRequired: 4 },
  { id: 'scalehide',     displayName: 'Scalehide',     rankRequired: 5 },
  { id: 'drakehide',     displayName: 'Drakehide',     rankRequired: 6 },
  { id: 'wyrmhide',      displayName: 'Wyrmhide',      rankRequired: 7 },
] as const;

const ARMOUR_CRAFT_UNLOCKS: SkillUnlockEntry[] = ARMOUR_TIERS.map((t) => ({
  skillId:       'leatherworking' as const,
  rankRequired:  t.rankRequired,
  stageRequired: 5,
  kind:          'armor' as const,
  refId:         `${t.id}_body`,
  displayName:   `${t.displayName} Armour`,
  description:   `Craft ${t.displayName.toLowerCase()} ranged armour from cured hides.`,
}));

export const LEATHERWORKING_UNLOCKS: SkillUnlockEntry[] = [
  // Skinning
  {
    skillId: 'leatherworking', rankRequired: 1, stageRequired: 1,
    kind: 'misc', refId: 'skin_basic',
    displayName: 'Skin Animals',
    description: 'Use a skinning knife on a slain beast to gather rawhide.',
  },
  {
    skillId: 'leatherworking', rankRequired: 2, stageRequired: 1,
    kind: 'misc', refId: 'skin_beast',
    displayName: 'Skin Beasts',
    description: 'Skin tough beasts for thick leather and boarhide. Sharp knife recommended.',
  },
  {
    skillId: 'leatherworking', rankRequired: 4, stageRequired: 1,
    kind: 'misc', refId: 'skin_scaled',
    displayName: 'Skin Scaled Creatures',
    description: 'Process scalehide from reptilian enemies. Sharp knife required.',
  },
  {
    skillId: 'leatherworking', rankRequired: 6, stageRequired: 1,
    kind: 'misc', refId: 'skin_drake',
    displayName: 'Skin Drakes',
    description: 'Harvest drakehide from slain drakes. Master knife required.',
  },
  {
    skillId: 'leatherworking', rankRequired: 8, stageRequired: 5,
    kind: 'misc', refId: 'skin_wyrm',
    displayName: 'Skin Wyrms',
    description: 'Harvest wyrmhide from legendary wyrms. Master knife required.',
  },

  // Tanning (raw → processed leather)
  {
    skillId: 'leatherworking', rankRequired: 1, stageRequired: 3,
    kind: 'recipe', refId: 'tan_rawhide',
    displayName: 'Tan Rawhide',
    description: 'Cure rawhide into basic leather at a tanning rack.',
  },
  {
    skillId: 'leatherworking', rankRequired: 2, stageRequired: 1,
    kind: 'recipe', refId: 'tan_thick_leather',
    displayName: 'Tan Thick Leather',
    description: 'Process tough hide into thick leather.',
  },
  {
    skillId: 'leatherworking', rankRequired: 4, stageRequired: 1,
    kind: 'recipe', refId: 'tan_scalehide',
    displayName: 'Cure Scalehide',
    description: 'Treat and cure scaled skin into workable scalehide.',
  },

  // Armour crafting (one entry per tier unlocks the full set)
  ...ARMOUR_CRAFT_UNLOCKS,
];
