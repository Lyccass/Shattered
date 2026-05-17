import type { PlayerSessionState } from '../player/PlayerSessionState';
import type { WorldSessionState } from '../world/session/WorldSessionState';
import {
  DEFAULT_PERSONAL_ISLAND_ID,
  DEFAULT_WORLD_ID,
  PROTOTYPE_SAVE_VERSION,
  createEmptyPersonalIslandSaveState,
  type PlayerTileSaveState,
  type SaveGameV1,
  type SaveValidationResult,
} from './SaveTypes';
import { validateSaveGameV1 } from './SaveValidation';
import { createStaticWorldResourceNodeChunkLocator } from './WorldChunkSnapshotUtils';

type CreatePrototypeSaveParams = {
  playerSessionState: PlayerSessionState;
  worldSessionState: WorldSessionState;
  currentMapId: string;
  playerTile: PlayerTileSaveState;
  nowMs: number;
  currentWorldId?: string;
  personalIslandId?: string;
};

type RestorePrototypeSaveParams = {
  playerSessionState: PlayerSessionState;
  worldSessionState: WorldSessionState;
  nowMs: number;
};

export function createPrototypeSaveV1({
  playerSessionState,
  worldSessionState,
  currentMapId,
  playerTile,
  nowMs,
  currentWorldId = DEFAULT_WORLD_ID,
  personalIslandId = DEFAULT_PERSONAL_ISLAND_ID,
}: CreatePrototypeSaveParams): SaveGameV1 {
  const resourceNodeChunkLocator = createStaticWorldResourceNodeChunkLocator();

  return {
    version: PROTOTYPE_SAVE_VERSION,
    savedAt: nowMs,
    playerState: playerSessionState.createSaveState({
      currentWorldId,
      currentMapId,
      playerTile,
      nowMs,
    }),
    personalIslandState: createEmptyPersonalIslandSaveState(personalIslandId),
    worldMapSnapshot: worldSessionState.createWorldMapSnapshot(
      currentWorldId,
      nowMs,
      resourceNodeChunkLocator,
    ),
  };
}

export function restorePrototypeSaveV1(
  input: unknown,
  { playerSessionState, worldSessionState, nowMs }: RestorePrototypeSaveParams,
): SaveValidationResult<SaveGameV1> {
  const validation = validateSaveGameV1(input);

  if (!validation.ok) {
    return validation;
  }

  const resourceNodeChunkLocator = createStaticWorldResourceNodeChunkLocator();
  playerSessionState.restoreSaveState(validation.value.playerState, nowMs);
  worldSessionState.restoreWorldMapSnapshot(
    validation.value.worldMapSnapshot,
    nowMs,
    resourceNodeChunkLocator,
  );

  return validation;
}
