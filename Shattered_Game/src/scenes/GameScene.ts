import Phaser from 'phaser';
import { SfxSystem } from '../audio/SfxSystem';
import { CameraSystem } from '../camera/CameraSystem';
import { CombatSandboxSystem } from '../combat/CombatSandboxSystem';
import { createEnemyAnimations, preloadEnemyAssets } from '../combat/EnemyAssets';
import { TelegraphSystem } from '../combat/TelegraphSystem';
import { DebugOverlaySystem } from '../debug/DebugOverlaySystem';
import { GameEventBus } from '../events/GameEventBus';
import { GameInteractionController } from '../game/input/GameInteractionController';
import { GameSaveController } from '../game/persistence/GameSaveController';
import { InputSystem } from '../input/InputSystem';
import type { InputCallbacks, InputMode } from '../input/InputTypes';
import { preloadObjectAssets } from '../objects/ObjectAssets';
import { RENDER_DEPTHS } from '../render/RenderLayers';
import {
  createPlayerAnimations,
  PLAYER_TEXTURE_KEY,
  preloadPlayerAssets,
} from '../player/PlayerAssets';
import { PLAYER_CONFIG } from '../player/PlayerConfig';
import { PlayerController } from '../player/PlayerController';
import type { PlayerItemKey } from '../player/PlayerInventoryState';
import { UiManager } from '../ui/UiManager';
import { emptyUiStateSnapshot } from '../ui/UiTypes';
import type { LoadedMapRuntime } from '../world/maps/MapRuntime';
import { getPublishedEditorMapId } from '../world/maps/MapDefinitions';
import {
  type DeferredInteractionAction,
  WorldRuntimeCoordinator,
} from '../world/maps/WorldRuntimeCoordinator';
import { createTerrainRenderTextures, preloadTerrainAssets } from '../world/TerrainAssets';
import type { InteractionResult } from '../interactions/InteractionTypes';
import { GroundItemSystem } from '../world/items/GroundItemSystem';
import type { EnemyKilledEvent } from '../combat/CombatSandboxSystem';
import { ENEMY_DEFINITIONS } from '../combat/EnemyDefinitions';

export class GameScene extends Phaser.Scene {
  private readonly gameEventBus = new GameEventBus();
  private player?: Phaser.GameObjects.Sprite;
  private playerController?: PlayerController;
  private cameraSystem?: CameraSystem;
  private telegraphSystem?: TelegraphSystem;
  private combatSandboxSystem?: CombatSandboxSystem;
  private debugOverlaySystem?: DebugOverlaySystem;
  private uiManager?: UiManager;
  private interactionController?: GameInteractionController;
  private saveController?: GameSaveController;
  private sfxSystem?: SfxSystem;
  private worldRuntimeCoordinator?: WorldRuntimeCoordinator;
  private inputSystem?: InputSystem;
  private groundItemSystem?: GroundItemSystem;
  private controlMode: 'explore' | 'combat' = 'explore';
  private tileHighlight?: Phaser.GameObjects.Graphics;
  private hasShutdown = false;
  private mapLoadSerial = 0;

  constructor() {
    super('GameScene');
  }

  preload(): void {
    preloadPlayerAssets(this);
    preloadEnemyAssets(this);
    preloadTerrainAssets(this);
    preloadObjectAssets(this);
  }

  create(): void {
    createTerrainRenderTextures(this);
    createPlayerAnimations(this);
    createEnemyAnimations(this);

    this.telegraphSystem = new TelegraphSystem(this);
    this.sfxSystem = new SfxSystem(this, this.gameEventBus);
    this.groundItemSystem = new GroundItemSystem(this);
    this.combatSandboxSystem = new CombatSandboxSystem(
      this,
      this.gameEventBus,
      this.telegraphSystem,
      (evt: EnemyKilledEvent) => this.handleEnemyKilled(evt),
      (worldX, worldY) => this.handlePlayerDied(worldX, worldY),
      (delta) => this.worldRuntimeCoordinator?.addCombatXp(delta) ?? [],
    );
    this.worldRuntimeCoordinator = new WorldRuntimeCoordinator(this, this.gameEventBus);
    this.worldRuntimeCoordinator.setGroundItemCollector(
      (id) => this.groundItemSystem?.collectDrop(id) ?? null,
    );
    const initialMapId = getPublishedEditorMapId() ?? 'test_home_island';
    this.initializeWorldRuntime(initialMapId, 'default');
    this.uiManager = new UiManager(this, {
      onCombatToggle:         () => this.toggleControlMode(),
      onSprintToggle:         () => this.tryToggleSprint(),
      onInventoryItemUse:     (itemId) => this.tryUseItem(itemId),
      onInventoryItemDrop:    (itemId) => this.tryDropItem(itemId),
      onInventoryItemInspect: (itemId) => this.tryInspectItem(itemId),
      onInventoryItemCombine: (sourceId, targetId) => this.tryCombineItems(sourceId, targetId),
      onChoiceMenuSelect:     (i) => this.worldRuntimeCoordinator?.setChoiceMenuSelection(i),
      onChoiceMenuConfirm:    () => this.tryConfirmChoiceMenu(),
      onChoiceMenuCancel:     () => {
        const msg = this.worldRuntimeCoordinator?.cancelChoiceMenu();
        if (msg) this.uiManager?.showInfo(msg);
      },
    });
    this.saveController = new GameSaveController(this);
    this.interactionController = new GameInteractionController(this, {
      getWorldRuntimeCoordinator: () => this.worldRuntimeCoordinator,
      getPlayerController: () => this.playerController,
      getTelegraphSystem: () => this.telegraphSystem,
      getUiManager: () => this.uiManager,
      getControlMode: () => this.controlMode,
      handleGameplayResult: (result, options) => this.handleGameplayResult(result, options),
    });
    this.tileHighlight = this.add.graphics();
    this.tileHighlight.setDepth(RENDER_DEPTHS.GRID + 1);

    this.inputSystem = new InputSystem(this, this.buildInputCallbacks());
    this.input.mouse?.disableContextMenu();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.handleShutdown, this);
    this.tryAutoLoadSave();
  }

  update(_time: number, delta: number): void {
    this.inputSystem?.setMode(this.computeInputMode());

    // Sync combat animation state before player movement so attack phase locks
    // are visible to isAttackMovementBlocked within the same frame.
    if (this.combatSandboxSystem && this.playerController) {
      this.combatSandboxSystem.preSyncAttackVisuals(this.time.now, this.playerController);
    }

    if (this.inputSystem?.shouldProcessMovement() ?? true) {
      this.playerController?.update(delta, this.time.now);
    }

    this.groundItemSystem?.tick(this.time.now);
    this.refreshGroundItemTargets();
    if (this.combatSandboxSystem && this.worldRuntimeCoordinator?.hasActiveRuntime()) {
      const derived = this.worldRuntimeCoordinator.getDerivedStats();
      this.combatSandboxSystem.syncMaxHp(derived.maxHp);
      this.combatSandboxSystem.syncAttackReach(derived.reachTiles);
    }
    const uiResults = this.worldRuntimeCoordinator?.updatePlayerRuntimeState(delta) ?? [];
    this.interactionController?.resolvePendingPointerInteraction();
    uiResults.forEach((result) => this.handleGameplayResult(result, { allowAutosave: true }));
    const combatResults =
      this.combatSandboxSystem && this.playerController
        ? this.combatSandboxSystem.update(this.time.now, delta, this.playerController)
        : [];
    combatResults.forEach((result) => this.uiManager?.handleResult(result));

    if (this.combatSandboxSystem?.consumePendingScreenShake()) {
      this.cameras.main.shake(80, 0.003);
    }

    this.worldRuntimeCoordinator?.getObjectOcclusionSystem()?.update(delta);
    this.telegraphSystem?.update(this.time.now);
    this.uiManager?.update(
      this.worldRuntimeCoordinator?.getUiState() ?? emptyUiStateSnapshot(),
      this.combatSandboxSystem?.getUiSnapshot(this.time.now) ?? null,
      this.controlMode,
    );
    this.updateTileHighlight();
    this.debugOverlaySystem?.update();
  }

  private updateTileHighlight(): void {
    const g = this.tileHighlight;
    if (!g) return;
    g.clear();

    const tiles = this.worldRuntimeCoordinator?.getActiveInteractionTiles();
    const transform = this.worldRuntimeCoordinator?.getIsoTransform();
    if (!tiles || !transform) return;

    g.lineStyle(2, 0xe8a045, 0.90);
    g.fillStyle(0xe8a045, 0.15);
    tiles.forEach(({ x, y }) => {
      const pts = transform.getTileDiamondPoints(x, y);
      g.fillPoints(pts, true);
      g.strokePoints(pts, true);
    });
  }

  private computeInputMode(): InputMode {
    if (this.worldRuntimeCoordinator?.isChoiceMenuOpen()) return 'menu';
    if (this.worldRuntimeCoordinator?.isPlacementModeActive()) return 'placement';
    if (this.worldRuntimeCoordinator?.isActionInProgress()) return 'action_progress';
    return this.controlMode === 'combat' ? 'combat' : 'normal';
  }

  private handleShutdown(): void {
    if (this.hasShutdown) {
      return;
    }

    this.hasShutdown = true;
    this.inputSystem?.destroy();
    this.inputSystem = undefined;
    this.debugOverlaySystem?.destroy();
    this.debugOverlaySystem = undefined;
    this.tileHighlight?.destroy();
    this.tileHighlight = undefined;
    this.combatSandboxSystem?.destroy();
    this.combatSandboxSystem = undefined;
    this.groundItemSystem?.destroy();
    this.groundItemSystem = undefined;
    this.telegraphSystem?.destroy();
    this.telegraphSystem = undefined;
    this.uiManager?.destroy();
    this.uiManager = undefined;
    this.interactionController = undefined;
    this.saveController = undefined;
    this.sfxSystem?.destroy();
    this.sfxSystem = undefined;
    this.worldRuntimeCoordinator?.destroy();
    this.worldRuntimeCoordinator = undefined;
    this.cameraSystem?.destroy();
    this.cameraSystem = undefined;
  }

  private buildInputCallbacks(): InputCallbacks {
    return {
      onInteract: () => this.interactionController?.triggerActiveInteraction(),
      onCancelAction: () => this.cancelActiveActionForUi(),
      onCombatDodge: () => this.tryCombatDodge(),
      onToggleSprint: () => this.tryToggleSprint(),
      onGuardStart: () => this.combatSandboxSystem?.setGuardHeld(true),
      onGuardEnd: () => this.combatSandboxSystem?.setGuardHeld(false),
      onPlayerLightAttack: () => this.tryPlayerLightAttack(),
      onMoveToPointer: (worldX, worldY) => this.interactionController?.moveToPointer(worldX, worldY),
      onPointerInteract: (worldX, worldY) =>
        this.interactionController?.pointerInteraction(worldX, worldY),
      onPointerContext: (worldX, worldY) =>
        this.interactionController?.pointerContext(worldX, worldY),
      onToggleControlMode: () => this.toggleControlMode(),
      onMenuMoveUp:   () => this.worldRuntimeCoordinator?.moveChoiceMenuSelection(-1),
      onMenuMoveDown: () => this.worldRuntimeCoordinator?.moveChoiceMenuSelection(1),
      onMenuConfirm:  () => this.tryConfirmChoiceMenu(),
      onMenuPointer:  () => { /* handled by HTML popup click events */ },
      onMenuCancel:   () => {
        const msg = this.worldRuntimeCoordinator?.cancelChoiceMenu();
        if (msg) this.uiManager?.showInfo(msg);
      },
      onPlacementConfirm: () => this.interactionController?.confirmPlacementMode(),
      onPlacementCancel: () => {
        const msg = this.worldRuntimeCoordinator?.cancelPlacementMode();
        if (msg) this.uiManager?.showInfo(msg);
      },
      onToggleInventory: () => this.uiManager?.toggleInventory(),
      onToggleJournal: () => this.uiManager?.toggleJournal(),
      onToggleSkills: () => this.uiManager?.toggleSkills(),
      onSaveNow: () => this.saveController?.saveNow(this.getSaveControllerContext()),
      onLoadSave: () => this.saveController?.loadSavedGame(this.getSaveControllerContext()),
      onClearSave: () => this.saveController?.clearSavedGame(this.getSaveControllerContext()),
      onDebugCycleZoom: () => this.cameraSystem?.cycleZoom(),
      onDebugToggleGrid: () => this.worldRuntimeCoordinator?.getIsoTilemap()?.cycleGridMode(),
      onDebugToggleChunk: () => this.worldRuntimeCoordinator?.getIsoTilemap()?.toggleChunkDebug(),
      onDebugToggleObjects: () => this.worldRuntimeCoordinator?.getObjectDebugRenderer()?.toggle(),
      onDebugLogPlacement: () =>
        this.worldRuntimeCoordinator?.getObjectPlacementSystem()?.debugLogPlacementInfo(),
    };
  }

  private async initializeWorldRuntime(mapId: string, spawnId: string): Promise<void> {
    const coordinator = this.worldRuntimeCoordinator;
    const loadSerial = this.mapLoadSerial + 1;
    this.mapLoadSerial = loadSerial;

    if (!coordinator) return;

    try {
      await coordinator.prepareMapAssets(mapId);

      if (this.hasShutdown) return;
      if (this.mapLoadSerial !== loadSerial) return;
      if (this.worldRuntimeCoordinator !== coordinator) return;

      const loadedMap = coordinator.loadMap(mapId, spawnId);
      this.bindPlayerAndCamera(loadedMap);
      this.bindRuntimeSupportSystems();
      coordinator.updatePlayerRuntimeState();
    } catch (error) {
      console.error(`[GameScene] Failed to load map "${mapId}":`, error);
      if (mapId !== 'test_home_island') {
        await this.initializeWorldRuntime('test_home_island', 'default');
      }
    }
  }

  private bindPlayerAndCamera(loadedMap: LoadedMapRuntime): void {
    const spawnPoint = this.worldRuntimeCoordinator?.getCurrentSpawnWorldPoint();

    if (!spawnPoint) return;

    if (!this.player) {
      this.player = this.add.sprite(spawnPoint.x, spawnPoint.y, PLAYER_TEXTURE_KEY);
      this.player.setScale(PLAYER_CONFIG.visualScale);
    }

    if (!this.playerController) {
      this.playerController = new PlayerController(this, this.player, loadedMap.isoTilemap);
    }

    if (!this.player) {
      return;
    }

    if (!this.cameraSystem) {
      this.cameraSystem = new CameraSystem({
        scene: this,
        camera: this.cameras.main,
        bounds: loadedMap.worldBounds,
        followTarget: this.player,
      });
    } else {
      this.cameraSystem.setBounds(loadedMap.worldBounds);
    }

    this.worldRuntimeCoordinator?.bindSceneSystems({
      player: this.player,
      playerController: this.playerController,
      cameraSystem: this.cameraSystem,
    });
  }

  private bindDebugOverlayToRuntime(): void {
    if (!this.playerController || !this.cameraSystem || !this.worldRuntimeCoordinator) {
      return;
    }

    const isoTilemap = this.worldRuntimeCoordinator.getIsoTilemap();
    if (!isoTilemap) return;
    const mapLoader = this.worldRuntimeCoordinator.getMapLoader();
    const mapTransitionSystem = this.worldRuntimeCoordinator.getMapTransitionSystem();
    const objectPlacementSystem = this.worldRuntimeCoordinator.getObjectPlacementSystem();
    const objectDebugRenderer = this.worldRuntimeCoordinator.getObjectDebugRenderer();

    if (!this.debugOverlaySystem) {
      this.debugOverlaySystem = new DebugOverlaySystem({
        scene: this,
        worldCamera: this.cameras.main,
        cameraSystem: this.cameraSystem,
        playerController: this.playerController,
        isoTilemap,
        mapLoader,
        mapTransitionSystem,
        objectPlacementSystem,
        objectDebugRenderer,
        getAudioDiagnostics: () => this.sfxSystem?.getDiagnostics() ?? null,
      });
      return;
    }

    this.debugOverlaySystem.setWorldContext({
      isoTilemap,
      mapLoader,
      mapTransitionSystem,
      objectPlacementSystem,
      objectDebugRenderer,
    });
  }

  private bindCombatSandboxToRuntime(): void {
    if (!this.playerController || !this.worldRuntimeCoordinator || !this.combatSandboxSystem) {
      return;
    }

    const runtime = this.worldRuntimeCoordinator.getCurrentRuntime();
    this.combatSandboxSystem.setMapContext(runtime.definition.id, runtime.isoTilemap);
    this.playerController.setExternalOccupancyValidator((feetWorldX, feetWorldY) =>
      this.combatSandboxSystem?.canPlayerOccupy(feetWorldX, feetWorldY) ?? true,
    );
  }

  private bindRuntimeSupportSystems(): void {
    this.bindDebugOverlayToRuntime();
    this.bindCombatSandboxToRuntime();
    const mapId = this.worldRuntimeCoordinator?.getCurrentRuntime().definition.id ?? '';
    this.groundItemSystem?.setActiveMap(mapId);
  }

  private tryUseItem(itemId: string): void {
    if (!this.worldRuntimeCoordinator || !this.uiManager) {
      return;
    }

    const result = this.worldRuntimeCoordinator.useItem(itemId as PlayerItemKey);
    this.handleGameplayResult(result, { allowAutosave: false });
  }

  private tryDropItem(itemId: string): void {
    if (!this.worldRuntimeCoordinator || !this.groundItemSystem) return;
    const drop = this.worldRuntimeCoordinator.dropItemFromInventory(itemId);
    if (drop.ok) {
      const mapId = this.worldRuntimeCoordinator.getCurrentRuntime().definition.id;
      const isoTilemap = this.worldRuntimeCoordinator.getIsoTilemap();
      if (!isoTilemap) return;
      const tile = isoTilemap.transform.worldToTile(drop.worldX, drop.worldY);
      const center = isoTilemap.transform.getTileCenterWorld(tile.x, tile.y);
      this.groundItemSystem.spawnDrop(mapId, itemId, 1, center.x, center.y, this.time.now, this.time.now + 60_000);
      this.uiManager?.showInfo('Dropped item.');
    }
  }

  private tryInspectItem(itemId: string): void {
    if (!this.worldRuntimeCoordinator) return;
    const data = this.worldRuntimeCoordinator.getItemDisplayData(itemId);
    if (data) {
      this.uiManager?.showInfo(`${data.displayName}: ${data.description}`);
    }
  }

  private tryCombineItems(sourceId: string, targetId: string): void {
    if (!this.worldRuntimeCoordinator) return;
    const result = this.worldRuntimeCoordinator.tryHandCraft(sourceId, targetId);
    this.uiManager?.handleResult(result);
  }

  private handlePlayerDied(worldX: number, worldY: number): void {
    if (!this.worldRuntimeCoordinator || !this.groundItemSystem) return;

    // Capture death map and exact tile center BEFORE transitioning maps
    const deathMapId = this.worldRuntimeCoordinator.getCurrentRuntime().definition.id;
    const isoTilemap = this.worldRuntimeCoordinator.getIsoTilemap();
    if (!isoTilemap) return;
    const tile = isoTilemap.transform.worldToTile(worldX, worldY);
    const center = isoTilemap.transform.getTileCenterWorld(tile.x, tile.y);
    const despawnAtMs = this.time.now + 900_000; // 15 minutes

    for (const { id, amount } of this.worldRuntimeCoordinator.drainAllInventoryItems()) {
      this.groundItemSystem.spawnDrop(deathMapId, id, amount, center.x, center.y, this.time.now, despawnAtMs);
    }

    this.uiManager?.showInfo('You were downed. Your items were left behind.');
    this.initializeWorldRuntime('test_home_island', 'default');
    this.playerController?.resetCombatVisual();
  }

  private handleEnemyKilled(evt: EnemyKilledEvent): void {
    if (!this.groundItemSystem || !this.worldRuntimeCoordinator) return;
    const enemyDef = ENEMY_DEFINITIONS.find((d) => d.id === evt.enemyDefinitionId);
    const lootTable = enemyDef?.lootTable;
    if (!lootTable || lootTable.length === 0) return;
    const mapId = this.worldRuntimeCoordinator.getCurrentRuntime().definition.id;
    const isoTilemap = this.worldRuntimeCoordinator.getIsoTilemap();
    if (!isoTilemap) return;
    const tile = isoTilemap.transform.worldToTile(evt.worldX, evt.worldY);
    const center = isoTilemap.transform.getTileCenterWorld(tile.x, tile.y);
    this.groundItemSystem.spawnFromLootTable(mapId, lootTable, center.x, center.y, this.time.now);
  }

  private refreshGroundItemTargets(): void {
    if (!this.groundItemSystem || !this.worldRuntimeCoordinator?.hasActiveRuntime()) return;
    const isoTilemap = this.worldRuntimeCoordinator.getIsoTilemap();
    if (!isoTilemap) return;
    const targets = this.groundItemSystem.buildDynamicTargets(
      (wx, wy) => isoTilemap.transform.worldToTile(wx, wy),
    );
    this.worldRuntimeCoordinator.setDynamicInteractionTargets(targets);
  }

  private tryConfirmChoiceMenu(): void {
    if (!this.worldRuntimeCoordinator || !this.uiManager) {
      return;
    }

    const result = this.worldRuntimeCoordinator.confirmChoiceMenu();

    if (!result) {
      return;
    }

    if (isDeferredInteractionAction(result)) {
      this.interactionController?.beginDeferredInteractionAction(result);
      return;
    }

    this.handleGameplayResult(result, { allowAutosave: true });
  }

  private cancelActiveActionForUi(): boolean {
    const message = this.worldRuntimeCoordinator?.cancelActiveAction('Action cancelled.');

    if (!message) {
      return false;
    }

    this.uiManager?.showInfo(message);
    return true;
  }

  private tryAutoLoadSave(): void {
    this.saveController?.tryAutoLoadSave(this.getSaveControllerContext());
  }

  private getSaveControllerContext() {
    return {
      uiManager: this.uiManager,
      worldRuntimeCoordinator: this.worldRuntimeCoordinator,
      onRestored: () => this.bindRuntimeSupportSystems(),
    };
  }

  private handleGameplayResult(
    result: InteractionResult | null,
    { allowAutosave }: { allowAutosave: boolean },
  ): void {
    if (!result || !this.uiManager || !this.worldRuntimeCoordinator) {
      return;
    }

    this.uiManager.handleResult(result);

    if (result.transitionRequest) {
      this.bindRuntimeSupportSystems();
    }

    this.worldRuntimeCoordinator.updatePlayerRuntimeState();

    if (allowAutosave) {
      this.saveController?.maybeAutosaveForResult(result, this.getSaveControllerContext());
    }
  }

  private tryCombatDodge(): void {
    if (!this.combatSandboxSystem || !this.playerController) {
      return;
    }

    this.interactionController?.clearPendingPointerInteraction();
    const pointer = this.input.activePointer;
    const targetWorldX = Number.isFinite(pointer.worldX) ? pointer.worldX : null;
    const targetWorldY = Number.isFinite(pointer.worldY) ? pointer.worldY : null;
    this.playerController.setFacingFromTarget(targetWorldX, targetWorldY);
    const result = this.combatSandboxSystem.tryDodge(
      this.time.now,
      this.playerController,
      targetWorldX,
      targetWorldY,
    );

    if (result) {
      this.uiManager?.handleResult(result);
    }
  }

  private tryToggleSprint(): void {
    const result = this.combatSandboxSystem?.toggleSprint();

    if (result) {
      this.uiManager?.handleResult(result);
    }
  }

  private tryPlayerLightAttack(): void {
    if (!this.combatSandboxSystem || !this.playerController) {
      return;
    }

    const pointer = this.input.activePointer;
    const targetWorldX = Number.isFinite(pointer.worldX) ? pointer.worldX : null;
    const targetWorldY = Number.isFinite(pointer.worldY) ? pointer.worldY : null;
    this.playerController.setFacingFromTarget(targetWorldX, targetWorldY);
    const result = this.combatSandboxSystem.tryPlayerLightAttack(
      this.time.now,
      this.playerController,
      targetWorldX,
      targetWorldY,
    );

    if (result) {
      this.uiManager?.handleResult(result);
    }
  }

  private toggleControlMode(): void {
    this.controlMode = this.controlMode === 'combat' ? 'explore' : 'combat';
    this.interactionController?.clearPendingPointerInteraction();

    if (this.controlMode === 'combat') {
      this.playerController?.clearClickMoveTarget();
    }

    this.uiManager?.showInfo(
      this.controlMode === 'combat' ? 'Combat controls enabled.' : 'Explore controls enabled.',
    );
  }
}

function isDeferredInteractionAction(
  value: InteractionResult | DeferredInteractionAction,
): value is DeferredInteractionAction {
  return 'kind' in value && value.kind === 'deferred_interaction_action';
}
