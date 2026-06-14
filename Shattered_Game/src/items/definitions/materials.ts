import type { ItemDefinition } from '../ItemTypes';

// ── Base materials (gathered/dropped) ────────────────────────────────────────

const BASE_MATERIALS: ItemDefinition[] = [
  {
    id: 'wood',
    name: 'Driftwood',
    examine: 'Dry wood gathered from shore or fallen brush.',
    icon: '🪵',
    category: 'material',
    stackable: false,
    weight: 0.5,
    value: 1,
  },
  {
    id: 'stone',
    name: 'Stone',
    examine: 'A rough stone that can strike sparks or support simple crafting.',
    icon: '🪨',
    category: 'material',
    stackable: false,
    weight: 1.0,
    value: 1,
  },
  {
    id: 'herb',
    name: 'Herb',
    examine: 'A gathered herb that can be brewed over an active fire.',
    icon: '🌿',
    category: 'material',
    stackable: false,
    weight: 0.1,
    value: 2,
  },
  {
    id: 'bone',
    name: 'Bone',
    examine: 'A gnawed bone — material for tools or fuel.',
    icon: '🦴',
    category: 'material',
    stackable: false,
    weight: 0.3,
    value: 1,
  },
  {
    id: 'wolf_pelt_healthy',
    name: 'Wolf Pelt',
    examine: 'Intact wolf fur. Rare — worth keeping for serious crafting.',
    icon: '🐺',
    category: 'material',
    stackable: false,
    weight: 0.8,
    value: 12,
  },
  {
    id: 'wolf_pelt_torn',
    name: 'Torn Pelt',
    examine: 'Damaged wolf fur. Less prized but still useful in a pinch.',
    icon: '🪶',
    category: 'material',
    stackable: false,
    weight: 0.6,
    value: 4,
  },
];

// ── Ores (mined from veins, smelted into bars) ────────────────────────────────

type MetalTier = { id: string; displayName: string; oreValue: number; barValue: number };

const METAL_TIERS: MetalTier[] = [
  { id: 'copper',   displayName: 'Copper',   oreValue: 4,   barValue: 10  },
  { id: 'iron',     displayName: 'Iron',     oreValue: 10,  barValue: 25  },
  { id: 'steel',    displayName: 'Steel',    oreValue: 22,  barValue: 55  },
  { id: 'cobalt',   displayName: 'Cobalt',   oreValue: 45,  barValue: 110 },
  { id: 'tungsten', displayName: 'Tungsten', oreValue: 90,  barValue: 220 },
  { id: 'adamant',  displayName: 'Adamant',  oreValue: 180, barValue: 440 },
  { id: 'titanite', displayName: 'Titanite', oreValue: 360, barValue: 880 },
];

const ORE_ITEMS: ItemDefinition[] = METAL_TIERS.map((m) => ({
  id: `${m.id}_ore`,
  name: `${m.displayName} Ore`,
  examine: `Raw ${m.displayName.toLowerCase()} ore, ready to be smelted into a bar.`,
  icon: '🪨',
  category: 'material',
  stackable: false,
  weight: 2.0,
  value: m.oreValue,
}));

const BAR_ITEMS: ItemDefinition[] = METAL_TIERS.map((m) => ({
  id: `${m.id}_bar`,
  name: `${m.displayName} Bar`,
  examine: `A smelted ${m.displayName.toLowerCase()} bar ready for smithing.`,
  icon: '📦',
  category: 'material',
  stackable: false,
  weight: 2.5,
  value: m.barValue,
}));

// ── Logs (cut from trees) ─────────────────────────────────────────────────────

type WoodTier = { id: string; displayName: string; value: number };

const WOOD_TIERS: WoodTier[] = [
  { id: 'pine',      displayName: 'Pine',      value: 3   },
  { id: 'oak',       displayName: 'Oak',       value: 8   },
  { id: 'ash',       displayName: 'Ash',       value: 18  },
  { id: 'yew',       displayName: 'Yew',       value: 40  },
  { id: 'redwood',   displayName: 'Redwood',   value: 90  },
  { id: 'blackwood', displayName: 'Blackwood', value: 200 },
  { id: 'ebony',     displayName: 'Ebony',     value: 450 },
];

const LOG_ITEMS: ItemDefinition[] = WOOD_TIERS.map((w) => ({
  id: `${w.id}_log`,
  name: `${w.displayName} Log`,
  examine: `A freshly cut ${w.displayName.toLowerCase()} log.`,
  icon: '🪵',
  category: 'material',
  stackable: false,
  weight: 3.0,
  value: w.value,
}));

// ── Leather (skinned from enemies, processed at tanning rack) ─────────────────
// Tier 1–7 progression: common beasts → apex predators → legendary creatures.

const LEATHER_ITEMS: ItemDefinition[] = [
  {
    id: 'rawhide',
    name: 'Rawhide',
    examine: 'Rough unprocessed skin from a common animal. Tan it to make leather.',
    icon: '🟫',
    category: 'material',
    stackable: false,
    weight: 1.0,
    value: 5,
  },
  {
    id: 'leather',
    name: 'Leather',
    examine: 'Tanned and cured hide. The foundation of basic leather armour.',
    icon: '🟤',
    category: 'material',
    stackable: false,
    weight: 0.8,
    value: 14,
  },
  {
    id: 'thick_leather',
    name: 'Thick Leather',
    examine: 'Dense hide from a tough beast. Offers stronger protection than basic leather.',
    icon: '🟤',
    category: 'material',
    stackable: false,
    weight: 1.1,
    value: 35,
  },
  {
    id: 'boarhide',
    name: 'Boarhide',
    examine: 'Coarse layered hide from a wild boar. Naturally crush-resistant.',
    icon: '🟤',
    category: 'material',
    stackable: false,
    weight: 1.4,
    value: 80,
  },
  {
    id: 'scalehide',
    name: 'Scalehide',
    examine: 'Tough scaled skin from a reptilian creature. Excellent lightning resistance.',
    icon: '🟤',
    category: 'material',
    stackable: false,
    weight: 1.6,
    value: 180,
  },
  {
    id: 'drakehide',
    name: 'Drakehide',
    examine: 'Fire-tempered hide from a drake. Prized by elite leather crafters.',
    icon: '🟤',
    category: 'material',
    stackable: false,
    weight: 1.8,
    value: 420,
  },
  {
    id: 'wyrmhide',
    name: 'Wyrmhide',
    examine: 'Legendary hide from a great wyrm. The pinnacle of leatherworking material.',
    icon: '🟤',
    category: 'material',
    stackable: false,
    weight: 2.0,
    value: 950,
  },
];

export const MATERIAL_ITEMS: ItemDefinition[] = [
  ...BASE_MATERIALS,
  ...ORE_ITEMS,
  ...BAR_ITEMS,
  ...LOG_ITEMS,
  ...LEATHER_ITEMS,
];
