import type {
  PlayerItemDelta,
  PlayerItemKey,
  PlayerInventoryDelta,
} from '../player/PlayerInventoryState';
import type { SkillXpDelta } from '../skills/SkillTypes';

export type ContractReward = {
  copper?: number;
  harborReputation?: number;
  itemDelta?: PlayerItemDelta;
  resourceDelta?: PlayerInventoryDelta;
  xpRewards?: SkillXpDelta;
};

export type ContractDefinition = {
  id: string;
  displayName: string;
  description: string;
  requiredItems?: Partial<Record<PlayerItemKey, number>>;
  requiredResources?: PlayerInventoryDelta;
  rewards: ContractReward;
  repeatable: boolean;
  interactionType: 'contract_board';
  tags: string[];
};
