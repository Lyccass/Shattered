export type NpcBehavior = 'stationary' | 'patrol';

export type NpcDialogueLine = {
  text: string;
  durationMs?: number;
};

export type NpcDefinition = {
  id: string;
  displayName: string;
  color: number;
  behavior: NpcBehavior;
  ambientLines: string[];
  dialogue: NpcDialogueLine[];
  /** If set, interacting with this NPC opens the shop with this ID. */
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
