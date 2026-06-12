import type { TurnAttack } from '../combat/turn/TurnCombatTypes';

export type CompanionSlot = 'companion_1' | 'companion_2' | 'companion_3';

export type CompanionDefinition = {
  id: string;
  displayName: string;
  maxHp: number;
  attackPower: number;
  defensePower: number;
  /** Typed resistances — each defaults to defensePower when absent. */
  slashDefence?: number;
  pierceDefence?: number;
  crushDefence?: number;
  attackRangeTiles: number;
  initiative: number;
  apPerTurn: number;
  mpPerTurn: number;
  staggerThreshold: number;
  attacks: TurnAttack[];
  maxDurability: number;
};

export type CompanionSlotData = {
  definitionId: string;
  durability: number;
};

export type EquippedCompanionSlots = Partial<Record<CompanionSlot, CompanionSlotData>>;

export type CompanionSlotSnapshot = {
  definitionId: string;
  displayName: string;
  durability: number;
  maxDurability: number;
};

export type CompanionSnapshot = Partial<Record<CompanionSlot, CompanionSlotSnapshot>>;
