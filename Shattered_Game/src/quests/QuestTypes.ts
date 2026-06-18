import type { ReputationSnapshot } from '../player/PlayerReputationState';
import type { SkillId, SkillXpDelta } from '../skills/SkillTypes';

export type QuestId = string;
export type QuestPhaseId = string;
export type QuestObjectiveId = string;
/**
 * Stable event id emitted by world systems when a bespoke action succeeds.
 * Suggested prefixes:
 * - `interaction:<interactionType>` for generic target interactions
 * - `item_use:<itemId>` for direct inventory use
 * - `custom:<domain>:<action>` for bespoke puzzle/ritual beats
 */
export type QuestActionId = string;

export type QuestReputationFaction = keyof ReputationSnapshot;

export type QuestPrerequisite =
  | { kind: 'quest_complete'; questId: QuestId }
  | { kind: 'skill_level'; skillId: SkillId; level: number }
  | { kind: 'item_owned'; itemId: string; count?: number }
  | { kind: 'reputation'; faction: QuestReputationFaction; minimum: number };

export type QuestTargetRef =
  | { kind: 'npc'; npcId: string }
  | { kind: 'object'; objectId: string }
  | { kind: 'object_definition'; objectDefinitionId: string }
  | { kind: 'item'; itemId: string };

type BaseQuestObjective = {
  id: QuestObjectiveId;
  journalHint: string;
  completedLog: string;
};

export type KillQuestObjective = BaseQuestObjective & {
  kind: 'kill';
  enemyId: string;
  count: number;
};

export type KillWithItemQuestObjective = BaseQuestObjective & {
  kind: 'kill_with_item';
  enemyId: string;
  itemId: string;
  count: number;
  itemSource?: 'inventory' | 'equipment' | 'either';
};

export type KillCountAtQuestObjective = BaseQuestObjective & {
  kind: 'kill_count_at';
  count: number;
  enemyId?: string;
  mapId: string;
  areaId?: string;
};

export type FetchQuestObjective = BaseQuestObjective & {
  kind: 'fetch';
  itemId: string;
  count: number;
};

export type InteractQuestObjective = BaseQuestObjective & {
  kind: 'interact';
  target: QuestTargetRef;
};

export type TalkWithItemQuestObjective = BaseQuestObjective & {
  kind: 'talk_with_item';
  npcId: string;
  itemId: string;
  count?: number;
};

export type DeliverItemToQuestObjective = BaseQuestObjective & {
  kind: 'deliver_item_to';
  npcId: string;
  itemId: string;
  count: number;
};

export type PayCurrencyToQuestObjective = BaseQuestObjective & {
  kind: 'pay_currency_to';
  npcId: string;
  copper: number;
};

export type VisitQuestObjective = BaseQuestObjective & {
  kind: 'visit';
  mapId: string;
  areaId?: string;
};

export type DoActionAtQuestObjective = BaseQuestObjective & {
  kind: 'do_action_at';
  actionId: QuestActionId;
  mapId: string;
  areaId?: string;
  tile?: { tileX: number; tileY: number };
};

export type UseItemOnQuestObjective = BaseQuestObjective & {
  kind: 'use_item_on';
  itemId: string;
  target: QuestTargetRef;
};

export type CastSpellQuestObjective = BaseQuestObjective & {
  kind: 'cast_spell';
  spellId: string;
};

export type CastSpellAtQuestObjective = BaseQuestObjective & {
  kind: 'cast_spell_at';
  spellId: string;
  mapId: string;
  areaId?: string;
  tile?: { tileX: number; tileY: number };
};

export type SequenceQuestObjective = BaseQuestObjective & {
  kind: 'sequence';
  steps: QuestObjective[];
};

export type AnyOfQuestObjective = BaseQuestObjective & {
  kind: 'any_of';
  /**
   * Branches may progress independently; the first completed option completes
   * the wrapper. If a future quest needs exclusive branches, add an explicit
   * branch mode rather than inferring it from partial progress.
   */
  options: QuestObjective[];
};

export type QuestObjective =
  | KillQuestObjective
  | KillWithItemQuestObjective
  | KillCountAtQuestObjective
  | FetchQuestObjective
  | InteractQuestObjective
  | TalkWithItemQuestObjective
  | DeliverItemToQuestObjective
  | PayCurrencyToQuestObjective
  | VisitQuestObjective
  | DoActionAtQuestObjective
  | UseItemOnQuestObjective
  | CastSpellQuestObjective
  | CastSpellAtQuestObjective
  | SequenceQuestObjective
  | AnyOfQuestObjective;

export type QuestRewardUnlock =
  | { kind: 'recipe'; unlockId: string; displayName?: string }
  | { kind: 'place'; unlockId: string; displayName?: string }
  | { kind: 'activity'; unlockId: string; displayName?: string };

export type QuestReward = {
  copper?: number;
  harborReputation?: number;
  itemDelta?: Record<string, number>;
  xpRewards?: SkillXpDelta;
  unlocks?: QuestRewardUnlock[];
};

export type QuestPhaseDefinition = {
  id: QuestPhaseId;
  title: string;
  journalHint: string;
  completedLog: string;
  objectives: QuestObjective[];
  /**
   * If set, all objectives can be complete while the phase waits for the
   * player to return to this NPC. This keeps RuneScape-style chapter beats
   * explicit without adding UI trackers.
   */
  turnInNpcId?: string;
  startDialogue?: string;
  completeDialogue?: string;
};

export type QuestStartDefinition = {
  npcId?: string;
  dialogue: string;
};

export type QuestDefinition = {
  id: QuestId;
  displayName: string;
  description: string;
  start: QuestStartDefinition;
  prerequisites?: QuestPrerequisite[];
  phases: QuestPhaseDefinition[];
  rewards?: QuestReward;
  repeatable?: boolean;
  tags?: string[];
};

export type QuestObjectiveProgress = {
  count?: number;
  completed?: boolean;
  sequenceIndex?: number;
};

export type QuestRuntimeState = {
  phaseIndex: number;
  objectiveProgress: Record<string, QuestObjectiveProgress>;
};

export type QuestInteractionEvent = {
  target: QuestTargetRef;
};

export type QuestTalkWithItemEvent = {
  npcId: string;
  heldItemIds: string[];
};

export type QuestKillEvent = {
  enemyId: string;
  mapId?: string;
  areaId?: string;
};

export type QuestVisitEvent = {
  mapId: string;
  areaId?: string;
};

export type QuestActionAtEvent = {
  actionId: QuestActionId;
  mapId: string;
  areaId?: string;
  tile?: { tileX: number; tileY: number };
};

export type QuestUseItemOnEvent = {
  itemId: string;
  target: QuestTargetRef;
};

export type QuestSpellCastEvent = {
  spellId: string;
  mapId?: string;
  areaId?: string;
  tile?: { tileX: number; tileY: number };
};
