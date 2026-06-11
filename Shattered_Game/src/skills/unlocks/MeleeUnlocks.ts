import type { SkillUnlockEntry } from '../SkillUnlockTypes';

const METAL_TIERS = [
  'Copper',
  'Iron',
  'Steel',
  'Cobalt',
  'Tungsten',
  'Adamant',
  'Titanite',
] as const;

export const MELEE_UNLOCKS: SkillUnlockEntry[] = METAL_TIERS.flatMap((material, index) => {
  const rankRequired = index + 1;
  return [
    {
      skillId: 'melee',
      rankRequired,
      stageRequired: 1,
      kind: 'weapon',
      refId: `melee_weapon_${material.toLowerCase()}`,
      displayName: `${material} Weapons`,
      description: `Equip ${material.toLowerCase()} melee weapons.`,
    },
    {
      skillId: 'melee',
      rankRequired,
      stageRequired: 1,
      kind: 'armor',
      refId: `melee_armor_${material.toLowerCase()}`,
      displayName: `${material} Armour`,
      description: `Equip ${material.toLowerCase()} melee armour.`,
    },
  ] satisfies SkillUnlockEntry[];
});
