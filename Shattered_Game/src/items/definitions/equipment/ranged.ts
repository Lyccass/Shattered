import type { ItemDefinition } from '../../ItemTypes';

// Ranged weapons (bows & crossbows)
// Crafted via Woodworking skill; equip gate is the Ranged skill.
// Each wood tier produces one bow and one crossbow.
// Bows: lighter, longer range, lower damage.
// Crossbows: heavier, shorter range, higher damage, slower fire.

type WoodTier = {
  id: string;
  displayName: string;
  rank: number;
  damageBonus: number;
  accuracyBonus: number;
  valueBase: number;
};

const WOOD_TIERS: WoodTier[] = [
  { id: 'pine',      displayName: 'Pine',      rank: 1, damageBonus: 0,  accuracyBonus: 0, valueBase: 14  },
  { id: 'oak',       displayName: 'Oak',       rank: 2, damageBonus: 1,  accuracyBonus: 2, valueBase: 40  },
  { id: 'ash',       displayName: 'Ash',       rank: 3, damageBonus: 2,  accuracyBonus: 4, valueBase: 85  },
  { id: 'yew',       displayName: 'Yew',       rank: 4, damageBonus: 4,  accuracyBonus: 6, valueBase: 180 },
  { id: 'redwood',   displayName: 'Redwood',   rank: 5, damageBonus: 7,  accuracyBonus: 9, valueBase: 380 },
  { id: 'blackwood', displayName: 'Blackwood', rank: 6, damageBonus: 11, accuracyBonus: 12, valueBase: 800 },
  { id: 'ebony',     displayName: 'Ebony',     rank: 7, damageBonus: 16, accuracyBonus: 16, valueBase: 1600 },
];

const BOW_ITEMS: ItemDefinition[] = WOOD_TIERS.map((w) => ({
  id: `${w.id}_bow`,
  name: `${w.displayName} Bow`,
  examine: `A ${w.displayName.toLowerCase()} longbow. Fast and accurate at range.`,
  icon: '🏹',
  category: 'equipment',
  stackable: false,
  weight: 1.0 + w.rank * 0.1,
  value: w.valueBase,
  equipment: {
    slot: 'main_hand',
    requiredLevel: (w.rank - 1) * 10 + 1,
    twoHanded: true,
    weaponStats: {
      archetype: 'bow',
      attackShape: { kind: 'thrust', lengthTiles: 7 + w.rank, widthTiles: 0.5 },
      damage: 1 + w.damageBonus,
      damageType: 'pierce',
      reachTiles: 6,
      staminaCost: 10,
      staggerImpact: 2,
      weight: 1.0 + w.rank * 0.1,
      durability: 70 + w.rank * 8,
      maxDurability: 70 + w.rank * 8,
      accuracyRating: 9 + w.accuracyBonus,
    },
  },
}));

const CROSSBOW_ITEMS: ItemDefinition[] = WOOD_TIERS.map((w) => ({
  id: `${w.id}_crossbow`,
  name: `${w.displayName} Crossbow`,
  examine: `A ${w.displayName.toLowerCase()} crossbow. Hits harder but fires slower than a bow.`,
  icon: '🏹',
  category: 'equipment',
  stackable: false,
  weight: 2.2 + w.rank * 0.15,
  value: Math.round(w.valueBase * 1.4),
  equipment: {
    slot: 'main_hand',
    requiredLevel: (w.rank - 1) * 10 + 1,
    twoHanded: true,
    weaponStats: {
      archetype: 'crossbow',
      attackShape: { kind: 'thrust', lengthTiles: 5 + w.rank, widthTiles: 0.7 },
      damage: 3 + w.damageBonus + Math.floor(w.rank / 2),
      damageType: 'pierce',
      reachTiles: 5,
      staminaCost: 16,
      staggerImpact: 4,
      weight: 2.2 + w.rank * 0.15,
      durability: 80 + w.rank * 8,
      maxDurability: 80 + w.rank * 8,
      accuracyRating: 7 + w.accuracyBonus,
    },
  },
}));

export const RANGED_WEAPON_ITEMS: ItemDefinition[] = [...BOW_ITEMS, ...CROSSBOW_ITEMS];
