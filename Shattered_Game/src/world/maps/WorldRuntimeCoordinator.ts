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
import type { PlayerTileSaveState, SaveGameV1 } from '../../persistence/SaveTypes';
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
import { findInteractionApproachWorldPoint as findApproachWorldPoint } from './InteractionApproachFinder';
import { buildDebugTargets, buildNpcTargets, buildTransitionTargets } from './InteractionTargetBuilders';
import {
  getInteractionMenuTitle,
  getInteractionUseDetails,
  getInteractionUseLabel,
} from './InteractionMenuCopy';
import { WorldActionBroker } from './WorldActionBroker';
import { WorldInteractionHandlers } from './WorldInteractionHandlers';
import {
  type RestorePrototypeSaveResult,
  WorldPrototypeSaveController,
} from './WorldPrototypeSaveController';

type WorldRuntimeBindings = {
  player: Phaser.GameObjects.Sprite;
  playerController: PlayerController;
  cameraSystem: CameraSystem;
};

type InteractionTargetType = InteractionTarget['definition']['interactionType'];
export type DeferredInteractionAction = {
  kind: 'deferred_interaction_action';
  interactionType: InteractionTargetType;
  targetId: string;
  action: 'use' | 'inspect';
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
  private readonly interactionHandlers: WorldInteractionHandlers;

  private bindings?: WorldRuntimeBindings;
  private currentRuntime?: LoadedMapRuntime;
  private objectRenderer?: ObjectRenderer;
  private objectPlacementSystem?: ObjectPlacementSystem;
  private objectDebugRenderer?: ObjectDebugRenderer;
  private objectOcclusionSystem?: ObjectOcclusionSystem;
  private readonly pendingUiResults: InteractionResult[] = [];
  private activeInteractionTiles: Array<{ x: number; y: number }> | null = null;
  private destroyed = false;

  private readonly actionFactory: InteractionActionFactory;
  private readonly uiAggregator: UiStateAggregator;
  private readonly prototypeSaveController: WorldPrototypeSaveController;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly eventBus: GameEventBus,
  ) {
    this.mapLoader = new MapLoader(scene);
    this.objectRegistry = new ObjectRegistry(OBJECT_DEFINITIONS);
    this.mapTransitionVisualSystem = new MapTransitionVisualSystem(scene);
    this.placementModeSystem = new PlacementModeSystem(scene, this.itemRegistry);
    this.choiceMenuCoordinator = new ChoiceMenuCoordinator(this.eventBus);

    this.interactionHandlers = new WorldInteractionHandlers(
      scene,
      this.playerSessionState,
      this.resourceNodeSystem,
      this.workbenchSystem,
      this.contractBoardSystem,
      this.placedStructureSystem,
      () => this.objectPlacementSystem,
    );
    this.interactionSystem = new InteractionSystem(this.interactionHandlers.build());

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

    this.prototypeSaveController = new WorldPrototypeSaveController({
      playerSessionState: this.playerSessionState,
      worldSessionState: this.worldSessionState,
      getCurrentMapId: () => this.getCurrentMapId(),
      getCurrentPlayerTileSnapshot: () => this.getCurrentPlayerTileSnapshot(),
      loadMap: (mapId, spawnId) => {
        this.loadMap(mapId, spawnId);
      },
      isRestorablePlayerTile: (tile) => this.isRestorablePlayerTile(tile),
      setPlayerToTile: (tile) => this.setPlayerToTile(tile),
      recenterCameraOnPlayer: () => this.recenterCameraOnPlayer(),
      updatePlayerRuntimeState: () => {
        this.updatePlayerRuntimeState();
      },
    });
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
    if (!activeInteraction) {
      return null;
    }

    this.cancelConflictingActionForTarget(activeInteraction.target);

    if (this.openInteractionChoiceMenuForTarget(activeInteraction.target)) {
      return null;
    }

    return this.executeTargetUse(activeInteraction.target);
  }

  triggerPointerInteraction(worldX: number, worldY: number): InteractionResult | null {
    if (!this.bindings || !this.currentRuntime) {
      return null;
    }

    const clickedTile = this.currentRuntime.isoTilemap.transform.worldToTile(worldX, worldY);
    const playerTile = this.bindings.playerController.getFeetTile();
    const interaction = this.interactionSystem.findInteractionAtTile(
      playerTile.x,
      playerTile.y,
      clickedTile.x,
      clickedTile.y,
    );

    if (!interaction) {
      return null;
    }

    this.cancelConflictingActionForTarget(interaction.target);

    if (this.openInteractionChoiceMenuForTarget(interaction.target)) {
      return null;
    }

    return this.executeTargetUse(interaction.target);
  }

  findInteractionTargetAtWorldPoint(worldX: number, worldY: number): InteractionTarget | null {
    if (!this.currentRuntime) {
      return null;
    }

    const clickedTile = this.currentRuntime.isoTilemap.transform.worldToTile(worldX, worldY);
    return this.interactionSystem.findTargetAtTile(clickedTile.x, clickedTile.y);
  }

  isTargetInInteractionRange(
    interactionType: InteractionTargetType,
    targetId: string,
  ): boolean {
    const target = this.findTargetByRef(interactionType, targetId);

    if (!target) {
      return false;
    }

    return this.isTargetStillInRange(
      interactionType,
      targetId,
      target.definition.interactionRangeTiles,
    );
  }

  findInteractionApproachWorldPoint(
    interactionType: InteractionTargetType,
    targetId: string,
  ): Phaser.Math.Vector2 | null {
    if (!this.currentRuntime || !this.bindings) {
      return null;
    }

    const target = this.findTargetByRef(interactionType, targetId);

    if (!target) {
      return null;
    }

    const playerTile = this.bindings.playerController.getFeetTile();
    return findApproachWorldPoint({
      runtime: this.currentRuntime,
      playerTile,
      target,
    });
  }

  triggerTargetInteractionByRef(
    interactionType: InteractionTargetType,
    targetId: string,
  ): InteractionResult | null {
    const target = this.findTargetByRef(interactionType, targetId);

    if (!target || !this.isTargetInInteractionRange(interactionType, targetId)) {
      return null;
    }

    this.cancelConflictingActionForTarget(target);
    return this.executeTargetUse(target);
  }

  inspectTargetByRef(
    interactionType: InteractionTargetType,
    targetId: string,
  ): InteractionResult | null {
    const target = this.findTargetByRef(interactionType, targetId);

    if (!target || !this.isTargetInInteractionRange(interactionType, targetId)) {
      return null;
    }

    return this.inspectTarget(target);
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

  createPrototypeSaveSnapshot(nowMs: number): SaveGameV1 {
    return this.prototypeSaveController.createSnapshot(nowMs);
  }

  restorePrototypeSaveSnapshot(saveGame: SaveGameV1, nowMs: number): RestorePrototypeSaveResult {
    return this.prototypeSaveController.restoreSnapshot(saveGame, nowMs);
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
    this.activeInteractionTiles = null;
    return this.actionBroker.cancel(reason);
  }

  getActiveInteractionTiles(): Array<{ x: number; y: number }> | null {
    return this.activeInteractionTiles;
  }

  setActiveInteractionTiles(tiles: Array<{ x: number; y: number }> | null): void {
    this.activeInteractionTiles = tiles;
  }

  getIsoTransform(): import('../../world/IsoTransform').IsoTransform | null {
    return this.currentRuntime?.isoTilemap.transform ?? null;
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

  confirmChoiceMenu(): InteractionResult | DeferredInteractionAction | null {
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

      case 'use_target':
        if (this.isTargetStillInRange(
          confirmResult.target.definition.interactionType,
          confirmResult.target.definition.id,
          confirmResult.target.definition.interactionRangeTiles,
        )) {
          return this.executeTargetUse(confirmResult.target);
        }

        return {
          kind: 'deferred_interaction_action',
          interactionType: confirmResult.target.definition.interactionType,
          targetId: confirmResult.target.definition.id,
          action: 'use',
        };

      case 'inspect_target':
        if (this.isTargetStillInRange(
          confirmResult.target.definition.interactionType,
          confirmResult.target.definition.id,
          confirmResult.target.definition.interactionRangeTiles,
        )) {
          return this.inspectTarget(confirmResult.target);
        }

        return {
          kind: 'deferred_interaction_action',
          interactionType: confirmResult.target.definition.interactionType,
          targetId: confirmResult.target.definition.id,
          action: 'inspect',
        };

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

  openInteractionChoiceMenuByRef(
    interactionType: InteractionTargetType,
    targetId: string,
  ): boolean {
    const target = this.findTargetByRef(interactionType, targetId);

    if (!target) {
      return false;
    }

    return this.openInteractionChoiceMenuForTarget(target);
  }

  setChoiceMenuSelection(index: number): void {
    this.choiceMenuCoordinator.setSelection(index);
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

    // Action finished (completed or cancelled) — clear tile highlight
    this.activeInteractionTiles = null;

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
    this.recenterCameraOnPlayer();
    this.objectOcclusionSystem = new ObjectOcclusionSystem(this.objectRenderer, this.bindings.player);
  }

  private cancelConflictingActionForTarget(target: InteractionTarget): void {
    const activeAction = this.actionProgressSystem.getSnapshot();

    if (
      !activeAction
      || (
        activeAction.targetId === target.definition.id
        && activeAction.interactionType === target.definition.interactionType
      )
    ) {
      return;
    }

    const cancelMsg = this.actionBroker.cancel('Action cancelled.');

    if (cancelMsg) {
      this.queueInfoResult(cancelMsg);
    }
  }

  private executeTargetUse(target: InteractionTarget): InteractionResult | null {
    if (this.tryOpenChoiceMenu(target)) {
      return null;
    }

    if (target.definition.interactionType === 'resource_node') {
      this.activeInteractionTiles = target.tiles.map((t) => ({ x: t.x, y: t.y }));
      this.actionBroker.start(
        this.actionFactory.createGatherAction(target as ResourceNodeInteractionTarget),
      );
      return null;
    }

    if (target.definition.interactionType === 'workbench') {
      const workbenchTarget = target as WorkbenchInteractionTarget;
      const recipes = this.workbenchSystem.getRecipesForWorkbench(workbenchTarget.anchor.id);

      if (recipes.length === 1) {
        this.activeInteractionTiles = target.tiles.map((t) => ({ x: t.x, y: t.y }));
        this.actionBroker.start(
          this.actionFactory.createWorkbenchCraftAction(
            workbenchTarget.anchor.id,
            recipes[0].id,
          ),
        );
        return null;
      }
    }

    if (target.definition.interactionType === 'placed_object') {
      const placedTarget = target as PlacedObjectInteractionTarget;
      const action = this.actionFactory.createPlacedObjectAction(
        placedTarget,
        this.playerSessionState.getInventoryState(),
      );

      if (action) {
        this.activeInteractionTiles = target.tiles.map((t) => ({ x: t.x, y: t.y }));
        this.actionBroker.start(action);
        return null;
      }
    }

    const result = this.interactionSystem.triggerTarget(target);
    this.actionBroker.emitResultSfx(result);

    if (result.transitionRequest) {
      this.loadMap(result.transitionRequest.targetMapId, result.transitionRequest.targetSpawnId);
    } else {
      this.rebuildInteractionTargets();
    }

    return result;
  }

  private inspectTarget(target: InteractionTarget): InteractionResult {
    const result = this.interactionHandlers.inspectTarget(target);
    this.actionBroker.emitResultSfx(result);
    return result;
  }

  private openInteractionChoiceMenuForTarget(target: InteractionTarget): boolean {
    return this.choiceMenuCoordinator.tryOpen(
      {
        title: getInteractionMenuTitle(target),
        getOptions: () => [
          {
            id: 'use',
            label: getInteractionUseLabel(target),
            details: getInteractionUseDetails(target),
          },
          {
            id: 'inspect',
            label: 'Inspect',
            details: 'Take a closer look.',
          },
        ],
        onConfirm: (optionId) => {
          if (optionId === 'use') {
            return { kind: 'use_target', target };
          }

          if (optionId === 'inspect') {
            return { kind: 'inspect_target', target };
          }

          return { kind: 'none' };
        },
      },
      this.playerSessionState,
    );
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

  private getCurrentPlayerTileSnapshot(): PlayerTileSaveState {
    if (this.bindings) {
      const feetTile = this.bindings.playerController.getFeetTile();

      return {
        tileX: feetTile.x,
        tileY: feetTile.y,
      };
    }

    const spawnPoint = this.mapLoader.getCurrentSpawnPoint();
    return {
      tileX: spawnPoint.tileX,
      tileY: spawnPoint.tileY,
    };
  }

  private isRestorablePlayerTile(tile: PlayerTileSaveState): boolean {
    if (!this.currentRuntime) {
      return false;
    }

    return this.currentRuntime.isoTilemap.isTileInBounds(tile.tileX, tile.tileY)
      && this.currentRuntime.isoTilemap.isTileWalkable(tile.tileX, tile.tileY);
  }

  private setPlayerToTile(tile: PlayerTileSaveState): void {
    if (!this.bindings || !this.currentRuntime) {
      return;
    }

    const point = this.currentRuntime.isoTilemap.getTileCenterWorld(tile.tileX, tile.tileY);
    this.bindings.playerController.setWorldPosition(point.x, point.y);
    this.recenterCameraOnPlayer();
  }

  private recenterCameraOnPlayer(): void {
    if (!this.bindings) {
      return;
    }

    this.scene.cameras.main.centerOn(this.bindings.player.x, this.bindings.player.y);
  }

  private findTargetByRef(
    interactionType: InteractionTargetType,
    targetId: string,
  ): InteractionTarget | null {
    return this.interactionSystem.findTargetByRef(interactionType, targetId);
  }
}
