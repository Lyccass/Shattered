import Phaser from 'phaser';
import { ActionProgressSystem } from '../../actions/ActionProgressSystem';
import { parseEditorObjectDefinitions } from '../../shared/editor/EditorMapModel';
import { parseEditorEncounterAreas } from '../../shared/editor/EditorEncounterModel';
import { WorldEnvironmentState } from '../session/WorldEnvironmentState';
import type { ActionProgressSnapshot } from '../../actions/ActionProgressTypes';
import { ContractBoardSystem } from '../../contracts/ContractBoardSystem';
import { CONTRACT_DEFINITIONS } from '../../contracts/ContractDefinitions';
import { ContractRegistry } from '../../contracts/ContractRegistry';
import { RECIPE_DEFINITIONS } from '../../crafting/RecipeDefinitions';
import { RecipeRegistry } from '../../crafting/RecipeRegistry';
import { canCraftRecipe, applyRecipeToInventory } from '../../crafting/RecipeInventory';
import { OBJECT_DEFINITIONS } from '../../objects/ObjectDefinitions';
import { ObjectDebugRenderer } from '../../objects/ObjectDebugRenderer';
import { ObjectOcclusionSystem } from '../../objects/ObjectOcclusionSystem';
import { ObjectPlacementSystem } from '../../objects/ObjectPlacementSystem';
import { ObjectRegistry } from '../../objects/ObjectRegistry';
import '../../items/ItemDefinitions';
import { ItemRegistry } from '../../items/ItemRegistry';
import { ItemUseSystem } from '../../items/ItemUseSystem';
import type { PlayerTileSaveState, SaveGameV1 } from '../../persistence/SaveTypes';
import { ChoiceMenuCoordinator } from '../../interactions/ChoiceMenuCoordinator';
import { InteractionActionFactory } from '../../interactions/InteractionActionFactory';
import { InteractionSystem } from '../../interactions/InteractionSystem';
import {
  type ActiveInteraction,
  type GroundItemInteractionTarget,
  type InteractionResult,
  type InteractionTarget,
} from '../../interactions/InteractionTypes';
import {
  PlacementModeSystem,
  type PlacementPreviewState,
} from '../../interactions/PlacementModeSystem';
import { PlacedStructureSystem } from '../../interactions/PlacedStructureSystem';
import { ResourceNodeSystem } from '../../interactions/ResourceNodeSystem';
import { WorkbenchSystem } from '../../interactions/WorkbenchSystem';
import type { EquipmentSlot } from '../../equipment/EquipmentTypes';
import { getAbilityDefinition, type AbilitySlotType } from '../../combat/abilities/CombatAbilityDefinitions';
import { PlayerSessionState } from '../../player/PlayerSessionState';
import type { PlayerFacingDirection } from '../../player/PlayerFacing';
import type { LevelUpEvent, SkillId, SkillSnapshot, SkillXpDelta } from '../../skills/SkillTypes';
import type { TaskJournalEntry } from '../../tasks/TaskJournalTypes';
import type { UiStateSnapshot } from '../../ui/UiTypes';
import { UiStateAggregator } from '../../ui/UiStateAggregator';
import type { GameEventBus } from '../../events/GameEventBus';
import { MapLoader } from './MapLoader';
import type { LoadedMapRuntime } from './MapRuntime';
import { MapTransitionSystem } from './MapTransitionSystem';
import { MapTransitionVisualSystem } from './MapTransitionVisualSystem';
import { WorldSessionState } from '../session/WorldSessionState';
import { WorldActionBroker } from './WorldActionBroker';
import { WorldInteractionHandlers } from './WorldInteractionHandlers';
import {
  type RestorePrototypeSaveResult,
  WorldPrototypeSaveController,
} from './WorldPrototypeSaveController';
import { WorldObjectManager } from './WorldObjectManager';
import {
  type DeferredInteractionAction,
  WorldInteractionOrchestrator,
} from './WorldInteractionOrchestrator';
import {
  type WorldRuntimeBindings,
  WorldMapRuntimeConfigurator,
} from './WorldMapRuntimeConfigurator';
import { WorldInteractionTargetCoordinator } from './WorldInteractionTargetCoordinator';
import { NpcRegistry } from '../../npcs/NpcRegistry';
import { NpcSystem } from '../../npcs/NpcSystem';
import { NpcVisualController } from '../../npcs/NpcVisualController';
import { ShopSystem } from '../../trading/ShopSystem';
import type { ShopSnapshot } from '../../trading/TraderTypes';
import { WorldChunkStreamingReconciler } from './WorldChunkStreamingReconciler';
import { synthesizeEditorAreaSpawns } from './WorldEncounterSpawnBridge';
import { WorldPlacementController } from './WorldPlacementController';

export type { DeferredInteractionAction } from './WorldInteractionOrchestrator';

type InteractionTargetType = InteractionTarget['definition']['interactionType'];

export class WorldRuntimeCoordinator {
  private readonly mapLoader: MapLoader;
  private readonly objectRegistry: ObjectRegistry;
  private readonly itemRegistry = new ItemRegistry();
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
  private readonly objectManager: WorldObjectManager;
  private readonly interactionOrchestrator: WorldInteractionOrchestrator;
  private readonly mapRuntimeConfigurator: WorldMapRuntimeConfigurator;
  private readonly interactionTargetCoordinator: WorldInteractionTargetCoordinator;

  private readonly npcRegistry = new NpcRegistry();
  private npcSystem: NpcSystem | null = null;
  private npcVisualController: NpcVisualController | null = null;
  private readonly shopSystem = new ShopSystem();
  private readonly worldEnv = new WorldEnvironmentState();
  private readonly streamingReconciler: WorldChunkStreamingReconciler;

  private bindings?: WorldRuntimeBindings;
  private currentRuntime?: LoadedMapRuntime;
  private readonly pendingUiResults: InteractionResult[] = [];
  private activeInteractionTiles: Array<{ x: number; y: number }> | null = null;
  private destroyed = false;
  private groundItemCollector: ((id: string) => { itemId: string; count: number } | null) | null = null;
  private homewardMark: { mapId: string; tileX: number; tileY: number } | null = null;

  private readonly actionFactory: InteractionActionFactory;
  private readonly uiAggregator: UiStateAggregator;
  private readonly prototypeSaveController: WorldPrototypeSaveController;
  private readonly placementController: WorldPlacementController;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly eventBus: GameEventBus,
  ) {
    this.mapLoader = new MapLoader(scene);
    this.objectRegistry = new ObjectRegistry(OBJECT_DEFINITIONS);
    this.objectManager = new WorldObjectManager(scene, this.objectRegistry);
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
      () => this.objectManager.getPlacementSystem(),
      this.npcRegistry,
      () => this.npcSystem,
    );
    this.interactionSystem = new InteractionSystem({
      ...this.interactionHandlers.build(),
      onGroundItem: (target) => this.handleGroundItemInteraction(target),
    });

    this.mapRuntimeConfigurator = new WorldMapRuntimeConfigurator({
      contractBoardSystem: this.contractBoardSystem,
      getActiveObjectCountForDefinition: (definitionId) =>
        this.placedStructureSystem.getActiveObjectCountForDefinition(definitionId),
      interactionSystem: this.interactionSystem,
      mapLoader: this.mapLoader,
      mapTransitionSystem: this.mapTransitionSystem,
      mapTransitionVisualSystem: this.mapTransitionVisualSystem,
      objectManager: this.objectManager,
      placementModeSystem: this.placementModeSystem,
      placedStructureSystem: this.placedStructureSystem,
      recenterCameraOnPlayer: () => this.recenterCameraOnPlayer(),
      resourceNodeSystem: this.resourceNodeSystem,
      scene: this.scene,
      workbenchSystem: this.workbenchSystem,
    });

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
      () => this.objectManager.getPlacementSystem(),
      () => this.scene.time.now,
    );

    this.interactionOrchestrator = new WorldInteractionOrchestrator({
      actionBroker: this.actionBroker,
      actionFactory: this.actionFactory,
      choiceMenuCoordinator: this.choiceMenuCoordinator,
      contractBoardSystem: this.contractBoardSystem,
      interactionHandlers: this.interactionHandlers,
      interactionSystem: this.interactionSystem,
      isTargetStillInRange: (interactionType, targetId, rangeTiles) =>
        this.isTargetStillInRange(interactionType, targetId, rangeTiles),
      loadMap: (mapId, spawnId) => {
        this.loadMap(mapId, spawnId);
      },
      playerSessionState: this.playerSessionState,
      rebuildInteractionTargets: () => this.rebuildInteractionTargets(),
      setActiveInteractionTiles: (tiles) => {
        this.activeInteractionTiles = tiles;
      },
      workbenchSystem: this.workbenchSystem,
    });

    this.interactionTargetCoordinator = new WorldInteractionTargetCoordinator({
      cancelConflictingActionForTarget: (target) => this.cancelConflictingActionForTarget(target),
      getBindings: () => this.bindings,
      getRuntime: () => this.currentRuntime,
      interactionOrchestrator: this.interactionOrchestrator,
      interactionSystem: this.interactionSystem,
      mapTransitionSystem: this.mapTransitionSystem,
      mapTransitionVisualSystem: this.mapTransitionVisualSystem,
    });

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

    this.streamingReconciler = new WorldChunkStreamingReconciler({
      scene: this.scene,
      npcRegistry: this.npcRegistry,
      objectManager: this.objectManager,
      mapTransitionSystem: this.mapTransitionSystem,
      mapTransitionVisualSystem: this.mapTransitionVisualSystem,
      resourceNodeSystem: this.resourceNodeSystem,
      getNpcSystem: () => this.npcSystem,
      getNpcVisualController: () => this.npcVisualController,
      getCurrentRuntime: () => this.currentRuntime,
      onReconciled: () => this.rebuildInteractionTargets(),
    });

    this.worldEnv.onChange((vars) => {
      this.contractBoardSystem.setEnvironmentVariables(vars as Record<string, number | string>);
      this.shopSystem.setPriceMultiplier(this.worldEnv.getShopPriceMultiplier());
    });

    this.placementController = new WorldPlacementController(
      this.placementModeSystem,
      this.placedStructureSystem,
      this.itemRegistry,
      this.eventBus,
      {
        getPlayerController: () => this.bindings?.playerController ?? null,
        hasActiveRuntime: () => !!this.currentRuntime,
        getInventory: () => this.playerSessionState.getInventoryState(),
        getObjectPlacementSystem: () => this.objectManager.getPlacementSystem() ?? null,
        getNowMs: () => this.scene.time.now,
        rebuildInteractionTargets: () => this.rebuildInteractionTargets(),
      },
    );
  }

  applyAreaCleared(clearedCount: number): void {
    this.worldEnv.onAreaCleared(clearedCount);
  }

  getEnvironmentThreatLevel(): number {
    return this.worldEnv.getThreatLevel();
  }

  loadMap(mapId: string, spawnId: string): LoadedMapRuntime {
    // Destroy old per-map Phaser objects before replacing them.
    this.mapRuntimeConfigurator.clearPreviousMapRuntime();

    this.choiceMenuCoordinator.cancel();
    this.actionProgressSystem.cancel();

    const runtime = this.mapLoader.loadMap(mapId, spawnId);
    this.objectRegistry.addDefinitions(
      parseEditorObjectDefinitions(runtime.definition.metadata?.editorObjectDefinitions),
    );
    this.currentRuntime = runtime;

    this.npcSystem?.destroy();
    this.npcVisualController?.destroy();
    this.npcSystem = new NpcSystem();
    this.npcVisualController = new NpcVisualController(this.scene);

    const nowMs = this.scene.time.now;
    const npcAnchors = runtime.interactionAnchors.filter((a) => a.interactionType === 'npc');
    for (const anchor of npcAnchors) {
      const npcAnchor = anchor as import('../../shared/map/MapTypes').MapNpcAnchor;
      if (!npcAnchor.npcDefinitionId || !this.npcRegistry.has(npcAnchor.npcDefinitionId)) continue;
      const def = this.npcRegistry.get(npcAnchor.npcDefinitionId);
      this.npcSystem.spawn(
        npcAnchor.id,
        def,
        npcAnchor.tileX,
        npcAnchor.tileY,
        npcAnchor.patrolTiles ?? [],
        runtime.isoTilemap,
        nowMs,
      );
    }

    const editorAreas = parseEditorEncounterAreas(runtime.definition.metadata?.editorEncounterAreas);
    runtime.enemySpawns = synthesizeEditorAreaSpawns(editorAreas, runtime.definition.id);

    this.mapRuntimeConfigurator.configureLoadedRuntime(runtime);
    this.streamingReconciler.reconcile(runtime);

    if (this.bindings) {
      this.rebindSceneSystems();
    }

    return runtime;
  }

  async loadWorldManifest(manifestUrl: string, spawnId: string): Promise<LoadedMapRuntime> {
    // Destroy old per-map Phaser objects before replacing them.
    this.mapRuntimeConfigurator.clearPreviousMapRuntime();

    this.choiceMenuCoordinator.cancel();
    this.actionProgressSystem.cancel();

    const runtime = await this.mapLoader.loadWorldManifest(manifestUrl, spawnId);
    this.currentRuntime = runtime;

    this.npcSystem?.destroy();
    this.npcVisualController?.destroy();
    this.npcSystem = new NpcSystem();
    this.npcVisualController = new NpcVisualController(this.scene);

    this.mapRuntimeConfigurator.configureLoadedRuntime(runtime);
    this.streamingReconciler.reconcile(runtime);
    this.applyRegionEnvironment(runtime);

    if (this.bindings) {
      this.rebindSceneSystems();
    }

    return runtime;
  }

  prepareMapAssets(mapId: string): Promise<void> {
    return this.mapLoader.prepareMapAssets(mapId);
  }

  bindSceneSystems(bindings: WorldRuntimeBindings): void {
    this.bindings = bindings;

    if (this.currentRuntime) {
      this.rebindSceneSystems();
    }
  }

  updateActiveInteraction(tileX: number, tileY: number): ActiveInteraction | null {
    return this.interactionTargetCoordinator.updateActiveInteraction(tileX, tileY);
  }

  updatePlayerRuntimeState(deltaMs = 0): InteractionResult[] {
    if (!this.bindings) {
      return [];
    }

    const nowMs = this.scene.time.now;
    this.playerSessionState.update(nowMs);
    this.shopSystem.update(nowMs);
    const resourceStateChanged = this.resourceNodeSystem.updateRuntimeState(
      nowMs,
      this.objectManager.getPlacementSystem(),
    );
    const placedStateChanged = this.placedStructureSystem.updateRuntimeState(
      nowMs,
      this.objectManager.getPlacementSystem(),
    );

    if (resourceStateChanged || placedStateChanged) {
      this.rebuildInteractionTargets();
    }

    if (this.npcSystem && this.npcVisualController && this.currentRuntime) {
      this.npcSystem.update(nowMs, deltaMs, this.currentRuntime.isoTilemap);
      const displayNames = new Map(
        this.npcSystem.getStates().map((s) => {
          const def = this.npcSystem!.getDefinition(s.definitionId);
          return [s.definitionId, def?.displayName ?? s.definitionId];
        }),
      );
      this.npcVisualController.syncAll(this.npcSystem.getStates(), displayNames);
    }

    const feetTile = this.bindings.playerController.getFeetTile();
    if (this.currentRuntime) {
      void this.streamingReconciler.tryStreamAroundTile(feetTile.x, feetTile.y, this.currentRuntime);
    }

    const autoTransition = this.mapTransitionSystem.getTransitionAtTile(feetTile.x, feetTile.y);
    if (autoTransition && !this.actionProgressSystem.isActive()) {
      void this.loadTransitionDestination(autoTransition.targetMapId, autoTransition.targetSpawnId);
      return this.consumePendingUiResults();
    }

    this.updateActiveInteraction(feetTile.x, feetTile.y);
    this.placementController.updatePreview();
    this.updateActionProgress(deltaMs);
    return this.consumePendingUiResults();
  }

  triggerActiveInteraction(): InteractionResult | null {
    return this.interactionTargetCoordinator.triggerActiveInteraction();
  }

  triggerPointerInteraction(worldX: number, worldY: number): InteractionResult | null {
    return this.interactionTargetCoordinator.triggerPointerInteraction(worldX, worldY);
  }

  findInteractionTargetAtWorldPoint(worldX: number, worldY: number): InteractionTarget | null {
    return this.interactionTargetCoordinator.findInteractionTargetAtWorldPoint(worldX, worldY);
  }

  isTargetInInteractionRange(
    interactionType: InteractionTargetType,
    targetId: string,
  ): boolean {
    return this.interactionTargetCoordinator.isTargetInInteractionRange(interactionType, targetId);
  }

  findInteractionApproachWorldPoint(
    interactionType: InteractionTargetType,
    targetId: string,
  ): Phaser.Math.Vector2 | null {
    return this.interactionTargetCoordinator.findInteractionApproachWorldPoint(
      interactionType,
      targetId,
    );
  }

  triggerTargetInteractionByRef(
    interactionType: InteractionTargetType,
    targetId: string,
  ): InteractionResult | null {
    return this.interactionTargetCoordinator.triggerTargetInteractionByRef(
      interactionType,
      targetId,
    );
  }

  inspectTargetByRef(
    interactionType: InteractionTargetType,
    targetId: string,
  ): InteractionResult | null {
    return this.interactionTargetCoordinator.inspectTargetByRef(interactionType, targetId);
  }

  useItem(itemId: string): InteractionResult {
    const itemDefinition = this.itemRegistry.get(itemId);

    if (itemDefinition.placementObjectDefinitionId) {
      return this.placeItemInFacingDirection(itemId);
    }

    if (itemDefinition.equipment) {
      const requiredSkill = getEquipmentRequirementSkill(itemDefinition.equipment.slot, !!itemDefinition.equipment.weaponStats);
      const requiredLevel = itemDefinition.equipment.requiredLevel ?? 1;
      const currentLevel = this.playerSessionState.getSkillLevel(requiredSkill);
      if (currentLevel < requiredLevel) {
        return {
          ok: false,
          interactionType: 'item_use',
          targetId: itemId,
          message: `Requires ${formatSkillName(requiredSkill)} level ${requiredLevel}.`,
        };
      }

      const slot = itemDefinition.equipment.slot;
      const equipState = this.playerSessionState.getEquipmentState();
      const previousId = equipState.getEquippedId(slot);
      const equipped = equipState.equip(slot, itemId);
      if (!equipped) {
        return { ok: false, interactionType: 'item_use', targetId: itemId, message: `Cannot equip ${itemDefinition.name}.` };
      }
      const inv = this.playerSessionState.getInventoryState();
      inv.consume(itemId, 1);
      if (previousId) inv.add(previousId, 1);
      return { ok: true, interactionType: 'item_use', targetId: itemId, message: `Equipped ${itemDefinition.name}.` };
    }

    const result = this.itemUseSystem.useItem(
      itemId,
      this.playerSessionState.getInventoryState(),
      this.scene.time.now,
    );

    this.actionBroker.emitResultSfx(result);
    return result;
  }

  unequipSlot(slot: EquipmentSlot): InteractionResult {
    const equipState = this.playerSessionState.getEquipmentState();
    const itemId = equipState.getEquippedId(slot);
    if (!itemId) {
      return { ok: false, interactionType: 'item_use', targetId: '', message: 'Nothing equipped there.' };
    }
    equipState.unequip(slot);
    this.playerSessionState.getInventoryState().add(itemId, 1);
    const name = this.itemRegistry.get(itemId)?.name ?? itemId;
    return { ok: true, interactionType: 'item_use', targetId: itemId, message: `Unequipped ${name}.` };
  }

  getPlayerInventorySnapshot() {
    return this.playerSessionState.getInventorySnapshot();
  }

  getPlayerCurrencySnapshot() {
    return this.playerSessionState.getCurrencySnapshot();
  }

  // ─── Shop ────────────────────────────────────────────────────────────────────

  getShopSnapshot(shopId: string): ShopSnapshot | null {
    return this.shopSystem.getSnapshot(shopId);
  }

  tryBuyFromShop(shopId: string, itemId: string, qty = 1): { ok: boolean; message: string } {
    return this.shopSystem.tryBuy(shopId, itemId, this.playerSessionState, qty);
  }

  trySellToShop(shopId: string, itemId: string, qty = 1): { ok: boolean; message: string } {
    return this.shopSystem.trySell(shopId, itemId, this.playerSessionState, qty);
  }

  placeItemInFacingDirection(itemId: string): InteractionResult {
    return this.placementController.placeItemInFacingDirection(itemId);
  }

  collectGroundItem(itemId: string, count: number): void {
    this.playerSessionState.getInventoryState().add(itemId, count);
  }

  seedStartingInventory(items: Record<string, number>): void {
    this.playerSessionState.getInventoryState().addMany(items);
    // Give the player a small purse to get started with trading
    this.playerSessionState.getCurrencyState().addCopper(250);
  }

  grantItem(itemId: string, count = 1): void {
    this.playerSessionState.getInventoryState().add(itemId, count);
  }

  consumeItem(itemId: string, count = 1): boolean {
    return this.playerSessionState.getInventoryState().consume(itemId, count);
  }

  setGroundItemCollector(fn: (id: string) => { itemId: string; count: number } | null): void {
    this.groundItemCollector = fn;
  }

  setDynamicInteractionTargets(targets: InteractionTarget[]): void {
    this.interactionSystem.setDynamicTargets(targets);
  }

  private handleGroundItemInteraction(target: GroundItemInteractionTarget): InteractionResult {
    const inventory = this.playerSessionState.getInventoryState();
    const isStackable = (id: string) => this.itemRegistry.find(id)?.stackable ?? false;
    if (!inventory.canAdd(target.itemId, target.count, isStackable, 28)) {
      return { ok: false, interactionType: 'ground_item', targetId: target.dropId, message: 'Not enough space in your inventory.', toastKind: 'error' };
    }
    const collected = this.groundItemCollector?.(target.dropId) ?? null;
    if (!collected) {
      return { ok: false, interactionType: 'ground_item', targetId: target.dropId, message: 'Item already gone.' };
    }
    this.collectGroundItem(collected.itemId, collected.count);
    const meta = this.itemRegistry.find(collected.itemId);
    const label = meta?.name ?? collected.itemId;
    const countStr = collected.count > 1 ? `${collected.count}× ` : '';
    return {
      ok: true,
      interactionType: 'ground_item',
      targetId: target.dropId,
      message: `Picked up ${countStr}${label}.`,
      toastKind: 'success',
    };
  }

  dropItemFromInventory(itemId: string): { ok: boolean; worldX: number; worldY: number } {
    const inventory = this.playerSessionState.getInventoryState();
    const playerController = this.bindings?.playerController;
    if (!playerController) return { ok: false, worldX: 0, worldY: 0 };

    const consumed = inventory.consume(itemId, 1);
    if (!consumed) return { ok: false, worldX: 0, worldY: 0 };

    const feet = playerController.getFeetPoint();
    return { ok: true, worldX: feet.x, worldY: feet.y };
  }

  getItemDisplayData(itemId: string): { displayName: string; description: string } | undefined {
    const def = this.itemRegistry.find(itemId);
    return def ? { displayName: def.name, description: def.examine } : undefined;
  }

  tryHandCraft(sourceId: string, targetId: string): InteractionResult {
    const recipe = this.recipeRegistry.findHandRecipeForItems(sourceId, targetId);
    if (!recipe) {
      return {
        ok: false,
        interactionType: 'generic_debug',
        targetId: sourceId,
        message: `Nothing interesting happens.`,
        toastKind: 'info',
      };
    }

    const inventory = this.playerSessionState.getInventoryState();
    if (!canCraftRecipe(recipe, inventory)) {
      return {
        ok: false,
        interactionType: 'generic_debug',
        targetId: sourceId,
        message: `You don't have the required materials.`,
        toastKind: 'error',
      };
    }

    applyRecipeToInventory(recipe, inventory);
    const xpDelta = recipe.xpRewards ?? {};
    const levelUps = Object.keys(xpDelta).length > 0
      ? this.playerSessionState.getSkillProgressionSystem().addXpDelta(xpDelta)
      : [];

    return {
      ok: true,
      interactionType: 'generic_debug',
      targetId: recipe.id,
      message: `You crafted: ${recipe.displayName}.`,
      sfxId: 'craft_success',
      toastKind: 'reward',
      xpDelta,
      levelUps: levelUps.length > 0 ? levelUps : undefined,
    };
  }

  hasActiveRuntime(): boolean {
    return !!this.currentRuntime;
  }

  getNpcWorldPositions(): Array<{ worldX: number; worldY: number }> {
    return this.npcSystem?.getStates().map((s) => ({ worldX: s.worldX, worldY: s.worldY })) ?? [];
  }

  getCurrentRuntime(): LoadedMapRuntime {
    if (!this.currentRuntime) {
      throw new Error('WorldRuntimeCoordinator: no map runtime is active');
    }

    return this.currentRuntime;
  }

  getDerivedStats() {
    return this.playerSessionState.getDerivedStats();
  }

  getEquipmentSnapshot() {
    return this.playerSessionState.getEquipmentSnapshot();
  }

  getEquippedTurnAbilities() {
    return this.playerSessionState.getEquippedTurnAbilities();
  }

  getCombatCooldownSnapshot() {
    return this.playerSessionState.getCombatCooldownSnapshot();
  }

  setCombatCooldownSnapshot(snapshot: {
    attackCooldowns: Record<string, number>;
    abilityCooldowns: Record<string, number>;
  }): void {
    this.playerSessionState.setCombatCooldownSnapshot(snapshot);
  }

  equipSpellbookAbility(slotType: AbilitySlotType, slotIndex: number, abilityId: string | null): boolean {
    return this.playerSessionState.equipSpellbookAbility(slotType, slotIndex, abilityId);
  }

  useUtilitySpell(abilityId: string): InteractionResult {
    const ability = getAbilityDefinition(abilityId);
    if (!ability || ability.slotType !== 'utility_spell') {
      return {
        ok: false,
        interactionType: 'utility_spell',
        targetId: abilityId,
        message: 'That is not a utility spell.',
        toastKind: 'error',
      };
    }

    const isEquipped = this.playerSessionState.getSpellbookSnapshot()
      .utilitySlots.some((slot) => slot.abilityId === abilityId);
    if (!isEquipped) {
      return {
        ok: false,
        interactionType: 'utility_spell',
        targetId: abilityId,
        message: `${ability.displayName} is not prepared.`,
        toastKind: 'error',
      };
    }

    switch (abilityId) {
      case 'utility_homeward_mark':
        return this.useHomewardMark(abilityId);
      case 'utility_waystep':
        return this.useWaystep(abilityId);
      case 'utility_camp_recall':
        return {
          ok: false,
          interactionType: 'utility_spell',
          targetId: abilityId,
          message: 'No camp recall point is prepared yet.',
          toastKind: 'error',
        };
      default:
        return {
          ok: false,
          interactionType: 'utility_spell',
          targetId: abilityId,
          message: `${ability.displayName} has no effect yet.`,
          toastKind: 'error',
        };
    }
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
    return this.placementController.getPlacementState();
  }

  getTaskJournalEntries(): TaskJournalEntry[] {
    return this.contractBoardSystem.getJournalEntries(this.playerSessionState);
  }

  getPlayerSkillSnapshots(): SkillSnapshot[] {
    return this.playerSessionState.getSkillSnapshots();
  }

  getSkillLevel(skillId: SkillId): number {
    return this.playerSessionState.getSkillLevel(skillId);
  }

  addCombatXp(delta: SkillXpDelta): LevelUpEvent[] {
    return this.playerSessionState.getSkillProgressionSystem().addXpDelta(delta);
  }

  drainAllInventoryItems(): Array<{ id: string; count: number }> {
    const inventory = this.playerSessionState.getInventoryState();
    const items = inventory.listOccupied();
    inventory.clearAll();
    return items;
  }

  consumePendingUiResults(): InteractionResult[] {
    return this.pendingUiResults.splice(0);
  }

  isPlacementModeActive(): boolean {
    return this.placementController.isActive();
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

  startPlacementMode(itemId: string = 'firestarter_set'): string {
    return this.placementController.start(itemId);
  }

  confirmPlacementMode(): InteractionResult | null {
    return this.placementController.confirm();
  }

  cancelPlacementMode(): string | null {
    return this.placementController.cancel();
  }

  moveChoiceMenuSelection(delta: number): void {
    this.choiceMenuCoordinator.moveSelection(delta);
  }

  confirmChoiceMenu(): InteractionResult | DeferredInteractionAction | null {
    return this.interactionOrchestrator.confirmChoiceMenu();
  }

  cancelChoiceMenu(): string | null {
    if (!this.choiceMenuCoordinator.isOpen()) {
      return null;
    }

    this.choiceMenuCoordinator.cancel();
    return 'Menu closed.';
  }

  getIsoTilemap(): LoadedMapRuntime['isoTilemap'] {
    return this.getCurrentRuntime().isoTilemap;
  }

  getMapLoader(): MapLoader {
    return this.mapLoader;
  }

  getMapTransitionSystem(): MapTransitionSystem {
    return this.mapTransitionSystem;
  }

  getObjectPlacementSystem(): ObjectPlacementSystem | undefined {
    return this.objectManager.getPlacementSystem();
  }

  getObjectDebugRenderer(): ObjectDebugRenderer | undefined {
    return this.objectManager.getDebugRenderer();
  }

  getObjectOcclusionSystem(): ObjectOcclusionSystem | undefined {
    return this.objectManager.getOcclusionSystem();
  }

  openInteractionChoiceMenuByRef(
    interactionType: InteractionTargetType,
    targetId: string,
  ): boolean {
    return this.interactionTargetCoordinator.openInteractionChoiceMenuByRef(
      interactionType,
      targetId,
    );
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
    this.mapRuntimeConfigurator.destroy();
    this.npcSystem?.destroy();
    this.npcVisualController?.destroy();
    this.npcSystem = null;
    this.npcVisualController = null;
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
      void this.loadTransitionDestination(
        update.transitionRequest.targetMapId,
        update.transitionRequest.targetSpawnId,
      );
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
    return this.interactionTargetCoordinator.isTargetStillInRange(
      interactionType,
      targetId,
      rangeTiles,
    );
  }

  private rebuildInteractionTargets(): void {
    this.mapRuntimeConfigurator.rebuildInteractionTargets(this.currentRuntime);
  }

  private async loadTransitionDestination(targetMapId: string, targetSpawnId: string): Promise<void> {
    const manifestUrl = `/data/worlds/${targetMapId}/world.manifest.json`;

    try {
      await this.loadWorldManifest(manifestUrl, targetSpawnId);
    } catch (error) {
      try {
        this.loadMap(targetMapId, targetSpawnId);
      } catch (fallbackError) {
        console.error(
          `[WorldRuntimeCoordinator] Failed to load transition target "${targetMapId}" via world manifest or registered map:`,
          { error, fallbackError },
        );
        this.queueInfoResult(`Could not travel to ${targetMapId}.`);
      }
    }
  }

  private rebindSceneSystems(): void {
    if (!this.bindings || !this.currentRuntime) {
      return;
    }

    this.mapRuntimeConfigurator.rebindSceneSystems(this.currentRuntime, this.bindings);
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

  private useHomewardMark(abilityId: string): InteractionResult {
    if (!this.bindings || !this.currentRuntime) {
      return {
        ok: false,
        interactionType: 'utility_spell',
        targetId: abilityId,
        message: 'Magic is unavailable right now.',
        toastKind: 'error',
      };
    }

    const currentTile = this.bindings.playerController.getFeetTile();
    const currentMapId = this.currentRuntime.definition.id;

    if (!this.homewardMark) {
      this.homewardMark = { mapId: currentMapId, tileX: currentTile.x, tileY: currentTile.y };
      return {
        ok: true,
        interactionType: 'utility_spell',
        targetId: abilityId,
        message: 'Homeward Mark set.',
        toastKind: 'success',
      };
    }

    if (this.homewardMark.mapId !== currentMapId) {
      return {
        ok: false,
        interactionType: 'utility_spell',
        targetId: abilityId,
        message: 'Your Homeward Mark is on another map.',
        toastKind: 'error',
      };
    }

    if (!this.isRestorablePlayerTile(this.homewardMark)) {
      this.homewardMark = { mapId: currentMapId, tileX: currentTile.x, tileY: currentTile.y };
      return {
        ok: true,
        interactionType: 'utility_spell',
        targetId: abilityId,
        message: 'Old mark was blocked. Homeward Mark reset here.',
        toastKind: 'success',
      };
    }

    this.setPlayerToTile(this.homewardMark);
    return {
      ok: true,
      interactionType: 'utility_spell',
      targetId: abilityId,
      message: 'Returned to your Homeward Mark.',
      toastKind: 'success',
    };
  }

  private useWaystep(abilityId: string): InteractionResult {
    if (!this.bindings || !this.currentRuntime) {
      return {
        ok: false,
        interactionType: 'utility_spell',
        targetId: abilityId,
        message: 'Magic is unavailable right now.',
        toastKind: 'error',
      };
    }

    const origin = this.bindings.playerController.getFeetTile();
    const facing = this.bindings.playerController.getFacingDirection();
    const delta = facingToTileDelta(facing);
    const maxTiles = 2;

    for (let distance = maxTiles; distance >= 1; distance -= 1) {
      const target = {
        tileX: origin.x + delta.x * distance,
        tileY: origin.y + delta.y * distance,
      };
      if (this.isRestorablePlayerTile(target)) {
        this.setPlayerToTile(target);
        return {
          ok: true,
          interactionType: 'utility_spell',
          targetId: abilityId,
          message: `Waystepped ${distance} tile${distance === 1 ? '' : 's'}.`,
          toastKind: 'success',
        };
      }
    }

    return {
      ok: false,
      interactionType: 'utility_spell',
      targetId: abilityId,
      message: 'No clear tile ahead for Waystep.',
      toastKind: 'error',
    };
  }

  private recenterCameraOnPlayer(): void {
    if (!this.bindings) {
      return;
    }

    this.scene.cameras.main.centerOn(this.bindings.player.x, this.bindings.player.y);
  }

  private applyRegionEnvironment(runtime: import('./MapRuntime').LoadedMapRuntime): void {
    const rawEnv = runtime.streamedWorld?.provider.getManifest().metadata?.environmentVariables;
    if (rawEnv !== null && typeof rawEnv === 'object' && !Array.isArray(rawEnv)) {
      this.worldEnv.setInitial(rawEnv as Record<string, unknown>);
    }
  }
}

function getEquipmentRequirementSkill(slot: EquipmentSlot, isWeapon: boolean): SkillId {
  if (slot === 'ammo') return 'ranged';
  if (isWeapon) return 'melee';
  return 'melee';
}

function formatSkillName(skillId: SkillId): string {
  switch (skillId) {
    case 'melee': return 'Melee';
    case 'ranged': return 'Ranged';
    case 'magic': return 'Magic';
    case 'devotion': return 'Devotion';
    default: return skillId;
  }
}

function facingToTileDelta(facing: PlayerFacingDirection): { x: number; y: number } {
  switch (facing) {
    case 'up': return { x: 0, y: -1 };
    case 'down': return { x: 0, y: 1 };
    case 'left': return { x: -1, y: 0 };
    case 'right': return { x: 1, y: 0 };
  }
}
