import {
  ABILITY_DEFINITIONS,
  type AbilityDefinition,
  type AbilitySlotType,
  getAbilityDefinition,
  isAbilityUnlocked,
} from '../combat/abilities/CombatAbilityDefinitions';
import type { TurnCombatAbility } from '../combat/turn/TurnCombatTypes';
import type { SkillId } from '../skills/SkillTypes';
import { levelToRankStage } from '../skills/SkillTypes';

export type SpellbookLoadoutSaveState = {
  combatSpellIds?: Array<string | null>;
  utilitySpellIds?: Array<string | null>;
  devotionAbilityIds?: Array<string | null>;
};

export type SpellbookSlotSnapshot = {
  slotType: AbilitySlotType;
  slotIndex: number;
  abilityId: string | null;
};

export type SpellbookAbilityOptionSnapshot = {
  id: string;
  displayName: string;
  description: string;
  slotType: AbilitySlotType;
  skillId: SkillId;
  levelRequired: number;
  utilityMagicCost?: number;
  unlocked: boolean;
  equipped: boolean;
};

export type SpellbookSnapshot = {
  combatSlots: SpellbookSlotSnapshot[];
  utilitySlots: SpellbookSlotSnapshot[];
  devotionSlots: SpellbookSlotSnapshot[];
  options: SpellbookAbilityOptionSnapshot[];
};

export function emptySpellbookSnapshot(): SpellbookSnapshot {
  return {
    combatSlots: [],
    utilitySlots: [],
    devotionSlots: [],
    options: [],
  };
}

const COMBAT_SPELL_SLOTS = 3;
const UTILITY_SPELL_SLOTS = 3;
const DEVOTION_SLOTS = 3;

export class PlayerSpellbookState {
  private combatSpellIds: Array<string | null> = ['spell_spark', null, null];
  private utilitySpellIds: Array<string | null> = ['utility_identify', null, null];
  private devotionAbilityIds: Array<string | null> = ['devotion_mend', null, null];

  getSnapshot(getSkillLevel: (skillId: SkillId) => number): SpellbookSnapshot {
    this.pruneLocked(getSkillLevel);
    const equipped = new Set(this.getActiveEquippedIds(getSkillLevel));

    return {
      combatSlots: this.buildSlots('combat_spell', this.combatSpellIds, getAvailableSlotCount('combat_spell', getSkillLevel)),
      utilitySlots: this.buildSlots('utility_spell', this.utilitySpellIds, getAvailableSlotCount('utility_spell', getSkillLevel)),
      devotionSlots: this.buildSlots('devotion', this.devotionAbilityIds, getAvailableSlotCount('devotion', getSkillLevel)),
      options: ABILITY_DEFINITIONS.map((definition) => ({
        id: definition.id,
        displayName: definition.displayName,
        description: definition.description,
        slotType: definition.slotType,
        skillId: definition.skillId,
        levelRequired: definition.levelRequired,
        utilityMagicCost: definition.utilityMagicCost,
        unlocked: isAbilityUnlocked(definition, getSkillLevel),
        equipped: equipped.has(definition.id),
      })),
    };
  }

  getEquippedTurnAbilities(getSkillLevel: (skillId: SkillId) => number): TurnCombatAbility[] {
    this.pruneLocked(getSkillLevel);
    return [
      ...this.combatSpellIds.slice(0, getAvailableSlotCount('combat_spell', getSkillLevel)),
      ...this.devotionAbilityIds.slice(0, getAvailableSlotCount('devotion', getSkillLevel)),
    ]
      .map((id) => id ? getAbilityDefinition(id) : undefined)
      .filter((definition): definition is AbilityDefinition =>
        !!definition?.turnAbility && isAbilityUnlocked(definition, getSkillLevel),
      )
      .map((definition) => ({ ...definition.turnAbility! }));
  }

  equip(
    slotType: AbilitySlotType,
    slotIndex: number,
    abilityId: string | null,
    getSkillLevel: (skillId: SkillId) => number,
  ): boolean {
    const slots = this.getSlots(slotType);
    if (!slots || slotIndex < 0 || slotIndex >= slots.length) return false;
    if (slotIndex >= getAvailableSlotCount(slotType, getSkillLevel)) return false;

    if (abilityId === null) {
      slots[slotIndex] = null;
      return true;
    }

    const definition = getAbilityDefinition(abilityId);
    if (!definition) return false;
    if (definition.slotType !== slotType) return false;
    if (!isAbilityUnlocked(definition, getSkillLevel)) return false;
    if (this.getActiveEquippedIds(getSkillLevel).includes(abilityId)) return false;

    slots[slotIndex] = abilityId;
    return true;
  }

  createSaveSnapshot(): SpellbookLoadoutSaveState {
    return {
      combatSpellIds: [...this.combatSpellIds],
      utilitySpellIds: [...this.utilitySpellIds],
      devotionAbilityIds: [...this.devotionAbilityIds],
    };
  }

  restoreSaveSnapshot(snapshot: SpellbookLoadoutSaveState | undefined): void {
    if (!snapshot) return;
    this.combatSpellIds = sanitizeSlots(snapshot.combatSpellIds, COMBAT_SPELL_SLOTS);
    this.utilitySpellIds = sanitizeSlots(snapshot.utilitySpellIds, UTILITY_SPELL_SLOTS);
    this.devotionAbilityIds = sanitizeSlots(snapshot.devotionAbilityIds, DEVOTION_SLOTS);
  }

  private pruneLocked(getSkillLevel: (skillId: SkillId) => number): void {
    this.combatSpellIds = this.combatSpellIds.map((id) => this.isValidEquippedId(id, 'combat_spell', getSkillLevel) ? id : null);
    this.utilitySpellIds = this.utilitySpellIds.map((id) => this.isValidEquippedId(id, 'utility_spell', getSkillLevel) ? id : null);
    this.devotionAbilityIds = this.devotionAbilityIds.map((id) => this.isValidEquippedId(id, 'devotion', getSkillLevel) ? id : null);
  }

  private isValidEquippedId(
    id: string | null,
    slotType: AbilitySlotType,
    getSkillLevel: (skillId: SkillId) => number,
  ): boolean {
    if (!id) return false;
    const definition = getAbilityDefinition(id);
    return !!definition && definition.slotType === slotType && isAbilityUnlocked(definition, getSkillLevel);
  }

  private buildSlots(
    slotType: AbilitySlotType,
    ids: Array<string | null>,
    availableSlotCount: number,
  ): SpellbookSlotSnapshot[] {
    return ids
      .slice(0, availableSlotCount)
      .map((abilityId, slotIndex) => ({ slotType, slotIndex, abilityId }));
  }

  private getSlots(slotType: AbilitySlotType): Array<string | null> | null {
    switch (slotType) {
      case 'combat_spell': return this.combatSpellIds;
      case 'utility_spell': return this.utilitySpellIds;
      case 'devotion': return this.devotionAbilityIds;
    }
  }

  private getActiveEquippedIds(getSkillLevel: (skillId: SkillId) => number): string[] {
    return [
      ...this.combatSpellIds.slice(0, getAvailableSlotCount('combat_spell', getSkillLevel)),
      ...this.utilitySpellIds.slice(0, getAvailableSlotCount('utility_spell', getSkillLevel)),
      ...this.devotionAbilityIds.slice(0, getAvailableSlotCount('devotion', getSkillLevel)),
    ].filter((id): id is string => !!id);
  }
}

function getAvailableSlotCount(
  slotType: AbilitySlotType,
  getSkillLevel: (skillId: SkillId) => number,
): number {
  const skillId: SkillId = slotType === 'devotion' ? 'devotion' : 'magic';
  const rank = levelToRankStage(getSkillLevel(skillId)).rank;
  if (rank >= 7) return 3;
  if (rank >= 4) return 2;
  return 1;
}

function sanitizeSlots(ids: Array<string | null> | undefined, length: number): Array<string | null> {
  const result = new Array<string | null>(length).fill(null);
  if (!Array.isArray(ids)) return result;

  for (let index = 0; index < length; index += 1) {
    const id = ids[index];
    result[index] = typeof id === 'string' ? id : null;
  }

  return result;
}
