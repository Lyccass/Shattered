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
  private readonly placedObjectsByMap = new Map<string, RuntimePlacedObjectRecord[]>();
  private readonly nextPlacedObjectSequenceByMap = new Map<string, number>();

  getResourceRespawnMap(mapId: string): Map<string, number> {
    const respawnMap = this.resourceRespawnAtByMap.get(mapId) ?? new Map<string, number>();
    this.resourceRespawnAtByMap.set(mapId, respawnMap);
    return respawnMap;
  }

  getPlacedObjects(mapId: string): RuntimePlacedObjectRecord[] {
    const placedObjects = this.placedObjectsByMap.get(mapId) ?? [];
    this.placedObjectsByMap.set(mapId, placedObjects);
    return placedObjects;
  }

  setPlacedObjects(mapId: string, placedObjects: RuntimePlacedObjectRecord[]): void {
    this.placedObjectsByMap.set(mapId, placedObjects);
  }

  getNextPlacedObjectSequence(mapId: string): number {
    const nextSequence = this.nextPlacedObjectSequenceByMap.get(mapId) ?? 1;
    this.nextPlacedObjectSequenceByMap.set(mapId, nextSequence + 1);
    return nextSequence;
  }
}
