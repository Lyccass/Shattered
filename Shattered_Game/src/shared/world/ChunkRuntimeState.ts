import type { ChunkCoordinate, ChunkKey } from './ChunkKey';
import { createChunkKey } from './ChunkKey';

export type WorldResourceRuntimeState = {
  nodeId: string;
  respawnAt: number;
};

export type WorldCreatureRuntimeState = {
  groupId: string;
  creatureFamilyId: string;
  maturityLevel: number;
  spawnedAt: number;
  lastMaturityTickAt: number;
  currentChunk: ChunkCoordinate;
  status: 'alive' | 'dead' | 'despawned' | 'migrating';
  migrationTarget?: ChunkCoordinate;
};

export type WorldChunkRuntimeState = {
  worldId: string;
  regionId: string;
  chunkX: number;
  chunkY: number;
  depletedResources?: Record<string, WorldResourceRuntimeState>;
  creatureGroups?: Record<string, WorldCreatureRuntimeState>;
  temporaryObjects?: Record<string, unknown>;
  openedChests?: Record<string, true>;
  localEventFlags?: Record<string, boolean | number | string>;
};

export type WorldRuntimeSnapshot = {
  worldId: string;
  changedChunks: Record<ChunkKey, WorldChunkRuntimeState>;
};

export function isResourceAvailableInRuntimeState(
  runtimeState: WorldChunkRuntimeState | null | undefined,
  nodeId: string,
  nowMs: number,
): boolean {
  const depletion = runtimeState?.depletedResources?.[nodeId];
  return !depletion || depletion.respawnAt <= nowMs;
}

export function pruneExpiredResourceDepletions(
  runtimeState: WorldChunkRuntimeState,
  nowMs: number,
): WorldChunkRuntimeState {
  const depletedResources = Object.fromEntries(
    Object.entries(runtimeState.depletedResources ?? {})
      .filter(([, depletion]) => depletion.respawnAt > nowMs),
  );

  return {
    ...runtimeState,
    depletedResources: Object.keys(depletedResources).length > 0 ? depletedResources : undefined,
  };
}

export function hasWorldChunkRuntimeChanges(runtimeState: WorldChunkRuntimeState): boolean {
  return (
    Object.keys(runtimeState.depletedResources ?? {}).length > 0 ||
    Object.keys(runtimeState.creatureGroups ?? {}).length > 0 ||
    Object.keys(runtimeState.temporaryObjects ?? {}).length > 0 ||
    Object.keys(runtimeState.openedChests ?? {}).length > 0 ||
    Object.keys(runtimeState.localEventFlags ?? {}).length > 0
  );
}

export function createWorldRuntimeSnapshot(
  worldId: string,
  chunks: readonly WorldChunkRuntimeState[],
  nowMs: number,
): WorldRuntimeSnapshot {
  const changedChunks = Object.fromEntries(
    chunks
      .map((chunk) => pruneExpiredResourceDepletions(chunk, nowMs))
      .filter(hasWorldChunkRuntimeChanges)
      .map((chunk) => [createChunkKey(chunk), chunk]),
  );

  return { worldId, changedChunks };
}
