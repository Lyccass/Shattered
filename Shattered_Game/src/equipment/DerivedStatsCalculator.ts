import type { EquippedSlots, PlayerDerivedStats, WeaponArchetype, WeaponAttackShape } from './EquipmentTypes';
import type { EquipmentRegistry } from './EquipmentRegistry';

const MIN_MAX_HP = 10;
const HARD_MAX_HP = 100;
const BASE_MAX_STAMINA = 100;
const BASE_ATTACK = 1;
const BASE_ACCURACY = 50;
const BASE_ATTACK_SPEED_MS = 1000;
const BASE_REACH_TILES = 1.0;
const BASE_ATTACK_STAMINA_COST = 12;
const BASE_MAX_CARRY_WEIGHT = 20;
const BASE_STAGGER_THRESHOLD = 100;

const MIN_RECOVERY_MS  = 200;
const DEFAULT_ARCHETYPE: WeaponArchetype = 'sword';
const DEFAULT_ATTACK_SHAPE: WeaponAttackShape = { kind: 'arc', angleDeg: 180, rangeTiles: 1.5 };

function getArchetypeTimings(archetype: WeaponArchetype): { windupMs: number; activeMs: number } {
  switch (archetype) {
    case 'hammer': return { windupMs: 600, activeMs: 200 };
    case 'sword':  return { windupMs: 400, activeMs: 200 };
    case 'axe':    return { windupMs: 350, activeMs: 180 };
    case 'spear':  return { windupMs: 150, activeMs: 200 };
    case 'dagger': return { windupMs: 100, activeMs: 160 };
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

  const attack = (weapon?.damage ?? BASE_ATTACK) + Math.floor(meleeLevel / 10);
  const accuracy = Math.min(99, BASE_ACCURACY + Math.floor(meleeLevel * 0.4));
  const attackSpeedMs = weapon?.attackSpeedMs ?? BASE_ATTACK_SPEED_MS;
  const weaponArchetype: WeaponArchetype = weapon?.archetype ?? DEFAULT_ARCHETYPE;
  const attackShape: WeaponAttackShape = weapon?.attackShape ?? DEFAULT_ATTACK_SHAPE;
  const damageType = weapon?.damageType ?? 'slash';
  const { windupMs: attackWindupMs, activeMs: attackActiveMs } = getArchetypeTimings(weaponArchetype);
  const attackRecoveryMs = Math.max(MIN_RECOVERY_MS, attackSpeedMs - attackWindupMs - attackActiveMs);
  const reachTiles = weapon?.reachTiles ?? BASE_REACH_TILES;
  const attackStaminaCost = weapon?.staminaCost ?? BASE_ATTACK_STAMINA_COST;

  // Accumulate armour stats from all slots
  let physicalDefence = 0;
  let slashDefence = 0;
  let pierceDefence = 0;
  let crushDefence = 0;
  let poisonResistance = 0;
  let fireResistance = 0;
  let coldResistance = 0;
  let armorDodge = 0;
  let poise = 0;
  let carryWeight = weapon?.weight ?? 0;

  for (const itemId of Object.values(slots) as string[]) {
    const def = registry.get(itemId);
    const a = def?.equipment?.armorStats;
    if (!a) continue;
    physicalDefence += a.physicalDefence;
    slashDefence    += a.typeDefence.slash;
    pierceDefence   += a.typeDefence.pierce;
    crushDefence    += a.typeDefence.crush;
    poisonResistance += a.elementalResistance.poison;
    fireResistance  += a.elementalResistance.fire;
    coldResistance  += a.elementalResistance.cold;
    armorDodge      += a.dodgeBonus;
    poise           += a.poise;
    carryWeight     += a.weight;
  }

  const dodgeChance = skillDodge + armorDodge;

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
    maxStamina: BASE_MAX_STAMINA,
    attack,
    accuracy,
    attackSpeedMs,
    attackWindupMs,
    attackActiveMs,
    attackRecoveryMs,
    weaponArchetype,
    attackShape,
    damageType,
    reachTiles,
    attackStaminaCost,
    dodgeChance,
    physicalDefence,
    slashDefence,
    pierceDefence,
    crushDefence,
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
