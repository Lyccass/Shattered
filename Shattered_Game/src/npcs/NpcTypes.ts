import type { ReputationSnapshot } from '../player/PlayerReputationState';
import type { QuestId, QuestPhaseId } from '../quests/QuestTypes';
import type { SkillId } from '../skills/SkillTypes';

export type NpcBehavior = 'stationary' | 'patrol';

export type NpcDialogueLine = {
  text: string;
  durationMs?: number;
};

export type NpcDialogueOptionOutcome =
  | { kind: 'close' }
  | { kind: 'shop'; shopId: string }
  | { kind: 'reply'; npcText: string }
  | { kind: 'contract_board'; boardId: string }
  | { kind: 'quest'; questId: string };

export type NpcDialogueCondition =
  | { kind: 'quest_state'; questId: QuestId; state: 'not_started' | 'active' | 'completed' }
  | { kind: 'quest_phase'; questId: QuestId; phaseId: QuestPhaseId }
  | { kind: 'skill_level'; skillId: SkillId; level: number }
  | { kind: 'item_owned'; itemId: string; count?: number }
  | { kind: 'reputation'; faction: keyof ReputationSnapshot; minimum: number };

export type NpcDialogueQuestAction =
  | { kind: 'start_quest'; questId: QuestId }
  | { kind: 'continue_quest'; questId: QuestId };

export type NpcDialogueOption = {
  id: string;
  label: string;
  outcome: NpcDialogueOptionOutcome;
};

export type NpcDialogueTreeOption = {
  id: string;
  label: string;
  conditions?: NpcDialogueCondition[];
  unavailableMode?: 'disabled' | 'hidden';
  unavailableReason?: string;
  nextNodeId?: string;
  outcome?: NpcDialogueOptionOutcome;
  questAction?: NpcDialogueQuestAction;
  end?: boolean;
};

export type NpcDialogueTreeNode = {
  npcText: string;
  options: NpcDialogueTreeOption[];
};

export type NpcDialogueTree = {
  startNodeId: string;
  nodes: Record<string, NpcDialogueTreeNode>;
};

export type NpcDefinition = {
  id: string;
  displayName: string;
  color: number;
  behavior: NpcBehavior;
  ambientLines: string[];
  dialogue: NpcDialogueLine[];
  /** Branching dialogue for larger conversations and quest route gates. */
  dialogueTree?: NpcDialogueTree;
  /** Flat dialogue options presented to the player as a choice menu. */
  options?: NpcDialogueOption[];
  /** @deprecated use options with kind:'shop'. Still supported as fallback. */
  shopId?: string;
};

export type NpcRuntimeState = {
  id: string;
  definitionId: string;
  worldX: number;
  worldY: number;
  patrolTiles: Array<{ x: number; y: number }>;
  patrolIndex: number;
  nextWaypointMs: number;
  bubbleText: string | null;
  bubbleUntilMs: number;
  nextAmbientMs: number;
};
