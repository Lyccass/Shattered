import type { SkillXpDelta } from '../skills/SkillTypes';
import type { RegionEnvironmentVariable } from '../shared/world/RegionManifestTypes';

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
  /**
   * Region environment thresholds that must ALL be met for this contract to
   * appear on the board. Missing keys are treated as no requirement.
   * Example: { corruption: 25 } means the contract only appears when the
   * region's corruption value is at least 25.
   */
  minWorldState?: Partial<Record<RegionEnvironmentVariable, number>>;
};
