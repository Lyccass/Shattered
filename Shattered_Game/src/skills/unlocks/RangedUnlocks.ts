import type { SkillUnlockEntry } from '../SkillUnlockTypes';

const RANGED_WEAPON_TIERS = [
  'Pine',
  'Oak',
  'Ash',
  'Yew',
  'Redwood',
  'Blackwood',
  'Ebony',
] as const;

const RANGED_ARMOUR_TIERS = [
  'Rawhide',
  'Leather',
  'Thick Leather',
  'Boarhide',
  'Scalehide',
  'Drakehide',
  'Wyrmhide',
] as const;

export const RANGED_UNLOCKS: SkillUnlockEntry[] = RANGED_WEAPON_TIERS.flatMap((material, index) => {
  const rankRequired = index + 1;
  const armourMaterial = RANGED_ARMOUR_TIERS[index];
  return [
    {
      skillId: 'ranged',
      rankRequired,
      stageRequired: 1,
      kind: 'weapon',
      refId: `ranged_weapon_${slug(material)}`,
      displayName: `${material} Bows & Crossbows`,
      description: `Equip ${material.toLowerCase()} bows and crossbows.`,
    },
    {
      skillId: 'ranged',
      rankRequired,
      stageRequired: 1,
      kind: 'armor',
      refId: `ranged_armor_${slug(armourMaterial)}`,
      displayName: `${armourMaterial} Armour`,
      description: `Equip ${armourMaterial.toLowerCase()} ranged armour.`,
    },
  ] satisfies SkillUnlockEntry[];
});

function slug(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '_');
}
