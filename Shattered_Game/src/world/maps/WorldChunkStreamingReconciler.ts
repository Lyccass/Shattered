import Phaser from 'phaser';
import { createChunkKey } from '../../shared/world/ChunkKey';
import { getChunkCoordForTile } from '../chunks/TerrainChunkMath';
import {
  materializeWorldChunkRuntimeLayers,
  type WorldChunkRuntimeLayers,
} from '../streaming/WorldChunkRuntimeLayers';
import type { NpcRegistry } from '../../npcs/NpcRegistry';
import type { NpcSystem } from '../../npcs/NpcSystem';
import type { NpcVisualController } from '../../npcs/NpcVisualController';
import type { ResourceNodeSystem } from '../../interactions/ResourceNodeSystem';
import type { MapTransitionSystem } from './MapTransitionSystem';
import type { MapTransitionVisualSystem } from './MapTransitionVisualSystem';
import type { WorldObjectManager } from './WorldObjectManager';
import type { LoadedMapRuntime } from './MapRuntime';

type Deps = {
  scene: Phaser.Scene;
  npcRegistry: NpcRegistry;
  objectManager: WorldObjectManager;
  mapTransitionSystem: MapTransitionSystem;
  mapTransitionVisualSystem: MapTransitionVisualSystem;
  resourceNodeSystem: ResourceNodeSystem;
  getNpcSystem: () => NpcSystem | null;
  getNpcVisualController: () => NpcVisualController | null;
  getCurrentRuntime: () => LoadedMapRuntime | undefined;
  onReconciled: () => void;
};

export class WorldChunkStreamingReconciler {
  constructor(private readonly deps: Deps) {}

  reconcile(runtime: LoadedMapRuntime): void {
    const streaming = runtime.streamedWorld;
    const objectPlacementSystem = this.deps.objectManager.getPlacementSystem();

    if (!streaming || !objectPlacementSystem) {
      return;
    }

    const activeChunks = streaming.activeWindow.getActiveChunks();
    const activeChunkKeys = new Set(activeChunks.map((chunk) => createChunkKey(chunk)));

    // Remove objects from chunks that are no longer active.
    for (const chunkKey of Array.from(streaming.materializedChunkKeys)) {
      if (activeChunkKeys.has(chunkKey)) {
        continue;
      }

      for (const objectId of streaming.materializedObjectIdsByChunk.get(chunkKey) ?? []) {
        objectPlacementSystem.removeObject(objectId);
      }

      streaming.materializedObjectIdsByChunk.delete(chunkKey);
      streaming.materializedChunkKeys.delete(chunkKey);
    }

    const runtimeLayers = activeChunks.map(materializeWorldChunkRuntimeLayers);
    const newlyMaterializedLayers = runtimeLayers.filter(
      (layers) => !streaming.materializedChunkKeys.has(layers.chunkKey),
    );

    // Place objects for newly-active chunks.
    for (const layers of runtimeLayers) {
      if (streaming.materializedChunkKeys.has(layers.chunkKey)) {
        continue;
      }

      const placedObjectIds: string[] = [];

      for (const object of layers.objects) {
        if (objectPlacementSystem.getInstance(object.id)) {
          placedObjectIds.push(object.id);
          continue;
        }

        try {
          const placed = objectPlacementSystem.placeAuthoredObject(runtime.definition.id, object);
          placedObjectIds.push(placed.id);
        } catch (error) {
          console.warn(
            `[WorldChunkStreamingReconciler] Skipped streamed object "${object.id}" in chunk ${layers.chunkKey}:`,
            error,
          );
        }
      }

      streaming.materializedObjectIdsByChunk.set(layers.chunkKey, placedObjectIds);
      streaming.materializedChunkKeys.add(layers.chunkKey);
    }

    runtime.definition.objects = runtimeLayers.flatMap((layers) => layers.objects);
    const allResourceAnchors = runtimeLayers.flatMap((layers) => layers.resourceAnchors);
    const allNpcAnchors = runtimeLayers.flatMap((layers) => layers.npcAnchors);
    runtime.interactionAnchors = [...allResourceAnchors, ...allNpcAnchors];
    runtime.definition.interactionAnchors = runtime.interactionAnchors;

    runtime.enemySpawns = runtimeLayers.flatMap((layers) =>
      layers.manualEnemySpawns.map((spawn) => ({
        id: spawn.id,
        definitionId: spawn.enemyDefinitionId,
        mapId: runtime.definition.id,
        tileX: spawn.tileX,
        tileY: spawn.tileY,
        ...(spawn.respawnMs !== undefined ? { respawnMs: spawn.respawnMs } : {}),
        ...(spawn.areaId !== undefined ? { areaId: spawn.areaId } : {}),
        ...(spawn.lootTableId !== undefined ? { lootTableId: spawn.lootTableId } : {}),
      }))
    );

    this.syncNpcVisuals(runtime, newlyMaterializedLayers);

    runtime.transitions = runtimeLayers.flatMap((layers) => layers.transitions);
    runtime.definition.transitions = runtime.transitions;
    this.deps.mapTransitionSystem.setTransitions(runtime.transitions);
    this.deps.mapTransitionVisualSystem.setMapContext(runtime.isoTilemap.transform, runtime.transitions);
    runtime.zones = runtimeLayers.flatMap((layers) => layers.zones);
    runtime.definition.zones = runtime.zones;
    runtime.zoneIndex.setZones(runtime.zones);

    this.deps.resourceNodeSystem.setMapNodes(
      runtime.definition.id,
      runtime.interactionAnchors.filter((anchor) => anchor.interactionType === 'resource_node'),
      runtime.definition.objects,
      this.deps.scene.time.now,
      objectPlacementSystem,
    );

    this.deps.onReconciled();
  }

  async tryStreamAroundTile(tileX: number, tileY: number, runtime: LoadedMapRuntime): Promise<void> {
    const streaming = runtime.streamedWorld;

    if (!streaming) {
      return;
    }

    const manifest = streaming.provider.getManifest();
    const centerChunk = getChunkCoordForTile(tileX, tileY, manifest.chunkSize);
    const centerChunkKey = createChunkKey(centerChunk);

    if (
      streaming.lastCenterChunkKey === centerChunkKey ||
      streaming.loadingCenterChunkKey !== null
    ) {
      return;
    }

    streaming.loadingCenterChunkKey = centerChunkKey;

    try {
      const loadedChunks = await streaming.activeWindow.loadAroundChunk(centerChunk);

      if (this.deps.getCurrentRuntime() !== runtime) {
        return;
      }

      runtime.isoTilemap.applyWorldChunks(loadedChunks, {
        invalidateAdjacentRendererChunks: false,
      });
      this.reconcile(runtime);
      streaming.lastCenterChunkKey = centerChunkKey;
    } catch (error) {
      console.error(
        `[WorldChunkStreamingReconciler] Failed to stream chunks around ${centerChunkKey}:`,
        error,
      );
    } finally {
      if (streaming.loadingCenterChunkKey === centerChunkKey) {
        streaming.loadingCenterChunkKey = null;
      }
    }
  }

  private syncNpcVisuals(
    runtime: LoadedMapRuntime,
    newLayers: WorldChunkRuntimeLayers[],
  ): void {
    const npcSystem = this.deps.getNpcSystem();
    const npcVisualController = this.deps.getNpcVisualController();

    if (!npcSystem || !npcVisualController) {
      return;
    }

    const newNpcAnchors = newLayers.flatMap((layers) => layers.npcAnchors);

    if (newNpcAnchors.length === 0) {
      return;
    }

    const nowMs = this.deps.scene.time.now;
    for (const anchor of newNpcAnchors) {
      if (!anchor.npcDefinitionId || !this.deps.npcRegistry.has(anchor.npcDefinitionId)) {
        continue;
      }
      const def = this.deps.npcRegistry.get(anchor.npcDefinitionId);
      npcSystem.spawn(
        anchor.id,
        def,
        anchor.tileX,
        anchor.tileY,
        anchor.patrolTiles ?? [],
        runtime.isoTilemap,
        nowMs,
      );
    }
  }
}
