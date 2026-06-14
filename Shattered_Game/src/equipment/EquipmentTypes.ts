export type EquipmentSlot =
  | 'head'
  | 'back'
  | 'necklace'
  | 'ammo'
  | 'gloves'
  | 'body'
  | 'ring'
  | 'main_hand'
  | 'off_hand'
  | 'legs'
  | 'feet';

export const ALL_EQUIPMENT_SLOTS: EquipmentSlot[] = [
  'head', 'back', 'necklace', 'ammo',
  'gloves', 'body', 'ring',
  'main_hand', 'off_hand', 'legs', 'feet',
];

export type PhysicalDamageType = 'slash' | 'pierce' | 'crush';

export type WeaponArchetype = 'fists' | 'sword' | 'axe' | 'hammer' | 'spear' | 'dagger' | 'bow' | 'crossbow';

export const RANGED_ARCHETYPES: ReadonlySet<WeaponArchetype> = new Set(['bow', 'crossbow']);

// Shape of the player's attack hitbox — owned by each weapon definition.
// arc   = swinging weapon; creates a fan/cone in front of the player.
// thrust = stabbing weapon; creates a forward rectangle.
export type WeaponAttackShape =
  | { kind: 'arc';    angleDeg: number; rangeTiles: number; minRangeTiles?: number }
  | { kind: 'thrust'; lengthTiles: number; widthTiles: number; doubleHit?: true };

export type WeaponStats = {
  archetype: WeaponArchetype;
  attackShape: WeaponAttackShape;
  damage: number;
  damageType: PhysicalDamageType;
  reachTiles: number;
  staminaCost: number;
  staggerImpact: number;
  weight: number;
  durability: number;
  maxDurability: number;
  accuracyRating?: number; // flat base accuracy; falls back to archetype default
};

export type PhysicalTypeDefence = {
  slash: number;
  pierce: number;
  crush: number;
};

export type ElementalResistance = {
  poison: number;
  fire: number;
  cold: number;
  lightning: number;
};

export type ArmorStats = {
  dodgeBonus: number;
  typeDefence: PhysicalTypeDefence;
  elementalResistance: ElementalResistance;
  poise: number;
  weight: number;
  durability: number;
  maxDurability: number;
};

export type EquipmentDefinition = {
  id: string;
  displayName: string;
  description: string;
  slot: EquipmentSlot;
  requiredLevel: number;
  weaponStats?: WeaponStats;
  armorStats?: ArmorStats;
};

export type EquippedSlots = Partial<Record<EquipmentSlot, string>>;

export type EquippedSlotEntry = {
  itemId: string;
  displayName: string;
};

export type PlayerDerivedStats = {
  maxHp: number;
  combatLevel: number;
  combatStyleLevel: number;
  combatStyleRank: number;
  maxStamina: number;
  attack: number;
  accuracy: number;
  weaponArchetype: WeaponArchetype;
  attackShape: WeaponAttackShape;
  damageType: PhysicalDamageType;
  reachTiles: number;
  attackStaminaCost: number;
  staggerImpact: number;
  dodgeChance: number;
  slashDefence: number;
  pierceDefence: number;
  crushDefence: number;
  lightningDefence: number;
  fireDefence: number;
  coldDefence: number;
  poisonDefence: number;
  poisonResistance: number;
  fireResistance: number;
  coldResistance: number;
  carryWeight: number;
  maxCarryWeight: number;
  staminaRegenMultiplier: number;
  staggerThreshold: number;
  poise: number;
};

export type EquipmentSnapshot = {
  slots: Partial<Record<EquipmentSlot, EquippedSlotEntry>>;
  derivedStats: PlayerDerivedStats;
};

export function emptyDerivedStats(): PlayerDerivedStats {
  return {
    maxHp: 10,
    combatLevel: 1,
    combatStyleLevel: 0,
    combatStyleRank: 1,
    maxStamina: 100,
    attack: 1,
    accuracy: 40,
    weaponArchetype: 'fists',
    attackShape: { kind: 'thrust', lengthTiles: 1, widthTiles: 1 },
    damageType: 'crush',
    reachTiles: 1.0,
    attackStaminaCost: 12,
    staggerImpact: 1,
    dodgeChance: 0,
    slashDefence: 0,
    pierceDefence: 0,
    crushDefence: 0,
    lightningDefence: 0,
    fireDefence: 0,
    coldDefence: 0,
    poisonDefence: 0,
    poisonResistance: 0,
    fireResistance: 0,
    coldResistance: 0,
    carryWeight: 0,
    maxCarryWeight: 20,
    staminaRegenMultiplier: 1,
    staggerThreshold: 100,
    poise: 0,
  };
}

export function emptyEquipmentSnapshot(): EquipmentSnapshot {
  return { slots: {}, derivedStats: emptyDerivedStats() };
}
