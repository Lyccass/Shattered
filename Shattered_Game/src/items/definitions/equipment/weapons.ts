import type { PhysicalDamageType, WeaponArchetype, WeaponAttackShape } from '../../../equipment/EquipmentTypes';
import type { ItemDefinition } from '../../ItemTypes';

type MaterialTier = {
  id: string;
  displayName: string;
  rank: number;
  valueMultiplier: number;
  weightMultiplier: number;
  accuracyBonus: number;
};

type WeaponArchetypeConfig = {
  archetype: Exclude<WeaponArchetype, 'fists' | 'bow'>;
  displayName: string;
  icon: string;
  examine: string;
  damageType: PhysicalDamageType;
  attackShape: WeaponAttackShape;
  baseAccuracy: number;
  baseDamage: number;
  reachTiles: number;
  staminaCost: number;
  staggerImpact: number;
  weight: number;
  durability: number;
  twoHanded?: boolean;
};

const MATERIAL_TIERS: MaterialTier[] = [
  { id: 'copper',   displayName: 'Copper',   rank: 1, valueMultiplier: 1,  weightMultiplier: 1.00, accuracyBonus: 0   },
  { id: 'iron',     displayName: 'Iron',     rank: 2, valueMultiplier: 4,  weightMultiplier: 1.10, accuracyBonus: 36  },
  { id: 'steel',    displayName: 'Steel',    rank: 3, valueMultiplier: 9,  weightMultiplier: 1.05, accuracyBonus: 90  },
  { id: 'cobalt',   displayName: 'Cobalt',   rank: 4, valueMultiplier: 16, weightMultiplier: 0.95, accuracyBonus: 144 },
  { id: 'tungsten', displayName: 'Tungsten', rank: 5, valueMultiplier: 25, weightMultiplier: 1.25, accuracyBonus: 216 },
  { id: 'adamant',  displayName: 'Adamant',  rank: 6, valueMultiplier: 36, weightMultiplier: 1.15, accuracyBonus: 288 },
  { id: 'titanite', displayName: 'Titanite', rank: 7, valueMultiplier: 49, weightMultiplier: 1.00, accuracyBonus: 378 },
];

const ARCHETYPES: WeaponArchetypeConfig[] = [
  {
    archetype: 'sword',
    displayName: 'Sword',
    icon: '🗡️',
    examine: 'A balanced blade with reliable reach and control.',
    damageType: 'slash',
    attackShape: { kind: 'arc', angleDeg: 120, rangeTiles: 1.5, minRangeTiles: 0.3 },
    baseAccuracy: 82,
    baseDamage: 1,
    reachTiles: 1.0,
    staminaCost: 11,
    staggerImpact: 5,
    weight: 1.3,
    durability: 80,
  },
  {
    archetype: 'dagger',
    displayName: 'Dagger',
    icon: '🔪',
    examine: 'A light stabbing weapon that rewards precision.',
    damageType: 'pierce',
    attackShape: { kind: 'thrust', lengthTiles: 1.2, widthTiles: 0.6 },
    baseAccuracy: 95,
    baseDamage: 1,
    reachTiles: 1.0,
    staminaCost: 8,
    staggerImpact: 2,
    weight: 0.6,
    durability: 70,
  },
  {
    archetype: 'axe',
    displayName: 'Axe',
    icon: '🪓',
    examine: 'A heavy chopping weapon with strong stagger pressure.',
    damageType: 'slash',
    attackShape: { kind: 'arc', angleDeg: 90, rangeTiles: 1.2, minRangeTiles: 0.5 },
    baseAccuracy: 76,
    baseDamage: 1,
    reachTiles: 1.0,
    staminaCost: 13,
    staggerImpact: 7,
    weight: 1.8,
    durability: 75,
  },
  {
    archetype: 'hammer',
    displayName: 'Hammer',
    icon: '🔨',
    examine: 'A slow-feeling crush weapon built to break guard and bone.',
    damageType: 'crush',
    attackShape: { kind: 'thrust', lengthTiles: 1.5, widthTiles: 2.0 },
    baseAccuracy: 70,
    baseDamage: 1,
    reachTiles: 1.0,
    staminaCost: 16,
    staggerImpact: 10,
    weight: 2.8,
    durability: 85,
    twoHanded: true,
  },
  {
    archetype: 'spear',
    displayName: 'Spear',
    icon: '🏹',
    examine: 'A long piercing weapon for holding enemies at distance.',
    damageType: 'pierce',
    attackShape: { kind: 'thrust', lengthTiles: 2.5, widthTiles: 0.7 },
    baseAccuracy: 88,
    baseDamage: 1,
    reachTiles: 2.0,
    staminaCost: 10,
    staggerImpact: 4,
    weight: 1.5,
    durability: 80,
    twoHanded: true,
  },
];

// IDs added to inventory when starting a fresh game (no save).
export const STARTING_WEAPON_IDS: Record<string, number> = {
  copper_sword: 1,
  copper_dagger: 1,
  copper_axe: 1,
  copper_hammer: 1,
  copper_spear: 1,
};

export const WEAPON_ITEMS: ItemDefinition[] = MATERIAL_TIERS.flatMap((material) =>
  ARCHETYPES.map((weapon) => makeWeaponDefinition(material, weapon)),
);

function makeWeaponDefinition(
  material: MaterialTier,
  weapon: WeaponArchetypeConfig,
): ItemDefinition {
  const materialIndex = material.rank - 1;
  const id = `${material.id}_${weapon.archetype}`;
  const requiredLevel = materialIndex * 10 + 1;
  const damage = weapon.baseDamage + materialIndex;
  const accuracyRating = weapon.baseAccuracy + material.accuracyBonus;
  const staggerImpact = weapon.staggerImpact + materialIndex;
  const weight = roundTenth(weapon.weight * material.weightMultiplier);

  return {
    id,
    name: `${material.displayName} ${weapon.displayName}`,
    examine: `${weapon.examine} Requires rank ${material.rank} melee handling.`,
    icon: weapon.icon,
    category: 'equipment',
    stackable: false,
    weight,
    value: Math.round(10 * material.valueMultiplier * (1 + weapon.baseDamage * 0.2)),
    equipment: {
      slot: 'main_hand',
      requiredLevel,
      ...(weapon.twoHanded ? { twoHanded: true } : {}),
      weaponStats: {
        archetype: weapon.archetype,
        attackShape: weapon.attackShape,
        damage,
        damageType: weapon.damageType,
        reachTiles: weapon.reachTiles,
        staminaCost: weapon.staminaCost,
        staggerImpact,
        weight,
        durability: weapon.durability + materialIndex * 10,
        maxDurability: 100 + materialIndex * 10,
        accuracyRating,
      },
    },
  };
}

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}
