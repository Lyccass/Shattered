import type { SkillId } from './SkillTypes';

export type UnlockKind =
  | 'recipe'
  | 'resource_node'
  | 'tool'
  | 'weapon'
  | 'armor'
  | 'misc'
  | 'passive'
  | 'combat_spell'
  | 'utility_spell'
  | 'devotion_ability';

export type SkillUnlockEntry = {
  skillId: SkillId;
  rankRequired: number;   // 1–10
  stageRequired: number;  // 1–10; unlock triggers when this rank+stage is first reached
  kind: UnlockKind;
  refId: string;          // recipe id, resource node type, item id, etc.
  displayName: string;
  description?: string;
};
