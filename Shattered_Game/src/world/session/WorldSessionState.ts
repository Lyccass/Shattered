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

  // --- Resource respawn (unchanged) ---

  getResourceRespawnMap(mapId: string): Map<string, number> {
    const existing = this.resourceRespawnAtByMap.get(mapId);
    if (existing) return existing;
    const map = new Map<string, number>();
    this.resourceRespawnAtByMap.set(mapId, map);
    return map;
  }

  // --- Placed object API ---

  addPlacedObject(record: RuntimePlacedObjectRecord): void {
    this.getOrCreateObjectMap(record.mapId).set(record.id, { ...record });
  }

  updatePlacedObject(
    mapId: string,
    id: string,
    patch: Partial<Omit<RuntimePlacedObjectRecord, 'id' | 'mapId'>>,
  ): boolean {
    const map = this.placedObjectsByMap.get(mapId);
    const existing = map?.get(id);

    if (!existing) {
      return false;
    }

    map!.set(id, { ...existing, ...patch });
    return true;
  }

  removePlacedObject(mapId: string, id: string): boolean {
    return this.placedObjectsByMap.get(mapId)?.delete(id) ?? false;
  }

  getPlacedObjectById(mapId: string, id: string): RuntimePlacedObjectRecord | undefined {
    return this.placedObjectsByMap.get(mapId)?.get(id);
  }

  getPlacedObjects(mapId: string): RuntimePlacedObjectRecord[] {
    const map = this.placedObjectsByMap.get(mapId);
    return map ? Array.from(map.values()) : [];
  }

  // --- Sequence (unchanged) ---

  getNextPlacedObjectSequence(mapId: string): number {
    const nextSequence = this.nextPlacedObjectSequenceByMap.get(mapId) ?? 1;
    this.nextPlacedObjectSequenceByMap.set(mapId, nextSequence + 1);
    return nextSequence;
  }

  private getOrCreateObjectMap(mapId: string): Map<string, RuntimePlacedObjectRecord> {
    const existing = this.placedObjectsByMap.get(mapId);
    if (existing) return existing;
    const map = new Map<string, RuntimePlacedObjectRecord>();
    this.placedObjectsByMap.set(mapId, map);
    return map;
  }
}
