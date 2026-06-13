import {
  RANGED_ARCHETYPES,
  type EquippedSlots,
  type PlayerDerivedStats,
  type WeaponArchetype,
  type WeaponAttackShape,
} from './EquipmentTypes';
import type { EquipmentRegistry } from './EquipmentRegistry';
import { levelToRankStage } from '../skills/SkillTypes';

const MIN_MAX_HP = 10;
const HARD_MAX_HP = 100;
const BASE_MAX_STAMINA = 100;
const BASE_ATTACK = 1;
const BASE_REACH_TILES = 1.0;
const BASE_ATTACK_STAMINA_COST = 12;
const BASE_STAGGER_IMPACT = 1;
const BASE_MAX_CARRY_WEIGHT = 20;
const BASE_STAGGER_THRESHOLD = 100;

const DEFAULT_ARCHETYPE: WeaponArchetype = 'fists';
const DEFAULT_ATTACK_SHAPE: WeaponAttackShape = { kind: 'thrust', lengthTiles: 1, widthTiles: 1 };

function getArchetypeBaseAccuracy(archetype: WeaponArchetype): number {
  switch (archetype) {
    case 'fists':  return 6;
    case 'dagger': return 9;
    case 'sword':  return 8;
    case 'axe':    return 7;
    case 'spear':  return 8;
    case 'hammer': return 7;
    case 'bow':    return 8;
  }
}

export type SkillLevels = {
  melee: number;
  ranged: number;
  magic: number;
  devotion: number;
};

export function computeDerivedStats(
  slots: EquippedSlots,
  registry: EquipmentRegistry,
  skills: SkillLevels,
): PlayerDerivedStats {
  const meleeLevel = Math.max(0, Math.min(100, skills.melee));
  const rangedLevel = Math.max(0, Math.min(100, skills.ranged));
  const magicLevel = Math.max(0, Math.min(100, skills.magic));
  const devotionLevel = Math.max(0, Math.min(100, skills.devotion));
  const combatLevel = Math.max(
    1,
    Math.floor((meleeLevel + rangedLevel + magicLevel + devotionLevel) / 4),
  );

  // Skill-driven base values
  const maxHp = Math.min(
    HARD_MAX_HP,
    MIN_MAX_HP + Math.floor(((combatLevel - 1) / 99) * (HARD_MAX_HP - MIN_MAX_HP)),
  );
  const maxCarryWeight = BASE_MAX_CARRY_WEIGHT + Math.floor(combatLevel * 0.3);
  const skillDodge = Math.floor(combatLevel * 0.2);
  const staggerThreshold = BASE_STAGGER_THRESHOLD + Math.floor(combatLevel * 0.5);

  // Weapon from main_hand slot
  const mainHandDef = slots.main_hand ? registry.get(slots.main_hand) : undefined;
  const weapon = mainHandDef?.equipment?.weaponStats;

  const weaponArchetype: WeaponArchetype = weapon?.archetype ?? DEFAULT_ARCHETYPE;
  const combatStyleLevel = RANGED_ARCHETYPES.has(weaponArchetype) ? rangedLevel : meleeLevel;
  const combatStyleRank = levelToRankStage(combatStyleLevel).rank;
  const weaponDamageBonus = Math.max(0, (weapon?.damage ?? BASE_ATTACK) - BASE_ATTACK);
  const attack = weapon
    ? Math.max(BASE_ATTACK, combatStyleRank + weaponDamageBonus)
    : getUnarmedMaxHit(combatStyleRank);
  const accuracy = Math.max(0, Math.floor((weapon?.accuracyRating ?? getArchetypeBaseAccuracy(weaponArchetype)) + combatStyleLevel));
  const attackShape: WeaponAttackShape = weapon?.attackShape ?? DEFAULT_ATTACK_SHAPE;
  const damageType = weapon?.damageType ?? 'crush';
  const reachTiles = weapon?.reachTiles ?? BASE_REACH_TILES;
  const attackStaminaCost = weapon?.staminaCost ?? BASE_ATTACK_STAMINA_COST;
  const staggerImpact = weapon?.staggerImpact ?? BASE_STAGGER_IMPACT;

  // Accumulate armour stats from all slots
  let slashDefence = 0;
  let pierceDefence = 0;
  let crushDefence = 0;
  let poisonResistance = 0;
  let fireResistance = 0;
  let coldResistance = 0;
  let lightningResistance = 0;
  let armorDodge = 0;
  let poise = 0;
  let carryWeight = weapon?.weight ?? 0;

  for (const itemId of Object.values(slots) as string[]) {
    const def = registry.get(itemId);
    const a = def?.equipment?.armorStats;
    if (!a) continue;
    slashDefence    += a.typeDefence.slash;
    pierceDefence   += a.typeDefence.pierce;
    crushDefence    += a.typeDefence.crush;
    poisonResistance += a.elementalResistance.poison;
    fireResistance  += a.elementalResistance.fire;
    coldResistance  += a.elementalResistance.cold;
    lightningResistance += a.elementalResistance.lightning;
    armorDodge      += a.dodgeBonus;
    poise           += a.poise;
    carryWeight     += a.weight;
  }

  const dodgeChance = skillDodge + armorDodge;
  slashDefence += meleeLevel;
  pierceDefence += meleeLevel;
  crushDefence += meleeLevel;

  // Stamina regen penalty from carry weight
  let staminaRegenMultiplier: number;
  if (carryWeight <= maxCarryWeight) {
    staminaRegenMultiplier = 1.0;
  } else if (carryWeight >= 2 * maxCarryWeight) {
    staminaRegenMultiplier = 0.0;
  } else {
    staminaRegenMultiplier = 1.0 - (carryWeight - maxCarryWeight) / maxCarryWeight;
  }

  return {
    maxHp,
    combatLevel,
    combatStyleLevel,
    combatStyleRank,
    maxStamina: BASE_MAX_STAMINA,
    attack,
    accuracy,
    weaponArchetype,
    attackShape,
    damageType,
    reachTiles,
    attackStaminaCost,
    staggerImpact,
    dodgeChance,
    slashDefence,
    pierceDefence,
    crushDefence,
    lightningDefence: lightningResistance,
    fireDefence:      fireResistance,
    coldDefence:      coldResistance,
    poisonDefence:    poisonResistance,
    poisonResistance,
    fireResistance,
    coldResistance,
    carryWeight: Math.round(carryWeight * 10) / 10,
    maxCarryWeight,
    staminaRegenMultiplier: Math.round(staminaRegenMultiplier * 100) / 100,
    staggerThreshold,
    poise,
  };
}

function getUnarmedMaxHit(combatStyleRank: number): number {
  return Math.max(BASE_ATTACK, combatStyleRank);
}
