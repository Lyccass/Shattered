import type { SkillXpDelta } from '../skills/SkillTypes';

export type ContractReward = {
  copper?: number;
  harborReputation?: number;
  itemDelta?: Record<string, number>;
  resourceDelta?: Record<string, number>;
  xpRewards?: SkillXpDelta;
};

export type ContractDefinition = {
  id: string;
  displayName: string;
  description: string;
  requiredItems?: Record<string, number>;
  requiredResources?: Record<string, number>;
  rewards: ContractReward;
  repeatable: boolean;
  interactionType: 'contract_board';
  tags: string[];
};
