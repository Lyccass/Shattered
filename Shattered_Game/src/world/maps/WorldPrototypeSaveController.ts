import {
  createPrototypeSaveV1,
  restorePrototypeSaveV1,
} from '../../persistence/PrototypeSaveV1';
import {
  resolvePrototypeRestoreMap,
  resolvePrototypeRestoreTile,
} from '../../persistence/RestoreSafety';
import type { PlayerTileSaveState, SaveGameV1 } from '../../persistence/SaveTypes';
import type { PlayerSessionState } from '../../player/PlayerSessionState';
import type { WorldSessionState } from '../session/WorldSessionState';
import { hasMapDefinition } from './MapDefinitions';

export type RestorePrototypeSaveResult =
  | { ok: true; message: string; warnings: string[] }
  | { ok: false; message: string };

type WorldPrototypeSaveControllerDeps = {
  playerSessionState: PlayerSessionState;
  worldSessionState: WorldSessionState;
  getCurrentMapId: () => string;
  getCurrentPlayerTileSnapshot: () => PlayerTileSaveState;
  loadMap: (mapId: string, spawnId: string) => void;
  isRestorablePlayerTile: (tile: PlayerTileSaveState) => boolean;
  setPlayerToTile: (tile: PlayerTileSaveState) => void;
  recenterCameraOnPlayer: () => void;
  updatePlayerRuntimeState: () => void;
};

const DEFAULT_PROTOTYPE_RESTORE_MAP_ID = 'test_home_island';

export class WorldPrototypeSaveController {
  constructor(private readonly deps: WorldPrototypeSaveControllerDeps) {}

  createSnapshot(nowMs: number): SaveGameV1 {
    return createPrototypeSaveV1({
      playerSessionState: this.deps.playerSessionState,
      worldSessionState: this.deps.worldSessionState,
      currentMapId: this.deps.getCurrentMapId(),
      playerTile: this.deps.getCurrentPlayerTileSnapshot(),
      nowMs,
    });
  }

  restoreSnapshot(saveGame: SaveGameV1, nowMs: number): RestorePrototypeSaveResult {
    try {
      const mapResolution = resolvePrototypeRestoreMap({
        savedMapId: saveGame.playerState.currentMapId,
        defaultMapId: DEFAULT_PROTOTYPE_RESTORE_MAP_ID,
        hasMap: hasMapDefinition,
      });
      const warnings = mapResolution.warningMessage ? [mapResolution.warningMessage] : [];

      this.deps.loadMap(mapResolution.mapId, 'default');

      const restore = restorePrototypeSaveV1(saveGame, {
        playerSessionState: this.deps.playerSessionState,
        worldSessionState: this.deps.worldSessionState,
        nowMs,
      });

      if (!restore.ok) {
        return {
          ok: false,
          message: restore.error,
        };
      }

      const tileResolution = resolvePrototypeRestoreTile({
        savedTile: saveGame.playerState.playerTile,
        isTileValid: this.deps.isRestorablePlayerTile,
      });

      if (tileResolution.warningMessage) {
        warnings.push(tileResolution.warningMessage);
      }

      if (tileResolution.playerTile) {
        this.deps.setPlayerToTile(tileResolution.playerTile);
      } else {
        this.deps.recenterCameraOnPlayer();
      }

      this.deps.updatePlayerRuntimeState();

      return {
        ok: true,
        message: 'Save loaded.',
        warnings,
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Failed to restore saved game.',
      };
    }
  }
}
