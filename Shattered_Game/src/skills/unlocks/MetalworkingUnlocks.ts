import type { SkillUnlockEntry } from '../SkillUnlockTypes';

// Material tiers — rank matches the equipment requiredLevel progression.
const METAL_TIERS = [
  { id: 'copper',   displayName: 'Copper',   rank: 1 },
  { id: 'iron',     displayName: 'Iron',     rank: 2 },
  { id: 'steel',    displayName: 'Steel',    rank: 3 },
  { id: 'cobalt',   displayName: 'Cobalt',   rank: 4 },
  { id: 'tungsten', displayName: 'Tungsten', rank: 5 },
  { id: 'adamant',  displayName: 'Adamant',  rank: 6 },
  { id: 'titanite', displayName: 'Titanite', rank: 7 },
] as const;

const WEAPON_ARCHETYPES = ['sword', 'dagger', 'axe', 'hammer', 'spear'] as const;
const ARMOUR_SLOTS      = ['head', 'body', 'legs', 'gloves', 'feet']    as const;

// ── Mining unlocks ────────────────────────────────────────────────────────────

const MINING_UNLOCKS: SkillUnlockEntry[] = [
  {
    skillId: 'metalworking', rankRequired: 1, stageRequired: 1,
    kind: 'resource_node', refId: 'stone_pile',
    displayName: 'Gather Stone',
    description: 'Break apart stone piles for raw stone. No tool required.',
  },
  {
    skillId: 'metalworking', rankRequired: 1, stageRequired: 1,
    kind: 'resource_node', refId: 'copper_vein',
    displayName: 'Mine Copper',
    description: 'Mine copper ore veins. Requires any pickaxe.',
  },
  {
    skillId: 'metalworking', rankRequired: 2, stageRequired: 5,
    kind: 'resource_node', refId: 'iron_vein',
    displayName: 'Mine Iron',
    description: 'Mine iron ore veins. Copper pickaxe or better.',
  },
  {
    skillId: 'metalworking', rankRequired: 3, stageRequired: 1,
    kind: 'resource_node', refId: 'steel_vein',
    displayName: 'Mine Steel Ore',
    description: 'Mine steel ore veins. Iron pickaxe or better.',
  },
  {
    skillId: 'metalworking', rankRequired: 4, stageRequired: 5,
    kind: 'resource_node', refId: 'cobalt_vein',
    displayName: 'Mine Cobalt',
    description: 'Mine cobalt ore veins. Steel pickaxe or better.',
  },
  {
    skillId: 'metalworking', rankRequired: 5, stageRequired: 5,
    kind: 'resource_node', refId: 'tungsten_vein',
    displayName: 'Mine Tungsten',
    description: 'Mine tungsten ore veins. Cobalt pickaxe or better.',
  },
  {
    skillId: 'metalworking', rankRequired: 6, stageRequired: 5,
    kind: 'resource_node', refId: 'adamant_vein',
    displayName: 'Mine Adamant',
    description: 'Mine adamant ore veins. Tungsten pickaxe or better.',
  },
  {
    skillId: 'metalworking', rankRequired: 7, stageRequired: 5,
    kind: 'resource_node', refId: 'titanite_vein',
    displayName: 'Mine Titanite',
    description: 'Mine titanite ore veins. Adamant pickaxe or better.',
  },
];

// ── Smelting unlocks (ore → bar) ──────────────────────────────────────────────

const SMELTING_UNLOCKS: SkillUnlockEntry[] = METAL_TIERS.map((m) => ({
  skillId:       'metalworking' as const,
  rankRequired:  m.rank,
  stageRequired: m.rank === 1 ? 3 : 5,
  kind:          'recipe' as const,
  refId:         `smelt_${m.id}_bar`,
  displayName:   `Smelt ${m.displayName} Bar`,
  description:   `Smelt ${m.displayName.toLowerCase()} ore into a usable bar at a forge.`,
}));

// ── Smithing unlocks (bars → tools) ──────────────────────────────────────────
// stone_pickaxe is the starter tool; copper+ are forged from bars.

// Pickaxes and skinning knives share the same 7 material tiers as weapons.
// Pickaxe: forged from metal bars (metalworking).
// Skinning knife: also forged from metal bars — blade quality determines hide tier.

const TOOL_FORGE_TIERS = [
  { metal: 'copper',   rank: 1 },
  { metal: 'iron',     rank: 2 },
  { metal: 'steel',    rank: 3 },
  { metal: 'cobalt',   rank: 4 },
  { metal: 'tungsten', rank: 5 },
  { metal: 'adamant',  rank: 6 },
  { metal: 'titanite', rank: 7 },
] as const;

const PICKAXE_UNLOCKS: SkillUnlockEntry[] = TOOL_FORGE_TIERS.map((t) => ({
  skillId:       'metalworking' as const,
  rankRequired:  t.rank,
  stageRequired: 5,
  kind:          'tool' as const,
  refId:         `${t.metal}_pickaxe`,
  displayName:   `Forge ${t.metal.charAt(0).toUpperCase() + t.metal.slice(1)} Pickaxe`,
  description:   `Smith a ${t.metal} pickaxe from ${t.metal} bars.`,
}));

const SKINNING_KNIFE_UNLOCKS: SkillUnlockEntry[] = TOOL_FORGE_TIERS.map((t) => ({
  skillId:       'metalworking' as const,
  rankRequired:  t.rank,
  stageRequired: 7,
  kind:          'tool' as const,
  refId:         `${t.metal}_skinning_knife`,
  displayName:   `Forge ${t.metal.charAt(0).toUpperCase() + t.metal.slice(1)} Skinning Knife`,
  description:   `Smith a ${t.metal} skinning knife from ${t.metal} bars.`,
}));

// ── Smithing unlocks (bars → weapons) ────────────────────────────────────────
// Weapons unlock at the rank matching the material tier, stage 5.

const WEAPON_SMITH_UNLOCKS: SkillUnlockEntry[] = METAL_TIERS.flatMap((m) =>
  WEAPON_ARCHETYPES.map((archetype) => ({
    skillId:       'metalworking' as const,
    rankRequired:  m.rank,
    stageRequired: 5,
    kind:          'weapon' as const,
    refId:         `${m.id}_${archetype}`,
    displayName:   `Smith ${m.displayName} ${archetype.charAt(0).toUpperCase()}${archetype.slice(1)}`,
    description:   `Forge a ${m.displayName.toLowerCase()} ${archetype} from ${m.displayName.toLowerCase()} bars.`,
  })),
);

// ── Smithing unlocks (bars → armour) ─────────────────────────────────────────
// Armour unlocks one stage later than weapons of the same tier.

const ARMOUR_SMITH_UNLOCKS: SkillUnlockEntry[] = METAL_TIERS.flatMap((m) =>
  ARMOUR_SLOTS.map((slot) => ({
    skillId:       'metalworking' as const,
    rankRequired:  m.rank,
    stageRequired: m.rank < 7 ? 7 : 8,
    kind:          'armor' as const,
    refId:         `${m.id}_${slot}`,
    displayName:   `Smith ${m.displayName} ${slot.charAt(0).toUpperCase()}${slot.slice(1)}`,
    description:   `Forge ${m.displayName.toLowerCase()} ${slot} armour from ${m.displayName.toLowerCase()} bars.`,
  })),
);

export const METALWORKING_UNLOCKS: SkillUnlockEntry[] = [
  ...MINING_UNLOCKS,
  ...SMELTING_UNLOCKS,
  ...PICKAXE_UNLOCKS,
  ...SKINNING_KNIFE_UNLOCKS,
  ...WEAPON_SMITH_UNLOCKS,
  ...ARMOUR_SMITH_UNLOCKS,
];
