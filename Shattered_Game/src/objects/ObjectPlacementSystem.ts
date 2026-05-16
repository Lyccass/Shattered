import { WorldGrid } from '../world/WorldGrid';
import { ObjectDebugRenderer } from './ObjectDebugRenderer';
import {
  evaluateStaticObjectPlacement,
  formatMapObjectPlacementError,
  getObjectFootprintTiles,
  type ObjectPlacementEvaluation,
} from './ObjectPlacementPolicy';
import { ObjectRegistry } from './ObjectRegistry';
import { ObjectRenderer } from './ObjectRenderer';
import type { ObjectDefinition, ObjectInstance } from './ObjectTypes';
import type { MapPlacedObject } from '../world/maps/MapTypes';

// ObjectPlacementSystem coordinates the lifecycle of static world objects:
//   - validates target tiles against WorldGrid
//   - creates ObjectInstances with stable ids
//   - registers blocking footprints with WorldGrid.blockTile(...)
//   - asks ObjectRenderer to draw visuals
//   - asks ObjectDebugRenderer to draw collision overlays
//
// This is the ONLY system that mutates the object-blocked tile registry —
// other systems read WorldGrid.isTileWalkable() but never call blockTile directly.
export class ObjectPlacementSystem {
  private readonly instances = new Map<string, ObjectInstance>();
  private readonly tileToInstances = new Map<string, Set<string>>();
  private nextSequence = 1;

  constructor(
    private readonly worldGrid: WorldGrid,
    private readonly registry: ObjectRegistry,
    private readonly renderer: ObjectRenderer,
    private readonly debugRenderer: ObjectDebugRenderer,
  ) {}

  placeObject(
    definitionId: string,
    tileX: number,
    tileY: number,
    instanceId?: string,
  ): ObjectInstance | null {
    const definition = this.registry.get(definitionId);

    if (!this.getPlacementEvaluation(definitionId, tileX, tileY).ok) {
      return null;
    }

    if (instanceId && this.instances.has(instanceId)) {
      throw new Error(`ObjectPlacementSystem: duplicate instance id "${instanceId}"`);
    }

    const instance: ObjectInstance = {
      id: instanceId ?? `${definition.id}#${this.nextSequence++}`,
      definitionId: definition.id,
      tileX,
      tileY,
      createdAt: Date.now(),
    };

    this.instances.set(instance.id, instance);
    this.indexFootprint(instance, definition);

    if (definition.blocksMovement) {
      for (const offset of definition.collisionFootprint) {
        this.worldGrid.blockTile(instance.tileX + offset.x, instance.tileY + offset.y, instance.id);
      }
    }

    this.renderer.render(instance, definition);
    if (definition.blocksMovement) {
      this.debugRenderer.render(instance, definition);
    }

    return instance;
  }

  placeAuthoredObject(mapId: string, mapObject: MapPlacedObject): ObjectInstance {
    const evaluation = this.getPlacementEvaluation(
      mapObject.definitionId,
      mapObject.tileX,
      mapObject.tileY,
    );

    if (!evaluation.ok) {
      throw new Error(
        formatMapObjectPlacementError({
          mapId,
          objectId: mapObject.id,
          definitionId: mapObject.definitionId,
          tileX: mapObject.tileX,
          tileY: mapObject.tileY,
          failure: evaluation.failure,
        }),
      );
    }

    const instance = this.placeObject(
      mapObject.definitionId,
      mapObject.tileX,
      mapObject.tileY,
      mapObject.id,
    );

    if (!instance) {
      throw new Error(
        `Map "${mapId}": object "${mapObject.id}" using definition "${mapObject.definitionId}" passed placement validation but failed to place at tile ${mapObject.tileX},${mapObject.tileY}. Suggested fix: inspect ObjectPlacementSystem for a rule mismatch.`,
      );
    }

    return instance;
  }

  removeObject(instanceId: string): boolean {
    const instance = this.instances.get(instanceId);
    if (!instance) return false;
    const definition = this.registry.get(instance.definitionId);

    if (definition.blocksMovement) {
      for (const offset of definition.collisionFootprint) {
        this.worldGrid.unblockTile(
          instance.tileX + offset.x,
          instance.tileY + offset.y,
          instance.id,
        );
      }
    }

    this.unindexFootprint(instance, definition);
    this.renderer.remove(instance.id);
    this.debugRenderer.remove(instance.id);
    this.instances.delete(instance.id);
    return true;
  }

  canPlaceObject(definitionId: string, tileX: number, tileY: number): boolean {
    return this.getPlacementEvaluation(definitionId, tileX, tileY).ok;
  }

  getPlacementEvaluation(
    definitionId: string,
    tileX: number,
    tileY: number,
  ): ObjectPlacementEvaluation {
    const definition = this.registry.get(definitionId);

    return evaluateStaticObjectPlacement(
      {
        isTileInBounds: (targetX, targetY) => this.worldGrid.isTileInBounds(targetX, targetY),
        isTerrainBlocked: (targetX, targetY) => this.worldGrid.isTerrainBlocked(targetX, targetY),
        getOccupyingObjectId: (targetX, targetY) => this.getFirstOccupyingObjectId(targetX, targetY),
      },
      definition,
      tileX,
      tileY,
    );
  }

  getInstance(instanceId: string): ObjectInstance | undefined {
    return this.instances.get(instanceId);
  }

  getInstances(): ObjectInstance[] {
    return Array.from(this.instances.values());
  }

  getInstanceCount(): number {
    return this.instances.size;
  }

  clear(): void {
    Array.from(this.instances.keys()).forEach((instanceId) => {
      this.removeObject(instanceId);
    });
    this.tileToInstances.clear();
  }

  getObjectAtTile(tileX: number, tileY: number): ObjectInstance | undefined {
    const ids = this.tileToInstances.get(tileKey(tileX, tileY));
    if (!ids || ids.size === 0) return undefined;
    const firstId = ids.values().next().value;
    if (firstId === undefined) return undefined;
    return this.instances.get(firstId);
  }

  // Debug helper: writes placement state to the console.
  debugLogPlacementInfo(): void {
    console.log('[ObjectPlacementSystem] instances:', this.instances.size);
    console.log('[WorldGrid] object-blocked tile count:', this.worldGrid.getObjectBlockedTileCount());

    for (const instance of this.instances.values()) {
      const def = this.registry.get(instance.definitionId);
      const footprintTiles = getObjectFootprintTiles(def, instance.tileX, instance.tileY)
        .map((tile) => `(${tile.x},${tile.y})`)
        .join(' ');
      const status = def.blocksMovement ? 'blocking' : 'non-blocking';
      console.log(`  ${instance.id}  ${status}  footprint=${footprintTiles}`);
    }
  }

  private indexFootprint(instance: ObjectInstance, definition: ObjectDefinition): void {
    for (const tile of getObjectFootprintTiles(definition, instance.tileX, instance.tileY)) {
      const key = tileKey(tile.x, tile.y);
      const set = this.tileToInstances.get(key) ?? new Set<string>();
      set.add(instance.id);
      this.tileToInstances.set(key, set);
    }
  }

  private unindexFootprint(instance: ObjectInstance, definition: ObjectDefinition): void {
    for (const tile of getObjectFootprintTiles(definition, instance.tileX, instance.tileY)) {
      const key = tileKey(tile.x, tile.y);
      const set = this.tileToInstances.get(key);
      if (!set) continue;
      set.delete(instance.id);
      if (set.size === 0) this.tileToInstances.delete(key);
    }
  }

  private getFirstOccupyingObjectId(tileX: number, tileY: number): string | null {
    const instanceIds = this.tileToInstances.get(tileKey(tileX, tileY));

    if (!instanceIds || instanceIds.size === 0) {
      return null;
    }

    return instanceIds.values().next().value ?? null;
  }
}

function tileKey(tileX: number, tileY: number): string {
  return `${tileX},${tileY}`;
}
