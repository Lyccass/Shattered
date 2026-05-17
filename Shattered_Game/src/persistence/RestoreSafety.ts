import type { PlayerTileSaveState } from './SaveTypes';

export type PrototypeRestoreMapResolution = {
  mapId: string;
  usedFallbackMap: boolean;
  warningMessage: string | null;
};

export type PrototypeRestoreTileResolution = {
  playerTile: PlayerTileSaveState | null;
  usedFallbackSpawn: boolean;
  warningMessage: string | null;
};

type ResolvePrototypeRestoreMapParams = {
  savedMapId: string;
  defaultMapId: string;
  hasMap: (mapId: string) => boolean;
};

type ResolvePrototypeRestoreTileParams = {
  savedTile: PlayerTileSaveState;
  isTileValid: (tile: PlayerTileSaveState) => boolean;
};

export function resolvePrototypeRestoreMap({
  savedMapId,
  defaultMapId,
  hasMap,
}: ResolvePrototypeRestoreMapParams): PrototypeRestoreMapResolution {
  if (hasMap(savedMapId)) {
    return {
      mapId: savedMapId,
      usedFallbackMap: false,
      warningMessage: null,
    };
  }

  return {
    mapId: defaultMapId,
    usedFallbackMap: true,
    warningMessage: `Saved map "${savedMapId}" is unavailable. Loaded ${defaultMapId} instead.`,
  };
}

export function resolvePrototypeRestoreTile({
  savedTile,
  isTileValid,
}: ResolvePrototypeRestoreTileParams): PrototypeRestoreTileResolution {
  if (isTileValid(savedTile)) {
    return {
      playerTile: savedTile,
      usedFallbackSpawn: false,
      warningMessage: null,
    };
  }

  return {
    playerTile: null,
    usedFallbackSpawn: true,
    warningMessage: `Saved tile ${savedTile.tileX},${savedTile.tileY} is invalid. Spawn fallback used instead.`,
  };
}
