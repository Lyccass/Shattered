import type { EquipmentSlot } from '../../../equipment/EquipmentTypes';
import type { ItemDefinition } from '../../ItemTypes';

type MaterialTier = {
  id: string;
  displayName: string;
  rank: number;
  valueMultiplier: number;
  weightMultiplier: number;
  durabilityBonus: number;
};

type ArmorPieceConfig = {
  id: string;
  displayName: string;
  icon: string;
  slot: EquipmentSlot;
  examine: string;
  typeDefence: { slash: number; pierce: number; crush: number };
  elementalResistance: { poison: number; fire: number; cold: number; lightning: number };
  dodgeBonus: number;
  poise: number;
  weight: number;
  durability: number;
  value: number;
};

const MATERIAL_TIERS: MaterialTier[] = [
  { id: 'copper',   displayName: 'Copper',   rank: 1, valueMultiplier: 1,  weightMultiplier: 1.00, durabilityBonus: 0  },
  { id: 'iron',     displayName: 'Iron',     rank: 2, valueMultiplier: 4,  weightMultiplier: 1.12, durabilityBonus: 10 },
  { id: 'steel',    displayName: 'Steel',    rank: 3, valueMultiplier: 9,  weightMultiplier: 1.08, durabilityBonus: 20 },
  { id: 'cobalt',   displayName: 'Cobalt',   rank: 4, valueMultiplier: 16, weightMultiplier: 0.98, durabilityBonus: 30 },
  { id: 'tungsten', displayName: 'Tungsten', rank: 5, valueMultiplier: 25, weightMultiplier: 1.28, durabilityBonus: 40 },
  { id: 'adamant',  displayName: 'Adamant',  rank: 6, valueMultiplier: 36, weightMultiplier: 1.18, durabilityBonus: 50 },
  { id: 'titanite', displayName: 'Titanite', rank: 7, valueMultiplier: 49, weightMultiplier: 1.05, durabilityBonus: 60 },
];

const ARMOR_PIECES: ArmorPieceConfig[] = [
  {
    id: 'head',
    displayName: 'Head',
    icon: '🪖',
    slot: 'head',
    examine: 'Head-slot protection against glancing blows.',
    typeDefence: { slash: 1, pierce: 1, crush: 1 },
    elementalResistance: { poison: 0, fire: 0, cold: 1, lightning: 0 },
    dodgeBonus: -1,
    poise: 1,
    weight: 0.9,
    durability: 90,
    value: 16,
  },
  {
    id: 'gloves',
    displayName: 'Gloves',
    icon: '🧤',
    slot: 'gloves',
    examine: 'Gloves-slot armour for keeping a grip through impacts.',
    typeDefence: { slash: 1, pierce: 1, crush: 1 },
    elementalResistance: { poison: 0, fire: 0, cold: 0, lightning: 0 },
    dodgeBonus: -1,
    poise: 1,
    weight: 0.8,
    durability: 90,
    value: 14,
  },
  {
    id: 'body',
    displayName: 'Body',
    icon: '🥋',
    slot: 'body',
    examine: 'Body-slot armour for surviving direct weapon hits.',
    typeDefence: { slash: 3, pierce: 3, crush: 2 },
    elementalResistance: { poison: 1, fire: 0, cold: 1, lightning: 1 },
    dodgeBonus: -3,
    poise: 4,
    weight: 3.8,
    durability: 110,
    value: 38,
  },
  {
    id: 'legs',
    displayName: 'Legs',
    icon: '👖',
    slot: 'legs',
    examine: 'Leg-slot armour that keeps movement possible under pressure.',
    typeDefence: { slash: 2, pierce: 1, crush: 1 },
    elementalResistance: { poison: 0, fire: 0, cold: 1, lightning: 0 },
    dodgeBonus: -2,
    poise: 2,
    weight: 2.3,
    durability: 100,
    value: 28,
  },
  {
    id: 'feet',
    displayName: 'Feet',
    icon: '👢',
    slot: 'feet',
    examine: 'Feet-slot armour for bracing against impact.',
    typeDefence: { slash: 1, pierce: 1, crush: 1 },
    elementalResistance: { poison: 0, fire: 0, cold: 1, lightning: 0 },
    dodgeBonus: -1,
    poise: 1,
    weight: 1.1,
    durability: 95,
    value: 18,
  },
];

export const ARMOR_ITEMS: ItemDefinition[] = MATERIAL_TIERS.flatMap((material) =>
  ARMOR_PIECES.map((piece) => makeArmorDefinition(material, piece)),
);

function makeArmorDefinition(material: MaterialTier, piece: ArmorPieceConfig): ItemDefinition {
  const id = `${material.id}_${piece.id}`;
  const requiredLevel = (material.rank - 1) * 10 + 1;
  const defenceMultiplier = getMaterialDefenceMultiplier(material.rank);
  const weight = roundTenth(piece.weight * material.weightMultiplier);
  const dodgeBonus = Math.min(0, piece.dodgeBonus - Math.floor((material.rank - 1) / 2));
  const poise = piece.poise + Math.floor((material.rank - 1) * 1.1);

  return {
    id,
    name: `${material.displayName} ${piece.displayName}`,
    examine: `${piece.examine} Requires rank ${material.rank} melee armour handling.`,
    icon: piece.icon,
    category: 'equipment',
    stackable: false,
    weight,
    value: Math.round(piece.value * material.valueMultiplier),
    equipment: {
      slot: piece.slot,
      requiredLevel,
      armorStats: {
        dodgeBonus,
        typeDefence: {
          slash: scaleDefence(piece.typeDefence.slash, defenceMultiplier),
          pierce: scaleDefence(piece.typeDefence.pierce, defenceMultiplier),
          crush: scaleDefence(piece.typeDefence.crush, defenceMultiplier),
        },
        elementalResistance: {
          poison: scaleResistance(piece.elementalResistance.poison, material.rank),
          fire:   scaleResistance(piece.elementalResistance.fire, material.rank),
          cold:   scaleResistance(piece.elementalResistance.cold, material.rank),
          lightning: scaleResistance(piece.elementalResistance.lightning, material.rank),
        },
        poise,
        weight,
        durability: piece.durability + material.durabilityBonus,
        maxDurability: piece.durability + material.durabilityBonus,
      },
    },
  };
}

function scaleDefence(base: number, multiplier: number): number {
  return Math.max(0, Math.round(base * multiplier));
}

function scaleResistance(base: number, rank: number): number {
  if (base <= 0) return 0;
  return base + Math.floor((rank - 1) / 2);
}

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function getMaterialDefenceMultiplier(rank: number): number {
  if (rank <= 1) return 1;
  return 1 + 0.25 * (1.75 ** (rank - 1) - 1);
}
