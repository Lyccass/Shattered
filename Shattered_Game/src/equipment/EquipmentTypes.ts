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

export type WeaponStats = {
  damage: number;
  damageType: PhysicalDamageType;
  attackSpeedMs: number;
  reachTiles: number;
  staminaCost: number;
  staggerImpact: number;
  weight: number;
  durability: number;
  maxDurability: number;
  specialAction?: string; // ID of the weapon's unique move; implemented per archetype
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
};

export type ArmorStats = {
  physicalDefence: number;
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
  maxStamina: number;
  attack: number;
  accuracy: number;
  attackSpeedMs: number;
  reachTiles: number;
  attackStaminaCost: number;
  dodgeChance: number;
  physicalDefence: number;
  slashDefence: number;
  pierceDefence: number;
  crushDefence: number;
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
    maxStamina: 100,
    attack: 1,
    accuracy: 50,
    attackSpeedMs: 1000,
    reachTiles: 1.0,
    attackStaminaCost: 12,
    dodgeChance: 0,
    physicalDefence: 0,
    slashDefence: 0,
    pierceDefence: 0,
    crushDefence: 0,
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
