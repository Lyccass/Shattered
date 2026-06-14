import type { SkillId } from '../../skills/SkillTypes';
import type { TurnCombatAbility } from '../turn/TurnCombatTypes';

export type AbilitySlotType = 'combat_spell' | 'utility_spell' | 'devotion';

export type AbilityDefinition = {
  id: string;
  displayName: string;
  description: string;
  skillId: 'magic' | 'devotion';
  levelRequired: number;
  slotType: AbilitySlotType;
  utilityMagicCost?: number;
  turnAbility?: TurnCombatAbility;
};

export const ABILITY_DEFINITIONS: AbilityDefinition[] = [
  {
    id: 'spell_spark',
    displayName: 'Spark',
    description: 'A starter combat spell. Deals light ranged damage.',
    skillId: 'magic',
    levelRequired: 1,
    slotType: 'combat_spell',
    turnAbility: {
      id: 'spell_spark',
      displayName: 'Spark',
      kind: 'combat_spell',
      target: 'enemy',
      apCost: 1,
      magicCost: 1,
      minRangeTiles: 1,
      maxRangeTiles: 4,
      damage: 1,
      damageType: 'lightning',
      hitChance: 9,
      cooldownTurns: 2,
    },
  },
  {
    id: 'spell_barrier',
    displayName: 'Barrier',
    description: 'A defensive combat spell. Fortifies you for 2 turns.',
    skillId: 'magic',
    levelRequired: 5,
    slotType: 'combat_spell',
    turnAbility: {
      id: 'spell_barrier',
      displayName: 'Barrier',
      kind: 'combat_spell',
      target: 'self',
      apCost: 1,
      magicCost: 1,
      cooldownTurns: 3,
      statusEffect: {
        kind: 'fortified',
        turns: 2,
        value: 3,
      },
    },
  },
  {
    id: 'spell_concuss',
    displayName: 'Concuss',
    description: 'A combat spell that dazes the target. Stuns for 1 turn, preventing their next action.',
    skillId: 'magic',
    levelRequired: 3,
    slotType: 'combat_spell',
    turnAbility: {
      id: 'spell_concuss',
      displayName: 'Concuss',
      kind: 'combat_spell',
      target: 'enemy',
      apCost: 1,
      magicCost: 2,
      minRangeTiles: 1,
      maxRangeTiles: 3,
      hitChance: 7,
      cooldownTurns: 4,
      statusEffect: {
        kind: 'stunned',
        turns: 1,
        value: 1,
      },
    },
  },
  {
    id: 'utility_identify',
    displayName: 'Identify',
    description: 'Out-of-combat utility spell. Reveals creature rank, weakness, and more as Magic ranks up.',
    skillId: 'magic',
    levelRequired: 1,
    slotType: 'utility_spell',
    utilityMagicCost: 0,
  },
  {
    id: 'utility_homeward_mark',
    displayName: 'Homeward Mark',
    description: 'Out-of-combat utility spell. Marks a safe return point.',
    skillId: 'magic',
    levelRequired: 1,
    slotType: 'utility_spell',
    utilityMagicCost: 0,
  },
  {
    id: 'utility_waystep',
    displayName: 'Waystep',
    description: 'Out-of-combat utility spell. Helps with traversal between close tiles.',
    skillId: 'magic',
    levelRequired: 8,
    slotType: 'utility_spell',
    utilityMagicCost: 1,
  },
  {
    id: 'utility_camp_recall',
    displayName: 'Camp Recall',
    description: 'Out-of-combat utility spell. Recall to a prepared camp.',
    skillId: 'magic',
    levelRequired: 15,
    slotType: 'utility_spell',
    utilityMagicCost: 2,
  },
  {
    id: 'devotion_mend',
    displayName: 'Mend',
    description: 'A starter devotion ability. Restores a small amount of HP.',
    skillId: 'devotion',
    levelRequired: 1,
    slotType: 'devotion',
    turnAbility: {
      id: 'devotion_mend',
      displayName: 'Mend',
      kind: 'devotion',
      target: 'self',
      apCost: 1,
      devotionCost: 1,
      healAmount: 4,
      cooldownTurns: 3,
    },
  },
  {
    id: 'devotion_ward',
    displayName: 'Ward',
    description: 'A protective devotion ability. Reduces incoming hit chance for 2 turns.',
    skillId: 'devotion',
    levelRequired: 5,
    slotType: 'devotion',
    turnAbility: {
      id: 'devotion_ward',
      displayName: 'Ward',
      kind: 'devotion',
      target: 'self',
      apCost: 1,
      devotionCost: 1,
      cooldownTurns: 2,
      statusEffect: {
        kind: 'guarded',
        turns: 2,
        value: 4,
      },
    },
  },
];

const BY_ID = new Map(ABILITY_DEFINITIONS.map((definition) => [definition.id, definition]));

export function getAbilityDefinition(id: string): AbilityDefinition | undefined {
  return BY_ID.get(id);
}

export function getAbilityDefinitionsForSkill(skillId: SkillId): AbilityDefinition[] {
  return ABILITY_DEFINITIONS.filter((definition) => definition.skillId === skillId);
}

export function isAbilityUnlocked(
  ability: AbilityDefinition,
  getSkillLevel: (skillId: SkillId) => number,
): boolean {
  return getSkillLevel(ability.skillId) >= ability.levelRequired;
}
