export type NpcBehavior = 'stationary' | 'patrol';

export type NpcDialogueLine = {
  text: string;
  durationMs?: number;
};

export type NpcDialogueOptionOutcome =
  | { kind: 'close' }
  | { kind: 'shop'; shopId: string }
  | { kind: 'reply'; npcText: string }
  | { kind: 'contract_board'; boardId: string };

export type NpcDialogueOption = {
  id: string;
  label: string;
  outcome: NpcDialogueOptionOutcome;
};

export type NpcDefinition = {
  id: string;
  displayName: string;
  color: number;
  behavior: NpcBehavior;
  ambientLines: string[];
  dialogue: NpcDialogueLine[];
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
