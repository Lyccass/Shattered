import type { ItemDefinition } from '../ItemTypes';

// Shared material tiers
// Matches the 7-tier weapon/armour progression: copper → titanite.

type ToolTier = {
  id: string;
  displayName: string;
  rank: number;
  value: number;
};

const TOOL_TIERS: ToolTier[] = [
  { id: 'copper',   displayName: 'Copper',   rank: 1, value: 12  },
  { id: 'iron',     displayName: 'Iron',     rank: 2, value: 35  },
  { id: 'steel',    displayName: 'Steel',    rank: 3, value: 80  },
  { id: 'cobalt',   displayName: 'Cobalt',   rank: 4, value: 180 },
  { id: 'tungsten', displayName: 'Tungsten', rank: 5, value: 380 },
  { id: 'adamant',  displayName: 'Adamant',  rank: 6, value: 800 },
  { id: 'titanite', displayName: 'Titanite', rank: 7, value: 1600 },
];

// Pickaxes (metalworking)

const PICKAXE_ITEMS: ItemDefinition[] = TOOL_TIERS.map((t) => ({
  id: `${t.id}_pickaxe`,
  name: `${t.displayName} Pickaxe`,
  examine: `A ${t.displayName.toLowerCase()} pickaxe for mining ore veins. Requires metalworking rank ${t.rank}.`,
  icon: '⛏️',
  category: 'tool',
  stackable: false,
  weight: 2.5,
  value: t.value,
  toolFor: ['metalworking'],
  gatherTier: t.rank,
}));

// Skinning knives (leatherworking)

const SKINNING_KNIFE_ITEMS: ItemDefinition[] = TOOL_TIERS.map((t) => ({
  id: `${t.id}_skinning_knife`,
  name: `${t.displayName} Skinning Knife`,
  examine: `A ${t.displayName.toLowerCase()} skinning knife for processing hides. Requires leatherworking rank ${t.rank}.`,
  icon: '🔪',
  category: 'tool',
  stackable: false,
  weight: 0.4,
  value: Math.round(t.value * 0.6),
  toolFor: ['leatherworking'],
  gatherTier: t.rank,
}));

// Placeable utility tools

const UTILITY_ITEMS: ItemDefinition[] = [
  {
    id: 'firestarter_set',
    name: 'Firestarter Set',
    examine: 'A dry bundle of kindling tied for quick placement.',
    icon: '🔥',
    category: 'tool',
    stackable: false,
    weight: 0.4,
    value: 8,
    placementRules: {
      allowedSpaceTypes: ['personal_island', 'open_world'],
      mustBeWalkable: true,
      mustNotBeBlocked: true,
      durationMs: 45_000,
    },
    placementObjectDefinitionId: 'placed_firestarter_set',
  },
  {
    id: 'wooden_marker',
    name: 'Wooden Marker',
    examine: 'A simple carved marker for trails or camp notes.',
    icon: '📌',
    category: 'misc',
    stackable: false,
    weight: 0.1,
    value: 3,
  },
  {
    id: 'camp_supplies',
    name: 'Camp Supplies',
    examine: 'A bundled pack of rough camp essentials ready to hand off.',
    icon: '🎒',
    category: 'misc',
    stackable: false,
    weight: 1.2,
    value: 10,
  },
];

export const TOOL_ITEMS: ItemDefinition[] = [
  ...PICKAXE_ITEMS,
  ...SKINNING_KNIFE_ITEMS,
  ...UTILITY_ITEMS,
];
