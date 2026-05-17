export const PROTOTYPE_SAVE_VERSION = 1;
export const DEFAULT_WORLD_ID = 'the_wake';
export const DEFAULT_PERSONAL_ISLAND_ID = 'player_home_island';

export type SaveValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export type PlayerTileSaveState = {
  tileX: number;
  tileY: number;
};

export type ActiveEffectSaveState = {
  effectId: string;
  remainingMs: number;
};

export type TaskJournalSaveState = {
  acceptedContractIds: string[];
  completedNonRepeatableContractIds: string[];
  contractCompletionCounts: Record<string, number>;
};

export type PlayerSaveState = {
  currentWorldId: string;
  currentMapId: string;
  playerTile: PlayerTileSaveState;
  resources: Record<string, number>;
  items: Record<string, number>;
  currency: Record<string, number>;
  reputation: Record<string, number>;
  skillXp: Record<string, number>;
  journal: TaskJournalSaveState;
  activeEffects: ActiveEffectSaveState[];
};

export type PersonalIslandPlacedObjectSaveState = {
  id: string;
  definitionId: string;
  tileX: number;
  tileY: number;
  state?: Record<string, unknown>;
};

export type PersonalIslandSaveState = {
  islandId: string;
  persistentPlacedObjects: PersonalIslandPlacedObjectSaveState[];
  terrainEdits: unknown[];
  buildings: unknown[];
  storage: Record<string, number>;
};

export type WorldChunkResourceRespawnSaveState = {
  respawnAt: number;
};

export type WorldChunkSnapshotState = {
  chunkKey: string;
  depletedResources: Record<string, WorldChunkResourceRespawnSaveState>;
  changedFlags?: Record<string, string | number | boolean>;
};

export type WorldRegionSnapshotState = {
  regionId: string;
  changedChunks: Record<string, WorldChunkSnapshotState>;
};

export type WorldMapSnapshotState = {
  worldId: string;
  changedRegions: Record<string, WorldRegionSnapshotState>;
};

export type SaveGameV1 = {
  version: typeof PROTOTYPE_SAVE_VERSION;
  savedAt: number;
  playerState: PlayerSaveState;
  personalIslandState: PersonalIslandSaveState;
  worldMapSnapshot: WorldMapSnapshotState;
};

export function createEmptyPersonalIslandSaveState(
  islandId = DEFAULT_PERSONAL_ISLAND_ID,
): PersonalIslandSaveState {
  return {
    islandId,
    persistentPlacedObjects: [],
    terrainEdits: [],
    buildings: [],
    storage: {},
  };
}
