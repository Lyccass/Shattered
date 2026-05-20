import Phaser from 'phaser';
import type { CameraSystem } from '../../camera/CameraSystem';
import { InteractionSystem } from '../../interactions/InteractionSystem';
import type { InteractionTarget } from '../../interactions/InteractionTypes';
import { PlacementModeSystem } from '../../interactions/PlacementModeSystem';
import { PlacedStructureSystem } from '../../interactions/PlacedStructureSystem';
import { ResourceNodeSystem } from '../../interactions/ResourceNodeSystem';
import { WorkbenchSystem } from '../../interactions/WorkbenchSystem';
import { ContractBoardSystem } from '../../contracts/ContractBoardSystem';
import type { PlayerController } from '../../player/PlayerController';
import { buildDebugTargets, buildNpcTargets, buildTransitionTargets } from './InteractionTargetBuilders';
import type { MapLoader } from './MapLoader';
import type { LoadedMapRuntime } from './MapRuntime';
import type { MapTransitionSystem } from './MapTransitionSystem';
import type { MapTransitionVisualSystem } from './MapTransitionVisualSystem';
import type { WorldObjectManager } from './WorldObjectManager';

export type WorldRuntimeBindings = {
  player: Phaser.GameObjects.Sprite;
  playerController: PlayerController;
  cameraSystem: CameraSystem;
};

type WorldMapRuntimeConfiguratorDeps = {
  contractBoardSystem: ContractBoardSystem;
  getActiveObjectCountForDefinition: (definitionId: string) => number;
  interactionSystem: InteractionSystem;
  mapLoader: MapLoader;
  mapTransitionSystem: MapTransitionSystem;
  mapTransitionVisualSystem: MapTransitionVisualSystem;
  objectManager: WorldObjectManager;
  placementModeSystem: PlacementModeSystem;
  placedStructureSystem: PlacedStructureSystem;
  recenterCameraOnPlayer: () => void;
  resourceNodeSystem: ResourceNodeSystem;
  scene: Phaser.Scene;
  workbenchSystem: WorkbenchSystem;
};

export class WorldMapRuntimeConfigurator {
  constructor(private readonly deps: WorldMapRuntimeConfiguratorDeps) {}

  clearPreviousMapRuntime(): void {
    this.deps.objectManager.clearMapObjects();
  }

  configureLoadedRuntime(runtime: LoadedMapRuntime): void {
    this.deps.mapTransitionSystem.setTransitions(runtime.transitions);
    this.deps.mapTransitionVisualSystem.setMapContext(
      runtime.isoTilemap.transform,
      runtime.transitions,
    );

    this.deps.objectManager.loadRuntime(runtime, (placementSystem) => {
      this.deps.mapLoader.placeCurrentMapObjects(placementSystem);
    });

    this.configureInteractionRuntime(runtime);
  }

  rebuildInteractionTargets(runtime: LoadedMapRuntime | undefined): void {
    if (!runtime) {
      this.deps.interactionSystem.setTargets([]);
      return;
    }

    const anchors = runtime.interactionAnchors;
    const targets: InteractionTarget[] = [
      ...buildTransitionTargets(runtime.transitions),
      ...this.deps.resourceNodeSystem.createInteractionTargets(),
      ...this.deps.workbenchSystem.createInteractionTargets(),
      ...this.deps.contractBoardSystem.createInteractionTargets(),
      ...this.deps.placedStructureSystem.createInteractionTargets(),
      ...buildNpcTargets(anchors.filter((anchor) => anchor.interactionType === 'npc')),
      ...buildDebugTargets(anchors.filter((anchor) => anchor.interactionType === 'generic_debug')),
    ];

    this.deps.interactionSystem.setTargets(targets);
  }

  rebindSceneSystems(runtime: LoadedMapRuntime, bindings: WorldRuntimeBindings): void {
    const spawnPoint = this.deps.mapLoader.getCurrentSpawnWorldPoint();

    bindings.playerController.setTilemap(runtime.isoTilemap);
    bindings.playerController.setWorldPosition(spawnPoint.x, spawnPoint.y);
    bindings.cameraSystem.setBounds(runtime.worldBounds);
    this.deps.recenterCameraOnPlayer();
    this.deps.objectManager.bindPlayer(bindings.player);
  }

  destroy(): void {
    this.deps.mapTransitionVisualSystem.clear();
    this.deps.mapTransitionSystem.setTransitions([]);
    this.deps.interactionSystem.setTargets([]);
    this.deps.objectManager.destroy();
    this.deps.mapLoader.destroyCurrentRuntime();
  }

  private configureInteractionRuntime(runtime: LoadedMapRuntime): void {
    const anchors = runtime.interactionAnchors;
    const nowMs = this.deps.scene.time.now;
    const objectPlacementSystem = this.deps.objectManager.getPlacementSystem();

    this.deps.resourceNodeSystem.setMapNodes(
      runtime.definition.id,
      anchors.filter((anchor) => anchor.interactionType === 'resource_node'),
      runtime.definition.objects,
      nowMs,
      objectPlacementSystem,
    );
    this.deps.workbenchSystem.setMapWorkbenches(
      runtime.definition.id,
      anchors.filter((anchor) => anchor.interactionType === 'workbench'),
    );
    this.deps.contractBoardSystem.setMapBoards(
      runtime.definition.id,
      anchors.filter((anchor) => anchor.interactionType === 'contract_board'),
    );
    this.deps.placedStructureSystem.setCurrentMap(runtime.definition.id, nowMs, objectPlacementSystem);

    if (objectPlacementSystem) {
      this.deps.placementModeSystem.bindRuntimeContext(
        runtime.isoTilemap.transform,
        runtime.definition.spaceType,
        runtime.isoTilemap.worldGrid,
        runtime.zoneIndex,
        runtime.transitions,
        objectPlacementSystem,
        this.deps.getActiveObjectCountForDefinition,
      );
    }

    this.deps.placementModeSystem.cancelPlacement();
    this.rebuildInteractionTargets(runtime);
    this.deps.mapTransitionVisualSystem.setActiveTransition(null);
  }
}
