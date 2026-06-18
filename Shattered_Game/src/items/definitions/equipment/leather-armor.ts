import type { EquipmentSlot } from '../../../equipment/EquipmentTypes';
import type { ItemDefinition } from '../../ItemTypes';

// Leather armour
// Crafted via Leatherworking; equip gate is the Ranged skill.
// Stat profile vs metal: lighter, more dodge, better crush + lightning resistance,
// weaker slash/pierce defence, minimal poise.

type LeatherTier = {
  id: string;
  displayName: string;
  rank: number;
  valueMultiplier: number;
  weightMultiplier: number;
};

const LEATHER_TIERS: LeatherTier[] = [
  { id: 'rawhide',         displayName: 'Rawhide',       rank: 1, valueMultiplier: 1,  weightMultiplier: 0.55 },
  { id: 'leather',         displayName: 'Leather',       rank: 2, valueMultiplier: 4,  weightMultiplier: 0.50 },
  { id: 'thick_leather',   displayName: 'Thick Leather', rank: 3, valueMultiplier: 9,  weightMultiplier: 0.58 },
  { id: 'boarhide',        displayName: 'Boarhide',      rank: 4, valueMultiplier: 16, weightMultiplier: 0.62 },
  { id: 'scalehide',       displayName: 'Scalehide',     rank: 5, valueMultiplier: 25, weightMultiplier: 0.60 },
  { id: 'drakehide',       displayName: 'Drakehide',     rank: 6, valueMultiplier: 36, weightMultiplier: 0.58 },
  { id: 'wyrmhide',        displayName: 'Wyrmhide',      rank: 7, valueMultiplier: 49, weightMultiplier: 0.55 },
];

type LeatherPiece = {
  id: string;
  displayName: string;
  icon: string;
  slot: EquipmentSlot;
  typeDefence:         { slash: number; pierce: number; crush: number };
  elementalResistance: { poison: number; fire: number; cold: number; lightning: number };
  dodgeBonus: number;
  poise: number;
  weight: number;
  durability: number;
  value: number;
};

const LEATHER_PIECES: LeatherPiece[] = [
  {
    id: 'head',    displayName: 'Coif',    icon: '🪖', slot: 'head',
    typeDefence:         { slash: 0, pierce: 1, crush: 1 },
    elementalResistance: { poison: 0, fire: 0, cold: 0, lightning: 1 },
    dodgeBonus: 0, poise: 0, weight: 0.5, durability: 75, value: 12,
  },
  {
    id: 'gloves',  displayName: 'Gloves',  icon: '🧤', slot: 'gloves',
    typeDefence:         { slash: 0, pierce: 1, crush: 1 },
    elementalResistance: { poison: 0, fire: 0, cold: 0, lightning: 1 },
    dodgeBonus: 0, poise: 0, weight: 0.4, durability: 75, value: 10,
  },
  {
    id: 'body',    displayName: 'Body',    icon: '🥋', slot: 'body',
    typeDefence:         { slash: 1, pierce: 2, crush: 3 },
    elementalResistance: { poison: 1, fire: 0, cold: 0, lightning: 2 },
    dodgeBonus: -1, poise: 1, weight: 2.0, durability: 90, value: 30,
  },
  {
    id: 'legs',    displayName: 'Chaps',   icon: '👖', slot: 'legs',
    typeDefence:         { slash: 0, pierce: 1, crush: 2 },
    elementalResistance: { poison: 0, fire: 0, cold: 0, lightning: 1 },
    dodgeBonus: -1, poise: 0, weight: 1.2, durability: 85, value: 22,
  },
  {
    id: 'feet',    displayName: 'Boots',   icon: '👢', slot: 'feet',
    typeDefence:         { slash: 0, pierce: 1, crush: 1 },
    elementalResistance: { poison: 0, fire: 0, cold: 0, lightning: 1 },
    dodgeBonus: 0, poise: 0, weight: 0.6, durability: 80, value: 14,
  },
];

export const LEATHER_ARMOR_ITEMS: ItemDefinition[] = LEATHER_TIERS.flatMap((material) =>
  LEATHER_PIECES.map((piece) => makeLeatherArmorDefinition(material, piece)),
);

function makeLeatherArmorDefinition(material: LeatherTier, piece: LeatherPiece): ItemDefinition {
  const id = `${material.id}_${piece.id}`;
  const requiredLevel = (material.rank - 1) * 10 + 1;
  const defMul = getDefenceMultiplier(material.rank);
  const weight = roundTenth(piece.weight * material.weightMultiplier);

  return {
    id,
    name: `${material.displayName} ${piece.displayName}`,
    examine: `${material.displayName} ranged armour. Light and flexible for mobile fighters.`,
    icon: piece.icon,
    category: 'equipment',
    stackable: false,
    weight,
    value: Math.round(piece.value * material.valueMultiplier),
    equipment: {
      slot: piece.slot,
      requiredLevel,
      armorStats: {
        dodgeBonus: piece.dodgeBonus,
        typeDefence: {
          slash:  scaleDefence(piece.typeDefence.slash,  defMul),
          pierce: scaleDefence(piece.typeDefence.pierce, defMul),
          crush:  scaleDefence(piece.typeDefence.crush,  defMul),
        },
        elementalResistance: {
          poison:    scaleRes(piece.elementalResistance.poison,    material.rank),
          fire:      scaleRes(piece.elementalResistance.fire,      material.rank),
          cold:      scaleRes(piece.elementalResistance.cold,      material.rank),
          lightning: scaleRes(piece.elementalResistance.lightning, material.rank),
        },
        poise: piece.poise,
        weight,
        durability:    piece.durability,
        maxDurability: piece.durability,
      },
    },
  };
}

function scaleDefence(base: number, multiplier: number): number {
  return Math.max(0, Math.round(base * multiplier));
}

function scaleRes(base: number, rank: number): number {
  if (base <= 0) return 0;
  return base + Math.floor((rank - 1) / 2);
}

function getDefenceMultiplier(rank: number): number {
  if (rank <= 1) return 1;
  return 1 + 0.22 * (1.7 ** (rank - 1) - 1);
}

function roundTenth(v: number): number {
  return Math.round(v * 10) / 10;
}
