import Phaser from 'phaser';
import { OBJECT_DEFINITIONS } from '../../objects/ObjectDefinitions';
import { ObjectDebugRenderer } from '../../objects/ObjectDebugRenderer';
import { ObjectOcclusionSystem } from '../../objects/ObjectOcclusionSystem';
import { ObjectPlacementSystem } from '../../objects/ObjectPlacementSystem';
import { ObjectRegistry } from '../../objects/ObjectRegistry';
import { ObjectRenderer } from '../../objects/ObjectRenderer';
import { CameraSystem } from '../../camera/CameraSystem';
import { PlayerController } from '../../player/PlayerController';
import { MapLoader } from './MapLoader';
import type { LoadedMapRuntime } from './MapRuntime';
import { MapTransitionSystem } from './MapTransitionSystem';
import { MapTransitionVisualSystem } from './MapTransitionVisualSystem';
import type { MapTransition } from './MapTypes';

type WorldRuntimeBindings = {
  player: Phaser.GameObjects.Sprite;
  playerController: PlayerController;
  cameraSystem: CameraSystem;
};

export class WorldRuntimeCoordinator {
  private readonly mapLoader: MapLoader;
  private readonly objectRegistry: ObjectRegistry;
  private readonly mapTransitionSystem = new MapTransitionSystem();
  private readonly mapTransitionVisualSystem: MapTransitionVisualSystem;

  private bindings?: WorldRuntimeBindings;
  private currentRuntime?: LoadedMapRuntime;
  private objectRenderer?: ObjectRenderer;
  private objectPlacementSystem?: ObjectPlacementSystem;
  private objectDebugRenderer?: ObjectDebugRenderer;
  private objectOcclusionSystem?: ObjectOcclusionSystem;

  constructor(private readonly scene: Phaser.Scene) {
    this.mapLoader = new MapLoader(scene);
    this.objectRegistry = new ObjectRegistry(OBJECT_DEFINITIONS);
    this.mapTransitionVisualSystem = new MapTransitionVisualSystem(scene);
  }

  loadMap(mapId: string, spawnId: string): LoadedMapRuntime {
    const objectDebugVisible = this.objectDebugRenderer?.isVisible() ?? false;
    this.objectPlacementSystem?.clear();

    const runtime = this.mapLoader.loadMap(mapId, spawnId);
    this.currentRuntime = runtime;

    this.mapTransitionSystem.setTransitions(runtime.transitions);
    this.mapTransitionVisualSystem.setMapContext(runtime.isoTilemap.transform, runtime.transitions);

    this.objectRenderer = new ObjectRenderer(this.scene, runtime.isoTilemap.transform);
    this.objectDebugRenderer = new ObjectDebugRenderer(this.scene, runtime.isoTilemap.transform);
    this.objectDebugRenderer.setVisible(objectDebugVisible);
    this.objectPlacementSystem = new ObjectPlacementSystem(
      runtime.isoTilemap.worldGrid,
      this.objectRegistry,
      this.objectRenderer,
      this.objectDebugRenderer,
    );
    this.mapLoader.placeCurrentMapObjects(this.objectPlacementSystem);

    if (this.bindings) {
      this.rebindSceneSystems();
    }

    return runtime;
  }

  bindSceneSystems(bindings: WorldRuntimeBindings): void {
    this.bindings = bindings;

    if (this.currentRuntime) {
      this.rebindSceneSystems();
    }
  }

  updateActiveTransition(tileX: number, tileY: number): MapTransition | null {
    const activeTransition = this.mapTransitionSystem.updateActiveTransition(tileX, tileY);
    this.mapTransitionVisualSystem.setActiveTransition(activeTransition?.id ?? null);
    return activeTransition;
  }

  triggerActiveTransition(): LoadedMapRuntime | null {
    const transition = this.mapTransitionSystem.getActiveTransition();

    if (!transition) {
      return null;
    }

    return this.loadMap(transition.targetMapId, transition.targetSpawnId);
  }

  getCurrentRuntime(): LoadedMapRuntime {
    if (!this.currentRuntime) {
      throw new Error('WorldRuntimeCoordinator: no map runtime is active');
    }

    return this.currentRuntime;
  }

  getCurrentMapId(): string {
    return this.mapLoader.getCurrentMapId();
  }

  getCurrentSpawnId(): string {
    return this.mapLoader.getCurrentSpawnId();
  }

  getCurrentSpawnWorldPoint(): Phaser.Math.Vector2 {
    return this.mapLoader.getCurrentSpawnWorldPoint();
  }

  getIsoTilemap() {
    return this.getCurrentRuntime().isoTilemap;
  }

  getMapLoader(): MapLoader {
    return this.mapLoader;
  }

  getMapTransitionSystem(): MapTransitionSystem {
    return this.mapTransitionSystem;
  }

  getObjectPlacementSystem(): ObjectPlacementSystem | undefined {
    return this.objectPlacementSystem;
  }

  getObjectDebugRenderer(): ObjectDebugRenderer | undefined {
    return this.objectDebugRenderer;
  }

  getObjectOcclusionSystem(): ObjectOcclusionSystem | undefined {
    return this.objectOcclusionSystem;
  }

  private rebindSceneSystems(): void {
    if (!this.bindings || !this.currentRuntime || !this.objectRenderer) {
      return;
    }

    const spawnPoint = this.getCurrentSpawnWorldPoint();

    this.bindings.playerController.setTilemap(this.currentRuntime.isoTilemap);
    this.bindings.playerController.setWorldPosition(spawnPoint.x, spawnPoint.y);
    this.bindings.cameraSystem.setBounds(this.currentRuntime.worldBounds);
    this.scene.cameras.main.centerOn(this.bindings.player.x, this.bindings.player.y);
    this.objectOcclusionSystem = new ObjectOcclusionSystem(this.objectRenderer, this.bindings.player);
  }
}
