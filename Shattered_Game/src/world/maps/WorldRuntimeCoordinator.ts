import Phaser from 'phaser';
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
import { InteractionSystem } from '../../interactions/InteractionSystem';
import { ChoiceMenuState } from '../../interactions/ChoiceMenuState';
import type { ChoiceMenuStateSnapshot } from '../../interactions/ChoiceMenuTypes';
import {
  createFootprintInteractionTiles,
  createSingleTileInteractionTiles,
  type ActiveInteraction,
  type ContractBoardInteractionTarget,
  type GenericDebugInteractionTarget,
  type InteractionResult,
  type InteractionTarget,
  type MapTransitionInteractionTarget,
  type NpcInteractionTarget,
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
import type { PlayerItemKey, PlayerInventoryState } from '../../player/PlayerInventoryState';
import type { SkillSnapshot } from '../../skills/SkillTypes';
import type { TaskJournalEntry } from '../../tasks/TaskJournalTypes';
import { MapLoader } from './MapLoader';
import type { LoadedMapRuntime } from './MapRuntime';
import { getMapDisplayName } from './MapDefinitions';
import { getTransitionTiles, MapTransitionSystem } from './MapTransitionSystem';
import { MapTransitionVisualSystem } from './MapTransitionVisualSystem';
import { WorldSessionState } from '../session/WorldSessionState';
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

type ChoiceMenuContext =
  | {
      kind: 'workbench';
      workbenchId: string;
    }
  | {
      kind: 'contract_board';
      boardId: string;
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
  private readonly choiceMenuState = new ChoiceMenuState();
  private readonly interactionSystem = new InteractionSystem({
    onMapTransition: (target) => this.handleMapTransition(target),
    onResourceNode: (target) => this.handleResourceNode(target),
    onNpc: (target) => this.handleNpc(target),
    onWorkbench: (target) => this.handleWorkbench(target),
    onContractBoard: (target) => this.handleContractBoard(target),
    onPlacedObject: (target) => this.handlePlacedObject(target),
    onGenericDebug: (target) => this.handleGenericDebug(target),
  });

  private bindings?: WorldRuntimeBindings;
  private currentRuntime?: LoadedMapRuntime;
  private objectRenderer?: ObjectRenderer;
  private objectPlacementSystem?: ObjectPlacementSystem;
  private objectDebugRenderer?: ObjectDebugRenderer;
  private objectOcclusionSystem?: ObjectOcclusionSystem;
  private choiceMenuContext: ChoiceMenuContext | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    this.mapLoader = new MapLoader(scene);
    this.objectRegistry = new ObjectRegistry(OBJECT_DEFINITIONS);
    this.mapTransitionVisualSystem = new MapTransitionVisualSystem(scene);
    this.placementModeSystem = new PlacementModeSystem(scene, this.itemRegistry);
  }

  loadMap(mapId: string, spawnId: string): LoadedMapRuntime {
    const objectDebugVisible = this.objectDebugRenderer?.isVisible() ?? false;
    this.objectPlacementSystem?.clear();
    this.choiceMenuState.cancel();
    this.choiceMenuContext = null;

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

  updatePlayerRuntimeState(): void {
    if (!this.bindings) {
      return;
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
  }

  triggerActiveInteraction(): InteractionResult | null {
    const activeInteraction = this.interactionSystem.getActiveInteraction();

    if (activeInteraction && this.tryOpenChoiceMenu(activeInteraction.target)) {
      return null;
    }

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

  useItem(itemId: PlayerItemKey): InteractionResult {
    return this.itemUseSystem.useItem(
      itemId,
      this.playerSessionState.getInventoryState(),
      this.scene.time.now,
    );
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
    return this.playerSessionState.getInventoryState();
  }

  getPlayerActiveEffects() {
    return this.playerSessionState.getActiveEffects(this.scene.time.now);
  }

  getPlayerSkillSnapshots(): SkillSnapshot[] {
    return this.playerSessionState.getSkillSnapshots();
  }

  getPlayerCurrencySnapshot() {
    return this.playerSessionState.getCurrencySnapshot();
  }

  getPlayerReputationSnapshot() {
    return this.playerSessionState.getReputationSnapshot();
  }

  getPlacementState(): PlacementPreviewState | null {
    return this.placementModeSystem.getState();
  }

  getChoiceMenuState(): ChoiceMenuStateSnapshot | null {
    return this.choiceMenuState.getSnapshot();
  }

  getTaskJournalEntries(): TaskJournalEntry[] {
    return this.contractBoardSystem.getJournalEntries(this.playerSessionState);
  }

  getActiveTaskCount(): number {
    return this.playerSessionState.getAcceptedContractIds().length;
  }

  isPlacementModeActive(): boolean {
    return this.placementModeSystem.isActive();
  }

  isChoiceMenuOpen(): boolean {
    return this.choiceMenuState.isOpen();
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
      return {
        ok: false,
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

    return result;
  }

  cancelPlacementMode(): string | null {
    if (!this.placementModeSystem.isActive()) {
      return null;
    }

    this.placementModeSystem.cancelPlacement();
    return 'Placement cancelled.';
  }

  moveChoiceMenuSelection(delta: number): ChoiceMenuStateSnapshot | null {
    return this.choiceMenuState.moveSelection(delta);
  }

  confirmChoiceMenu(): InteractionResult | null {
    const selectedOption = this.choiceMenuState.getSelectedOption();

    if (!selectedOption) {
      return null;
    }

    if (selectedOption.disabledReason) {
      return {
        ok: false,
        interactionType: 'generic_debug',
        targetId: selectedOption.id,
        message: selectedOption.disabledReason,
      };
    }

    let result: InteractionResult | null = null;

    if (this.choiceMenuContext?.kind === 'workbench') {
      result = this.workbenchSystem.craftRecipe(
        this.choiceMenuContext.workbenchId,
        selectedOption.id,
        this.playerSessionState,
      );
    } else if (this.choiceMenuContext?.kind === 'contract_board') {
      result = this.contractBoardSystem.selectContract(
        this.choiceMenuContext.boardId,
        selectedOption.id,
        this.playerSessionState,
      );
    }

    this.refreshChoiceMenu();

    if (result) {
      this.rebuildInteractionTargets();
    }

    return result;
  }

  cancelChoiceMenu(): string | null {
    if (!this.choiceMenuState.isOpen()) {
      return null;
    }

    this.choiceMenuState.cancel();
    this.choiceMenuContext = null;
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

    const interactionAnchors = this.currentRuntime.interactionAnchors;
    const targets: InteractionTarget[] = [
      ...this.createTransitionInteractionTargets(this.currentRuntime.transitions),
      ...this.resourceNodeSystem.createInteractionTargets(),
      ...this.workbenchSystem.createInteractionTargets(),
      ...this.contractBoardSystem.createInteractionTargets(),
      ...this.placedStructureSystem.createInteractionTargets(),
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
      this.playerSessionState,
      this.scene.time.now,
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
      this.playerSessionState,
    );
  }

  private handleContractBoard(target: ContractBoardInteractionTarget): InteractionResult {
    return this.contractBoardSystem.useBoard(target.anchor.id, this.playerSessionState);
  }

  private handlePlacedObject(target: PlacedObjectInteractionTarget): InteractionResult {
    if (!this.objectPlacementSystem) {
      return {
        ok: false,
        interactionType: 'placed_object',
        targetId: target.placedObjectId,
        message: 'Nothing happens.',
      };
    }

    return this.placedStructureSystem.interactWithPlacedObject(
      target.placedObjectId,
      this.scene.time.now,
      this.playerSessionState,
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

  private tryOpenChoiceMenu(target: InteractionTarget): boolean {
    if (target.definition.interactionType === 'workbench') {
      const workbenchTarget = target as WorkbenchInteractionTarget;
      const options = this.workbenchSystem.getMenuOptions(
        workbenchTarget.anchor.id,
        this.playerSessionState,
      );

      if (options.length > 1) {
        this.choiceMenuState.open('Workbench Recipes', options);
        this.choiceMenuContext = {
          kind: 'workbench',
          workbenchId: workbenchTarget.anchor.id,
        };
        return true;
      }
    }

    if (target.definition.interactionType === 'contract_board') {
      const contractBoardTarget = target as ContractBoardInteractionTarget;
      const options = this.contractBoardSystem.getMenuOptions(
        contractBoardTarget.anchor.id,
        this.playerSessionState,
      );

      if (options.length > 1) {
        this.choiceMenuState.open('Harbor Contracts', options);
        this.choiceMenuContext = {
          kind: 'contract_board',
          boardId: contractBoardTarget.anchor.id,
        };
        return true;
      }
    }

    return false;
  }

  private refreshChoiceMenu(): void {
    if (!this.choiceMenuContext) {
      return;
    }

    if (this.choiceMenuContext.kind === 'workbench') {
      const options = this.workbenchSystem.getMenuOptions(
        this.choiceMenuContext.workbenchId,
        this.playerSessionState,
      );

      if (options.length === 0) {
        this.choiceMenuState.cancel();
        this.choiceMenuContext = null;
        return;
      }

      this.choiceMenuState.open('Workbench Recipes', options);
      return;
    }

    const options = this.contractBoardSystem.getMenuOptions(
      this.choiceMenuContext.boardId,
      this.playerSessionState,
    );

    if (options.length === 0) {
      this.choiceMenuState.cancel();
      this.choiceMenuContext = null;
      return;
    }

    this.choiceMenuState.open('Harbor Contracts', options);
  }
}
