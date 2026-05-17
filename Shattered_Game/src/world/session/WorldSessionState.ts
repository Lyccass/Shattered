import type { WorldMapSnapshotState } from '../../persistence/SaveTypes';
import type { ResourceNodeChunkLocator } from '../../persistence/WorldChunkSnapshotUtils';

export type RuntimePlacedObjectKind = 'placed_firestarter_set' | 'campfire';

export type RuntimePlacedObjectRecord = {
  id: string;
  mapId: string;
  tileX: number;
  tileY: number;
  objectDefinitionId: string;
  kind: RuntimePlacedObjectKind;
  despawnAtMs: number;
};

export class WorldSessionState {
  private readonly resourceRespawnAtByMap = new Map<string, Map<string, number>>();
  private readonly placedObjectsByMap = new Map<string, Map<string, RuntimePlacedObjectRecord>>();
  private readonly nextPlacedObjectSequenceByMap = new Map<string, number>();

  getResourceRespawnAt(mapId: string, nodeId: string): number | null {
    return this.resourceRespawnAtByMap.get(mapId)?.get(nodeId) ?? null;
  }

  setResourceRespawnAt(mapId: string, nodeId: string, respawnAtMs: number): void {
    this.getOrCreateRespawnMap(mapId).set(nodeId, respawnAtMs);
  }

  clearResourceRespawnAt(mapId: string, nodeId: string): boolean {
    return this.resourceRespawnAtByMap.get(mapId)?.delete(nodeId) ?? false;
  }

  getResourceRespawnSnapshot(mapId: string): Record<string, number> {
    return Object.fromEntries(this.resourceRespawnAtByMap.get(mapId)?.entries() ?? []);
  }

  addPlacedObject(record: RuntimePlacedObjectRecord): void {
    this.getOrCreateObjectMap(record.mapId).set(record.id, clonePlacedObjectRecord(record));
  }

  updatePlacedObject(
    mapId: string,
    id: string,
    patch: Partial<Omit<RuntimePlacedObjectRecord, 'id' | 'mapId'>>,
  ): boolean {
    const map = this.placedObjectsByMap.get(mapId);

    if (!map) {
      return false;
    }

    const existing = map.get(id);

    if (!existing) {
      return false;
    }

    map.set(id, clonePlacedObjectRecord({
      ...existing,
      ...patch,
    }));
    return true;
  }

  removePlacedObject(mapId: string, id: string): boolean {
    return this.placedObjectsByMap.get(mapId)?.delete(id) ?? false;
  }

  getPlacedObjectSnapshot(mapId: string, id: string): RuntimePlacedObjectRecord | undefined {
    const record = this.placedObjectsByMap.get(mapId)?.get(id);
    return record ? clonePlacedObjectRecord(record) : undefined;
  }

  getPlacedObjectsSnapshot(mapId: string): RuntimePlacedObjectRecord[] {
    const map = this.placedObjectsByMap.get(mapId);
    return map ? Array.from(map.values(), clonePlacedObjectRecord) : [];
  }

  getNextPlacedObjectSequence(mapId: string): number {
    const nextSequence = this.nextPlacedObjectSequenceByMap.get(mapId) ?? 1;
    this.nextPlacedObjectSequenceByMap.set(mapId, nextSequence + 1);
    return nextSequence;
  }

  createWorldMapSnapshot(
    worldId: string,
    nowMs: number,
    locateResourceNodeChunk: ResourceNodeChunkLocator,
  ): WorldMapSnapshotState {
    const changedRegions: WorldMapSnapshotState['changedRegions'] = {};

    for (const [mapId, respawnMap] of this.resourceRespawnAtByMap.entries()) {
      for (const [nodeId, respawnAt] of respawnMap.entries()) {
        if (respawnAt <= nowMs) {
          continue;
        }

        const location = locateResourceNodeChunk(mapId, nodeId);

        if (!location) {
          continue;
        }

        const region = changedRegions[location.regionId] ?? {
          regionId: location.regionId,
          changedChunks: {},
        };
        const chunk = region.changedChunks[location.chunkKey] ?? {
          chunkKey: location.chunkKey,
          depletedResources: {},
        };

        chunk.depletedResources[nodeId] = { respawnAt };
        region.changedChunks[location.chunkKey] = chunk;
        changedRegions[location.regionId] = region;
      }
    }

    return {
      worldId,
      changedRegions,
    };
  }

  restoreWorldMapSnapshot(
    snapshot: WorldMapSnapshotState,
    nowMs: number,
    locateResourceNodeChunk: ResourceNodeChunkLocator,
  ): void {
    this.clearAll();

    Object.entries(snapshot.changedRegions).forEach(([regionId, regionSnapshot]) => {
      Object.entries(regionSnapshot.changedChunks).forEach(([chunkKey, chunkSnapshot]) => {
        Object.entries(chunkSnapshot.depletedResources).forEach(([nodeId, depletedResource]) => {
          if (depletedResource.respawnAt <= nowMs) {
            return;
          }

          const location = locateResourceNodeChunk(regionId, nodeId);

          if (!location || location.chunkKey !== chunkKey) {
            return;
          }

          this.setResourceRespawnAt(regionId, nodeId, depletedResource.respawnAt);
        });
      });
    });
  }

  clearAll(): void {
    this.resourceRespawnAtByMap.clear();
    this.placedObjectsByMap.clear();
    this.nextPlacedObjectSequenceByMap.clear();
  }

  private getOrCreateRespawnMap(mapId: string): Map<string, number> {
    const existing = this.resourceRespawnAtByMap.get(mapId);

    if (existing) {
      return existing;
    }

    const map = new Map<string, number>();
    this.resourceRespawnAtByMap.set(mapId, map);
    return map;
  }

  private getOrCreateObjectMap(mapId: string): Map<string, RuntimePlacedObjectRecord> {
    const existing = this.placedObjectsByMap.get(mapId);
    if (existing) return existing;
    const map = new Map<string, RuntimePlacedObjectRecord>();
    this.placedObjectsByMap.set(mapId, map);
    return map;
  }
}

function clonePlacedObjectRecord(record: RuntimePlacedObjectRecord): RuntimePlacedObjectRecord {
  return { ...record };
}
