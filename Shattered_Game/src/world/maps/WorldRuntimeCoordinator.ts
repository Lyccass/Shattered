import Phaser from 'phaser';
import { ActionProgressSystem } from '../../actions/ActionProgressSystem';
import type { ActionProgressSnapshot } from '../../actions/ActionProgressTypes';
import { CameraSystem } from '../../camera/CameraSystem';
import { ContractBoardSystem } from '../../contracts/ContractBoardSystem';
import { CONTRACT_DEFINITIONS } from '../../contracts/ContractDefinitions';
import { ContractRegistry } from '../../contracts/ContractRegistry';
import { RECIPE_DEFINITIONS } from '../../crafting/RecipeDefinitions';
import { RecipeRegistry } from '../../crafting/RecipeRegistry';
import { OBJECT_DEFINITIONS } from '../../objects/ObjectDefinitions';
import { ObjectDebugRenderer } from '../../objects/ObjectDebugRenderer';
import { ObjectOcclusionSystem } from '../../objects/ObjectOcclusionSystem';
import { ObjectPlacementSystem } from '../../objects/ObjectPlacementSystem';
import { ObjectRegistry } from '../../objects/ObjectRegistry';
import { ObjectRenderer } from '../../objects/ObjectRenderer';
import { ITEM_DEFINITIONS } from '../../items/ItemDefinitions';
import { ItemRegistry } from '../../items/ItemRegistry';
import { ItemUseSystem } from '../../items/ItemUseSystem';
import { ChoiceMenuCoordinator } from '../../interactions/ChoiceMenuCoordinator';
import { InteractionActionFactory } from '../../interactions/InteractionActionFactory';
import { InteractionSystem } from '../../interactions/InteractionSystem';
import {
  type ActiveInteraction,
  type ContractBoardInteractionTarget,
  type InteractionResult,
  type InteractionTarget,
  type MapTransitionInteractionTarget,
  type PlacedObjectInteractionTarget,
  type ResourceNodeInteractionTarget,
  type WorkbenchInteractionTarget,
} from '../../interactions/InteractionTypes';
import {
  PlacementModeSystem,
  type PlacementPreviewState,
} from '../../interactions/PlacementModeSystem';
import { PlacedStructureSystem } from '../../interactions/PlacedStructureSystem';
import { ResourceNodeSystem } from '../../interactions/ResourceNodeSystem';
import { WorkbenchSystem } from '../../interactions/WorkbenchSystem';
import { PlayerController } from '../../player/PlayerController';
import { PlayerSessionState } from '../../player/PlayerSessionState';
import type { PlayerItemKey } from '../../player/PlayerInventoryState';
import type { SkillSnapshot } from '../../skills/SkillTypes';
import type { TaskJournalEntry } from '../../tasks/TaskJournalTypes';
import type { UiStateSnapshot } from '../../ui/UiTypes';
import { UiStateAggregator } from '../../ui/UiStateAggregator';
import type { GameEventBus } from '../../events/GameEventBus';
import { MapLoader } from './MapLoader';
import type { LoadedMapRuntime } from './MapRuntime';
import { MapTransitionSystem } from './MapTransitionSystem';
import { MapTransitionVisualSystem } from './MapTransitionVisualSystem';
import { WorldSessionState } from '../session/WorldSessionState';
import { buildDebugTargets, buildNpcTargets, buildTransitionTargets } from './InteractionTargetBuilders';
import { WorldActionBroker } from './WorldActionBroker';
import { WorldInteractionHandlers } from './WorldInteractionHandlers';

type WorldRuntimeBindings = {
  player: Phaser.GameObjects.Sprite;
  playerController: PlayerController;
  cameraSystem: CameraSystem;
};

export class WorldRuntimeCoordinator {
  private readonly mapLoader: MapLoader;
  private readonly objectRegistry: ObjectRegistry;
  private readonly itemRegistry = new ItemRegistry(ITEM_DEFINITIONS);
  private readonly contractRegistry = new ContractRegistry(CONTRACT_DEFINITIONS);
  private readonly recipeRegistry = new RecipeRegistry(RECIPE_DEFINITIONS);
  private readonly worldSessionState = new WorldSessionState();
  private readonly playerSessionState = new PlayerSessionState();
  private readonly mapTransitionSystem = new MapTransitionSystem();
  private readonly mapTransitionVisualSystem: MapTransitionVisualSystem;
  private readonly resourceNodeSystem = new ResourceNodeSystem(this.worldSessionState);
  private readonly workbenchSystem = new WorkbenchSystem(this.recipeRegistry);
  private readonly contractBoardSystem = new ContractBoardSystem(this.contractRegistry);
  private readonly placedStructureSystem = new PlacedStructureSystem(
    this.worldSessionState,
    this.recipeRegistry,
  );
  private readonly placementModeSystem: PlacementModeSystem;
  private readonly itemUseSystem = new ItemUseSystem(
    this.itemRegistry,
    this.playerSessionState.getEffectSystem(),
  );
  private readonly choiceMenuCoordinator: ChoiceMenuCoordinator;
  private readonly actionProgressSystem = new ActionProgressSystem();
  private readonly interactionSystem: InteractionSystem;
  private readonly actionBroker: WorldActionBroker;

  private bindings?: WorldRuntimeBindings;
  private currentRuntime?: LoadedMapRuntime;
  private objectRenderer?: ObjectRenderer;
  private objectPlacementSystem?: ObjectPlacementSystem;
  private objectDebugRenderer?: ObjectDebugRenderer;
  private objectOcclusionSystem?: ObjectOcclusionSystem;
  private readonly pendingUiResults: InteractionResult[] = [];
  private destroyed = false;

  private readonly actionFactory: InteractionActionFactory;
  private readonly uiAggregator: UiStateAggregator;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly eventBus: GameEventBus,
  ) {
    this.mapLoader = new MapLoader(scene);
    this.objectRegistry = new ObjectRegistry(OBJECT_DEFINITIONS);
    this.mapTransitionVisualSystem = new MapTransitionVisualSystem(scene);
    this.placementModeSystem = new PlacementModeSystem(scene, this.itemRegistry);
    this.choiceMenuCoordinator = new ChoiceMenuCoordinator(this.eventBus);

    const interactionHandlers = new WorldInteractionHandlers(
      scene,
      this.playerSessionState,
      this.resourceNodeSystem,
      this.workbenchSystem,
      this.contractBoardSystem,
      this.placedStructureSystem,
      () => this.objectPlacementSystem,
    );
    this.interactionSystem = new InteractionSystem(interactionHandlers.build());

    this.actionBroker = new WorldActionBroker(
      this.actionProgressSystem,
      this.eventBus,
      (result) => this.pendingUiResults.push(result),
    );

    this.actionFactory = new InteractionActionFactory(
      this.resourceNodeSystem,
      this.workbenchSystem,
      this.placedStructureSystem,
      this.playerSessionState,
      (interactionType, targetId, rangeTiles) =>
        this.isTargetStillInRange(interactionType, targetId, rangeTiles),
      () => this.objectPlacementSystem,
      () => this.scene.time.now,
    );

    this.uiAggregator = new UiStateAggregator(
      this.playerSessionState,
      this.interactionSystem,
      this.actionProgressSystem,
      this.choiceMenuCoordinator,
      this.placementModeSystem,
      this.contractBoardSystem,
      () => this.scene.time.now,
    );
  }

  loadMap(mapId: string, spawnId: string): LoadedMapRuntime {
    const objectDebugVisible = this.objectDebugRenderer?.isVisible() ?? false;

    // Destroy old per-map Phaser objects before replacing them.
    this.objectRenderer?.destroyAll();
    this.objectDebugRenderer?.destroyAll();
    this.objectPlacementSystem?.clear();

    this.choiceMenuCoordinator.cancel();
    this.actionProgressSystem.cancel();

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

  updatePlayerRuntimeState(deltaMs = 0): InteractionResult[] {
    if (!this.bindings) {
      return [];
    }

    const nowMs = this.scene.time.now;
    this.playerSessionState.update(nowMs);
    const resourceStateChanged = this.resourceNodeSystem.updateRuntimeState(
      nowMs,
      this.objectPlacementSystem,
    );
    const placedStateChanged = this.placedStructureSystem.updateRuntimeState(
      nowMs,
      this.objectPlacementSystem,
    );

    if (resourceStateChanged || placedStateChanged) {
      this.rebuildInteractionTargets();
    }

    const feetTile = this.bindings.playerController.getFeetTile();
    this.updateActiveInteraction(feetTile.x, feetTile.y);
    this.placementModeSystem.updatePreview(this.bindings.playerController);
    this.updateActionProgress(deltaMs);
    return this.consumePendingUiResults();
  }

  triggerActiveInteraction(): InteractionResult | null {
    const activeInteraction = this.interactionSystem.getActiveInteraction();
    const activeAction = this.actionProgressSystem.getSnapshot();

    if (
      activeAction
      && activeInteraction
      && (
        activeAction.targetId !== activeInteraction.target.definition.id
        || activeAction.interactionType !== activeInteraction.target.definition.interactionType
      )
    ) {
      const cancelMsg = this.actionBroker.cancel('Action cancelled.');

      if (cancelMsg) {
        this.queueInfoResult(cancelMsg);
      }
    }

    if (activeInteraction && this.tryOpenChoiceMenu(activeInteraction.target)) {
      return null;
    }

    if (activeInteraction?.target.definition.interactionType === 'resource_node') {
      this.actionBroker.start(
        this.actionFactory.createGatherAction(
          activeInteraction.target as ResourceNodeInteractionTarget,
        ),
      );
      return null;
    }

    if (activeInteraction?.target.definition.interactionType === 'workbench') {
      const workbenchTarget = activeInteraction.target as WorkbenchInteractionTarget;
      const recipes = this.workbenchSystem.getRecipesForWorkbench(workbenchTarget.anchor.id);

      if (recipes.length === 1) {
        this.actionBroker.start(
          this.actionFactory.createWorkbenchCraftAction(
            workbenchTarget.anchor.id,
            recipes[0].id,
          ),
        );
        return null;
      }
    }

    if (activeInteraction?.target.definition.interactionType === 'placed_object') {
      const placedTarget = activeInteraction.target as PlacedObjectInteractionTarget;
      const action = this.actionFactory.createPlacedObjectAction(
        placedTarget,
        this.playerSessionState.getInventoryState(),
      );

      if (action) {
        this.actionBroker.start(action);
        return null;
      }
    }

    const result = this.interactionSystem.triggerActiveInteraction();

    if (!result) {
      return null;
    }

    this.actionBroker.emitResultSfx(result);

    if (result.transitionRequest) {
      this.loadMap(result.transitionRequest.targetMapId, result.transitionRequest.targetSpawnId);
    } else {
      this.rebuildInteractionTargets();
    }

    return result;
  }

  useItem(itemId: PlayerItemKey): InteractionResult {
    const result = this.itemUseSystem.useItem(
      itemId,
      this.playerSessionState.getInventoryState(),
      this.scene.time.now,
    );

    this.actionBroker.emitResultSfx(result);
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

  getUiState(): UiStateSnapshot {
    return this.uiAggregator.getSnapshot();
  }

  getActionProgressState(): ActionProgressSnapshot | null {
    return this.actionProgressSystem.getSnapshot();
  }

  getPlacementState(): PlacementPreviewState | null {
    return this.placementModeSystem.getState();
  }

  getTaskJournalEntries(): TaskJournalEntry[] {
    return this.contractBoardSystem.getJournalEntries(this.playerSessionState);
  }

  getPlayerSkillSnapshots(): SkillSnapshot[] {
    return this.playerSessionState.getSkillSnapshots();
  }

  consumePendingUiResults(): InteractionResult[] {
    return this.pendingUiResults.splice(0);
  }

  isPlacementModeActive(): boolean {
    return this.placementModeSystem.isActive();
  }

  isChoiceMenuOpen(): boolean {
    return this.choiceMenuCoordinator.isOpen();
  }

  isActionInProgress(): boolean {
    return this.actionProgressSystem.isActive();
  }

  cancelActiveAction(reason = 'Action cancelled.'): string | null {
    return this.actionBroker.cancel(reason);
  }

  startPlacementMode(itemId: PlayerItemKey = 'firestarter_set'): string {
    if (!this.bindings || !this.currentRuntime) {
      return 'Placement is unavailable right now.';
    }

    if (!this.playerSessionState.getInventoryState().hasItemAtLeast(itemId, 1)) {
      return `You don't have a ${this.itemRegistry.get(itemId).displayName}.`;
    }

    const placementState = this.placementModeSystem.startPlacement(itemId);

    if (!placementState) {
      return `${this.itemRegistry.get(itemId).displayName} cannot be placed.`;
    }

    this.placementModeSystem.updatePreview(this.bindings.playerController);
    return `Placing ${placementState.itemDisplayName}.`;
  }

  confirmPlacementMode(): InteractionResult | null {
    const placementState = this.placementModeSystem.getState();

    if (!placementState || !this.objectPlacementSystem) {
      return null;
    }

    if (!placementState.valid) {
      this.eventBus.emitSfx('invalid_action');
      return {
        ok: false,
        sfxId: 'invalid_action',
        interactionType: 'placed_object',
        targetId: placementState.itemId,
        message: placementState.invalidReason ?? `Can't place ${placementState.itemDisplayName} there.`,
      };
    }

    const result = this.placedStructureSystem.placeItem(
      placementState.itemId,
      placementState.targetTileX,
      placementState.targetTileY,
      this.scene.time.now,
      this.playerSessionState.getInventoryState(),
      this.itemRegistry,
      this.objectPlacementSystem,
    );

    if (result.ok) {
      this.placementModeSystem.cancelPlacement();
      this.rebuildInteractionTargets();
    }

    this.actionBroker.emitResultSfx(result);
    return result;
  }

  cancelPlacementMode(): string | null {
    if (!this.placementModeSystem.isActive()) {
      return null;
    }

    this.placementModeSystem.cancelPlacement();
    return 'Placement cancelled.';
  }

  moveChoiceMenuSelection(delta: number): void {
    this.choiceMenuCoordinator.moveSelection(delta);
  }

  confirmChoiceMenu(): InteractionResult | null {
    const confirmResult = this.choiceMenuCoordinator.confirm(this.playerSessionState);

    switch (confirmResult.kind) {
      case 'none':
        return null;

      case 'disabled':
        return {
          ok: false,
          sfxId: 'invalid_action',
          interactionType: 'generic_debug',
          targetId: 'choice_menu',
          message: confirmResult.reason,
        };

      case 'craft':
        this.actionBroker.start(
          this.actionFactory.createWorkbenchCraftAction(
            confirmResult.workbenchId,
            confirmResult.recipeId,
          ),
        );
        return null;

      case 'result': {
        const result = confirmResult.result;
        this.actionBroker.emitResultSfx(result);
        this.rebuildInteractionTargets();
        return result;
      }
    }
  }

  cancelChoiceMenu(): string | null {
    if (!this.choiceMenuCoordinator.isOpen()) {
      return null;
    }

    this.choiceMenuCoordinator.cancel();
    return 'Menu closed.';
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

  destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.choiceMenuCoordinator.cancel();
    this.actionProgressSystem.cancel();
    this.pendingUiResults.length = 0;
    this.placementModeSystem.destroy();
    this.mapTransitionVisualSystem.clear();
    this.mapTransitionSystem.setTransitions([]);
    this.interactionSystem.setTargets([]);
    this.objectPlacementSystem?.clear();
    this.objectRenderer?.destroyAll();
    this.objectDebugRenderer?.destroyAll();
    this.objectRenderer = undefined;
    this.objectDebugRenderer = undefined;
    this.objectPlacementSystem = undefined;
    this.objectOcclusionSystem = undefined;
    this.mapLoader.destroyCurrentRuntime();
    this.currentRuntime = undefined;
    this.bindings = undefined;
    this.worldSessionState.clearAll();
  }

  private updateActionProgress(deltaMs: number): void {
    const update = this.actionBroker.update(deltaMs);

    if (!update) {
      return;
    }

    if (update.transitionRequest) {
      this.loadMap(update.transitionRequest.targetMapId, update.transitionRequest.targetSpawnId);
    } else {
      this.rebuildInteractionTargets();
    }

    this.pendingUiResults.push(update.uiResult);
  }

  private queueInfoResult(message: string): void {
    this.pendingUiResults.push({
      ok: false,
      interactionType: 'generic_debug',
      targetId: 'action_progress',
      message,
      toastKind: 'info',
    });
  }

  private isTargetStillInRange(
    interactionType: InteractionResult['interactionType'],
    targetId: string,
    rangeTiles: number,
  ): boolean {
    if (!this.bindings) {
      return false;
    }

    const target = this.interactionSystem
      .getTargets()
      .find((candidate) =>
        candidate.definition.interactionType === interactionType
        && candidate.definition.id === targetId,
      );

    if (!target) {
      return false;
    }

    const feetTile = this.bindings.playerController.getFeetTile();
    const distanceTiles = target.tiles.reduce(
      (best, tile) => Math.min(best, Math.abs(tile.x - feetTile.x) + Math.abs(tile.y - feetTile.y)),
      Number.POSITIVE_INFINITY,
    );

    return distanceTiles <= rangeTiles;
  }

  private configureInteractionRuntime(runtime: LoadedMapRuntime): void {
    const anchors = runtime.interactionAnchors;
    const nowMs = this.scene.time.now;
    this.resourceNodeSystem.setMapNodes(
      runtime.definition.id,
      anchors.filter((anchor) => anchor.interactionType === 'resource_node'),
      runtime.definition.objects,
      nowMs,
      this.objectPlacementSystem,
    );
    this.workbenchSystem.setMapWorkbenches(
      runtime.definition.id,
      anchors.filter((anchor) => anchor.interactionType === 'workbench'),
    );
    this.contractBoardSystem.setMapBoards(
      runtime.definition.id,
      anchors.filter((anchor) => anchor.interactionType === 'contract_board'),
    );
    this.placedStructureSystem.setCurrentMap(runtime.definition.id, nowMs, this.objectPlacementSystem);

    if (this.objectPlacementSystem) {
      this.placementModeSystem.bindRuntimeContext(
        runtime.isoTilemap.transform,
        runtime.definition.spaceType,
        runtime.isoTilemap.worldGrid,
        runtime.zoneIndex,
        runtime.transitions,
        this.objectPlacementSystem,
        (definitionId) => this.placedStructureSystem.getActiveObjectCountForDefinition(definitionId),
      );
    }

    this.placementModeSystem.cancelPlacement();
    this.rebuildInteractionTargets();
    this.mapTransitionVisualSystem.setActiveTransition(null);
  }

  private rebuildInteractionTargets(): void {
    if (!this.currentRuntime) {
      this.interactionSystem.setTargets([]);
      return;
    }

    const anchors = this.currentRuntime.interactionAnchors;
    const targets: InteractionTarget[] = [
      ...buildTransitionTargets(this.currentRuntime.transitions),
      ...this.resourceNodeSystem.createInteractionTargets(),
      ...this.workbenchSystem.createInteractionTargets(),
      ...this.contractBoardSystem.createInteractionTargets(),
      ...this.placedStructureSystem.createInteractionTargets(),
      ...buildNpcTargets(anchors.filter((a) => a.interactionType === 'npc')),
      ...buildDebugTargets(anchors.filter((a) => a.interactionType === 'generic_debug')),
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

  private tryOpenChoiceMenu(target: InteractionTarget): boolean {
    if (target.definition.interactionType === 'workbench') {
      const workbenchTarget = target as WorkbenchInteractionTarget;
      const handler = this.workbenchSystem.createMenuHandler(workbenchTarget.anchor.id);
      return this.choiceMenuCoordinator.tryOpen(handler, this.playerSessionState);
    }

    if (target.definition.interactionType === 'contract_board') {
      const contractBoardTarget = target as ContractBoardInteractionTarget;
      const handler = this.contractBoardSystem.createMenuHandler(contractBoardTarget.anchor.id);
      return this.choiceMenuCoordinator.tryOpen(handler, this.playerSessionState);
    }

    return false;
  }
}
