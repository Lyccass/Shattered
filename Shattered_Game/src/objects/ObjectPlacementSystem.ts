import { WorldGrid } from '../world/WorldGrid';
import { ObjectDebugRenderer } from './ObjectDebugRenderer';
import { ObjectRegistry } from './ObjectRegistry';
import { ObjectRenderer } from './ObjectRenderer';
import type { GridFootprint, ObjectDefinition, ObjectInstance } from './ObjectTypes';

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

  placeObject(definitionId: string, tileX: number, tileY: number): ObjectInstance | null {
    const definition = this.registry.get(definitionId);

    if (!this.canPlaceWithDefinition(definition, tileX, tileY)) {
      return null;
    }

    const instance: ObjectInstance = {
      id: `${definition.id}#${this.nextSequence++}`,
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
    return this.canPlaceWithDefinition(this.registry.get(definitionId), tileX, tileY);
  }

  getInstance(instanceId: string): ObjectInstance | undefined {
    return this.instances.get(instanceId);
  }

  getInstances(): ObjectInstance[] {
    return Array.from(this.instances.values());
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
      const footprintTiles = footprintFor(def)
        .map((o) => `(${instance.tileX + o.x},${instance.tileY + o.y})`)
        .join(' ');
      const status = def.blocksMovement ? 'blocking' : 'non-blocking';
      console.log(`  ${instance.id}  ${status}  footprint=${footprintTiles}`);
    }
  }

  private canPlaceWithDefinition(
    definition: ObjectDefinition,
    tileX: number,
    tileY: number,
  ): boolean {
    const footprint = footprintFor(definition);
    for (const offset of footprint) {
      const tx = tileX + offset.x;
      const ty = tileY + offset.y;

      if (!this.worldGrid.isTileInBounds(tx, ty)) return false;
      if (this.worldGrid.isTerrainBlocked(tx, ty)) return false;
      if (definition.blocksMovement && this.worldGrid.isObjectBlocked(tx, ty)) return false;
    }
    return true;
  }

  private indexFootprint(instance: ObjectInstance, definition: ObjectDefinition): void {
    for (const offset of footprintFor(definition)) {
      const key = tileKey(instance.tileX + offset.x, instance.tileY + offset.y);
      const set = this.tileToInstances.get(key) ?? new Set<string>();
      set.add(instance.id);
      this.tileToInstances.set(key, set);
    }
  }

  private unindexFootprint(instance: ObjectInstance, definition: ObjectDefinition): void {
    for (const offset of footprintFor(definition)) {
      const key = tileKey(instance.tileX + offset.x, instance.tileY + offset.y);
      const set = this.tileToInstances.get(key);
      if (!set) continue;
      set.delete(instance.id);
      if (set.size === 0) this.tileToInstances.delete(key);
    }
  }
}

function footprintFor(definition: ObjectDefinition): GridFootprint {
  return definition.collisionFootprint.length > 0
    ? definition.collisionFootprint
    : [{ x: 0, y: 0 }];
}

function tileKey(tileX: number, tileY: number): string {
  return `${tileX},${tileY}`;
}
