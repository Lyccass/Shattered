import Phaser from 'phaser';
import { OBJECT_DEFINITIONS } from '../../objects/ObjectDefinitions';
import { ObjectDebugRenderer } from '../../objects/ObjectDebugRenderer';
import { ObjectOcclusionSystem } from '../../objects/ObjectOcclusionSystem';
import { ObjectPlacementSystem } from '../../objects/ObjectPlacementSystem';
import { ObjectRegistry } from '../../objects/ObjectRegistry';
import { ObjectRenderer } from '../../objects/ObjectRenderer';
import { CameraSystem } from '../../camera/CameraSystem';
import { InteractionSystem } from '../../interactions/InteractionSystem';
import {
  createFootprintInteractionTiles,
  createSingleTileInteractionTiles,
  type ActiveInteraction,
  type GenericDebugInteractionTarget,
  type InteractionResult,
  type InteractionTarget,
  type MapTransitionInteractionTarget,
  type NpcInteractionTarget,
  type ResourceNodeInteractionTarget,
  type WorkbenchInteractionTarget,
} from '../../interactions/InteractionTypes';
import { ResourceNodeSystem } from '../../interactions/ResourceNodeSystem';
import { WorkbenchSystem } from '../../interactions/WorkbenchSystem';
import { PlayerController } from '../../player/PlayerController';
import { PlayerInventoryState } from '../../player/PlayerInventoryState';
import { MapLoader } from './MapLoader';
import type { LoadedMapRuntime } from './MapRuntime';
import { getMapDisplayName } from './MapDefinitions';
import { MapTransitionSystem } from './MapTransitionSystem';
import { MapTransitionVisualSystem } from './MapTransitionVisualSystem';
import { getTransitionTiles } from './MapTransitionSystem';
import type {
  MapGenericDebugAnchor,
  MapNpcAnchor,
  MapTransition,
} from './MapTypes';

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
  private readonly playerInventoryState = new PlayerInventoryState();
  private readonly resourceNodeSystem = new ResourceNodeSystem();
  private readonly workbenchSystem = new WorkbenchSystem();
  private readonly interactionSystem = new InteractionSystem({
    onMapTransition: (target) => this.handleMapTransition(target),
    onResourceNode: (target) => this.handleResourceNode(target),
    onNpc: (target) => this.handleNpc(target),
    onWorkbench: (target) => this.handleWorkbench(target),
    onGenericDebug: (target) => this.handleGenericDebug(target),
  });

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
    this.configureInteractionRuntime(runtime);

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

  updateActiveInteraction(tileX: number, tileY: number): ActiveInteraction | null {
    this.mapTransitionSystem.updateActiveTransition(tileX, tileY);
    const activeInteraction = this.interactionSystem.updateActiveInteraction(tileX, tileY);
    const highlightedTransitionId =
      activeInteraction?.target.definition.interactionType === 'map_transition'
        ? (activeInteraction.target as MapTransitionInteractionTarget).transition.id
        : null;
    this.mapTransitionVisualSystem.setActiveTransition(highlightedTransitionId);
    return activeInteraction;
  }

  triggerActiveInteraction(): InteractionResult | null {
    const result = this.interactionSystem.triggerActiveInteraction();

    if (!result) {
      return null;
    }

    if (result.transitionRequest) {
      this.loadMap(result.transitionRequest.targetMapId, result.transitionRequest.targetSpawnId);
    } else {
      this.rebuildInteractionTargets();
    }

    return result;
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

  getActiveInteraction(): ActiveInteraction | null {
    return this.interactionSystem.getActiveInteraction();
  }

  getPlayerInventoryState(): PlayerInventoryState {
    return this.playerInventoryState;
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

  private configureInteractionRuntime(runtime: LoadedMapRuntime): void {
    const anchors = runtime.interactionAnchors;
    this.resourceNodeSystem.setMapNodes(
      runtime.definition.id,
      anchors.filter((anchor) => anchor.interactionType === 'resource_node'),
      this.objectPlacementSystem,
    );
    this.workbenchSystem.setMapWorkbenches(
      runtime.definition.id,
      anchors.filter((anchor) => anchor.interactionType === 'workbench'),
      this.objectPlacementSystem,
    );
    this.rebuildInteractionTargets();
    this.mapTransitionVisualSystem.setActiveTransition(null);
  }

  private rebuildInteractionTargets(): void {
    if (!this.currentRuntime) {
      this.interactionSystem.setTargets([]);
      return;
    }

    const interactionAnchors = this.currentRuntime.interactionAnchors;
    const targets: InteractionTarget[] = [
      ...this.createTransitionInteractionTargets(this.currentRuntime.transitions),
      ...this.resourceNodeSystem.createInteractionTargets(),
      ...this.workbenchSystem.createInteractionTargets(),
      ...this.createNpcInteractionTargets(
        interactionAnchors.filter((anchor) => anchor.interactionType === 'npc'),
      ),
      ...this.createGenericDebugInteractionTargets(
        interactionAnchors.filter((anchor) => anchor.interactionType === 'generic_debug'),
      ),
    ];

    this.interactionSystem.setTargets(targets);
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

  private createTransitionInteractionTargets(
    transitions: MapTransition[],
  ): MapTransitionInteractionTarget[] {
    return transitions.map((transition) => ({
      definition: {
        id: transition.id,
        interactionType: 'map_transition',
        promptText: `Press E: Travel to ${getMapDisplayName(transition.targetMapId)}`,
        interactionRangeTiles: 1,
        priority: 60,
      },
      tiles: createFootprintInteractionTiles(
        transition.fromTile.tileX,
        transition.fromTile.tileY,
        getTransitionTiles(transition),
      ),
      transition,
    }));
  }

  private createNpcInteractionTargets(
    anchors: MapNpcAnchor[],
  ): NpcInteractionTarget[] {
    return anchors.map((anchor) => ({
      definition: {
        id: anchor.id,
        interactionType: 'npc',
        promptText: `Press E: ${anchor.promptLabel ?? 'Talk'}`,
        interactionRangeTiles: anchor.interactionRangeTiles ?? 1,
        priority: 80,
      },
      tiles: createSingleTileInteractionTiles(anchor.tileX, anchor.tileY),
      anchor,
    }));
  }

  private createGenericDebugInteractionTargets(
    anchors: MapGenericDebugAnchor[],
  ): GenericDebugInteractionTarget[] {
    return anchors.map((anchor) => ({
      definition: {
        id: anchor.id,
        interactionType: 'generic_debug',
        promptText: `Press E: ${anchor.promptLabel ?? 'Inspect'}`,
        interactionRangeTiles: anchor.interactionRangeTiles ?? 1,
        priority: 10,
      },
      tiles: createSingleTileInteractionTiles(anchor.tileX, anchor.tileY),
      anchor,
    }));
  }

  private handleMapTransition(target: MapTransitionInteractionTarget): InteractionResult {
    return {
      ok: true,
      interactionType: 'map_transition',
      targetId: target.definition.id,
      message: `Travelling to ${getMapDisplayName(target.transition.targetMapId)}.`,
      transitionRequest: {
        targetMapId: target.transition.targetMapId,
        targetSpawnId: target.transition.targetSpawnId,
      },
    };
  }

  private handleResourceNode(target: ResourceNodeInteractionTarget): InteractionResult {
    return this.resourceNodeSystem.gatherNode(
      target.anchor.id,
      this.playerInventoryState,
      this.objectPlacementSystem,
    );
  }

  private handleNpc(target: NpcInteractionTarget): InteractionResult {
    return {
      ok: true,
      interactionType: 'npc',
      targetId: target.definition.id,
      message: target.anchor.text,
    };
  }

  private handleWorkbench(target: WorkbenchInteractionTarget): InteractionResult {
    return this.workbenchSystem.useWorkbench(
      target.anchor.id,
      this.playerInventoryState,
      this.objectPlacementSystem,
    );
  }

  private handleGenericDebug(target: GenericDebugInteractionTarget): InteractionResult {
    return {
      ok: true,
      interactionType: 'generic_debug',
      targetId: target.definition.id,
      message: target.anchor.message,
    };
  }
}
