import Phaser from 'phaser';
import { SfxSystem } from '../audio/SfxSystem';
import { CameraSystem } from '../camera/CameraSystem';
import { CombatSandboxSystem } from '../combat/CombatSandboxSystem';
import { createEnemyAnimations, preloadEnemyAssets } from '../combat/EnemyAssets';
import { TelegraphSystem } from '../combat/TelegraphSystem';
import { DebugOverlaySystem } from '../debug/DebugOverlaySystem';
import { GameEventBus } from '../events/GameEventBus';
import { InputSystem } from '../input/InputSystem';
import type { InputCallbacks, InputMode } from '../input/InputTypes';
import { preloadObjectAssets } from '../objects/ObjectAssets';
import { LocalSaveService } from '../persistence/LocalSaveService';
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
import {
  type DeferredInteractionAction,
  WorldRuntimeCoordinator,
} from '../world/maps/WorldRuntimeCoordinator';
import { createTerrainRenderTextures, preloadTerrainAssets } from '../world/TerrainAssets';
import type { InteractionTarget } from '../interactions/InteractionTypes';
import type { InteractionResult } from '../interactions/InteractionTypes';

type SceneInteractionTargetType = InteractionTarget['definition']['interactionType'];

export class GameScene extends Phaser.Scene {
  private static readonly MOVE_TARGET_TELEGRAPH_ID = 'player-move-target';
  private static readonly MOVE_TARGET_HIGHLIGHT_MS = 30_000;
  private readonly gameEventBus = new GameEventBus();
  private readonly localSaveService = new LocalSaveService();
  private player?: Phaser.GameObjects.Sprite;
  private playerController?: PlayerController;
  private cameraSystem?: CameraSystem;
  private telegraphSystem?: TelegraphSystem;
  private combatSandboxSystem?: CombatSandboxSystem;
  private debugOverlaySystem?: DebugOverlaySystem;
  private uiManager?: UiManager;
  private sfxSystem?: SfxSystem;
  private worldRuntimeCoordinator?: WorldRuntimeCoordinator;
  private inputSystem?: InputSystem;
  private controlMode: 'explore' | 'combat' = 'explore';
  private pendingPointerInteraction: {
    interactionType: SceneInteractionTargetType;
    targetId: string;
    action: 'use' | 'inspect';
  } | null = null;
  private lastInteractionAt = 0;
  private lastAutosaveAt = 0;
  private hasShutdown = false;

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
    this.combatSandboxSystem = new CombatSandboxSystem(
      this,
      this.gameEventBus,
      this.telegraphSystem,
    );
    this.worldRuntimeCoordinator = new WorldRuntimeCoordinator(this, this.gameEventBus);
    this.initializeWorldRuntime('test_home_island', 'default');
    this.uiManager = new UiManager(this);
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

    const uiResults = this.worldRuntimeCoordinator?.updatePlayerRuntimeState(delta) ?? [];
    this.resolvePendingPointerInteraction();
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
    );
    this.syncMoveTargetTelegraph();
    this.debugOverlaySystem?.update();
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
    this.combatSandboxSystem?.destroy();
    this.combatSandboxSystem = undefined;
    this.telegraphSystem?.destroy();
    this.telegraphSystem = undefined;
    this.uiManager?.destroy();
    this.uiManager = undefined;
    this.sfxSystem?.destroy();
    this.sfxSystem = undefined;
    this.worldRuntimeCoordinator?.destroy();
    this.worldRuntimeCoordinator = undefined;
    this.cameraSystem?.destroy();
    this.cameraSystem = undefined;
  }

  private buildInputCallbacks(): InputCallbacks {
    return {
      onInteract: () => this.tryTriggerActiveInteraction(),
      onStartPlacement: () => this.tryStartPlacementMode(),
      onUseItem: (itemId) => this.tryUseItem(itemId),
      onCancelAction: () => this.cancelActiveActionForUi(),
      onCombatDodge: () => this.tryCombatDodge(),
      onToggleSprint: () => this.tryToggleSprint(),
      onGuardStart: () => this.combatSandboxSystem?.setGuardHeld(true),
      onGuardEnd: () => this.combatSandboxSystem?.setGuardHeld(false),
      onPlayerLightAttack: () => this.tryPlayerLightAttack(),
      onMoveToPointer: (worldX, worldY) => this.tryMoveToPointer(worldX, worldY),
      onPointerInteract: (worldX, worldY) => this.tryPointerInteraction(worldX, worldY),
      onPointerContext: (worldX, worldY) => this.tryPointerContext(worldX, worldY),
      onToggleControlMode: () => this.toggleControlMode(),
      onMenuMoveUp: () => this.worldRuntimeCoordinator?.moveChoiceMenuSelection(-1),
      onMenuMoveDown: () => this.worldRuntimeCoordinator?.moveChoiceMenuSelection(1),
      onMenuConfirm: () => this.tryConfirmChoiceMenu(),
      onMenuPointer: (screenX, screenY) => this.tryMenuPointer(screenX, screenY),
      onMenuCancel: () => {
        const msg = this.worldRuntimeCoordinator?.cancelChoiceMenu();
        if (msg) this.uiManager?.showInfo(msg);
      },
      onPlacementConfirm: () => this.tryConfirmPlacementMode(),
      onPlacementCancel: () => {
        const msg = this.worldRuntimeCoordinator?.cancelPlacementMode();
        if (msg) this.uiManager?.showInfo(msg);
      },
      onToggleInventory: () => this.uiManager?.toggleInventory(),
      onToggleJournal: () => this.uiManager?.toggleJournal(),
      onToggleSkills: () => this.uiManager?.toggleSkills(),
      onSaveNow: () => this.saveNow(),
      onLoadSave: () => this.loadSavedGame(),
      onClearSave: () => this.clearSavedGame(),
      onDebugCycleZoom: () => this.cameraSystem?.cycleZoom(),
      onDebugToggleGrid: () => this.worldRuntimeCoordinator?.getIsoTilemap().cycleGridMode(),
      onDebugToggleChunk: () => this.worldRuntimeCoordinator?.getIsoTilemap().toggleChunkDebug(),
      onDebugToggleObjects: () => this.worldRuntimeCoordinator?.getObjectDebugRenderer()?.toggle(),
      onDebugLogPlacement: () =>
        this.worldRuntimeCoordinator?.getObjectPlacementSystem()?.debugLogPlacementInfo(),
    };
  }

  private initializeWorldRuntime(mapId: string, spawnId: string): void {
    if (!this.worldRuntimeCoordinator) {
      return;
    }

    const loadedMap = this.worldRuntimeCoordinator.loadMap(mapId, spawnId);
    this.bindPlayerAndCamera(loadedMap);
    this.bindRuntimeSupportSystems();
    this.worldRuntimeCoordinator.updatePlayerRuntimeState();
  }

  private bindPlayerAndCamera(loadedMap: LoadedMapRuntime): void {
    const spawnPoint = this.worldRuntimeCoordinator?.getCurrentSpawnWorldPoint();

    if (!spawnPoint) {
      return;
    }

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
  }

  private tryTriggerActiveInteraction(): void {
    if (!this.worldRuntimeCoordinator || !this.uiManager) {
      return;
    }

    const now = this.time.now;

    if (now - this.lastInteractionAt < 250) {
      return;
    }

    const result = this.worldRuntimeCoordinator.triggerActiveInteraction();

    if (!result) {
      return;
    }

    this.clearPendingPointerInteraction();
    this.lastInteractionAt = now;
    this.handleGameplayResult(result, { allowAutosave: true });
  }

  private tryStartPlacementMode(): void {
    if (!this.worldRuntimeCoordinator || !this.uiManager) {
      return;
    }

    this.uiManager.showInfo(this.worldRuntimeCoordinator.startPlacementMode());
    this.worldRuntimeCoordinator.updatePlayerRuntimeState();
  }

  private tryConfirmPlacementMode(): void {
    if (!this.worldRuntimeCoordinator || !this.uiManager) {
      return;
    }

    const now = this.time.now;

    if (now - this.lastInteractionAt < 250) {
      return;
    }

    const result = this.worldRuntimeCoordinator.confirmPlacementMode();

    if (!result) {
      return;
    }

    this.lastInteractionAt = now;
    this.handleGameplayResult(result, { allowAutosave: false });
  }

  private tryUseItem(itemId: PlayerItemKey): void {
    if (!this.worldRuntimeCoordinator || !this.uiManager) {
      return;
    }

    const result = this.worldRuntimeCoordinator.useItem(itemId);
    this.handleGameplayResult(result, { allowAutosave: false });
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
      this.beginDeferredInteractionAction(result);
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
    const loadResult = this.localSaveService.load();

    if (loadResult.status === 'no_save') {
      return;
    }

    this.applyLoadResult(loadResult, true);
  }

  private saveNow(): void {
    if (!this.worldRuntimeCoordinator || !this.uiManager) {
      return;
    }

    const saveGame = this.worldRuntimeCoordinator.createPrototypeSaveSnapshot(this.time.now);
    const result = this.localSaveService.save(saveGame);

    if (!result.ok) {
      this.uiManager.showInfo(result.error);
      return;
    }

    this.lastAutosaveAt = this.time.now;
    this.uiManager.showInfo('Game saved.');
  }

  private loadSavedGame(): void {
    this.applyLoadResult(this.localSaveService.load(), false);
  }

  private clearSavedGame(): void {
    if (!this.uiManager) {
      return;
    }

    if (!this.localSaveService.hasSave()) {
      this.uiManager.showInfo('No save found.');
      return;
    }

    const cleared = this.localSaveService.clearSave();
    this.uiManager.showInfo(cleared ? 'Save cleared.' : 'Save could not be cleared.');
  }

  private applyLoadResult(
    loadResult: ReturnType<LocalSaveService['load']>,
    automatic: boolean,
  ): void {
    if (!this.uiManager || !this.worldRuntimeCoordinator) {
      return;
    }

    switch (loadResult.status) {
      case 'success': {
        const restoreResult = this.worldRuntimeCoordinator.restorePrototypeSaveSnapshot(
          loadResult.saveGame,
          this.time.now,
        );

        if (!restoreResult.ok) {
          this.uiManager.showInfo(`Save load failed. ${restoreResult.message}`);
          return;
        }

        this.bindRuntimeSupportSystems();
        this.lastAutosaveAt = this.time.now;
        this.uiManager.showInfo(automatic ? 'Save loaded on startup.' : restoreResult.message);
        restoreResult.warnings.forEach((warning) => this.uiManager?.showInfo(warning));
        return;
      }

      case 'no_save':
        if (!automatic) {
          this.uiManager.showInfo('No save found.');
        }
        return;

      case 'invalid_json':
        this.uiManager.showInfo(`Save invalid. ${loadResult.error}`);
        return;

      case 'unsupported_version':
        this.uiManager.showInfo(
          `Save version ${loadResult.version ?? 'unknown'} is unsupported.`,
        );
        return;

      case 'validation_failed':
        this.uiManager.showInfo(`Save invalid. ${loadResult.error}`);
        return;

      case 'storage_unavailable':
        this.uiManager.showInfo(loadResult.error);
        return;
    }
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
      this.maybeAutosaveForResult(result);
    }
  }

  private maybeAutosaveForResult(result: InteractionResult): void {
    if (!this.worldRuntimeCoordinator) {
      return;
    }

    const shouldAutosave = Boolean(result.transitionRequest) || result.sfxId === 'contract_completed';

    if (!shouldAutosave || this.time.now - this.lastAutosaveAt < 5_000) {
      return;
    }

    const saveGame = this.worldRuntimeCoordinator.createPrototypeSaveSnapshot(this.time.now);
    const writeResult = this.localSaveService.save(saveGame);

    if (writeResult.ok) {
      this.lastAutosaveAt = this.time.now;
      this.uiManager?.showInfo('Autosaved.');
    } else {
      this.uiManager?.showInfo(writeResult.error);
    }
  }

  private tryCombatDodge(): void {
    if (!this.combatSandboxSystem || !this.playerController) {
      return;
    }

    this.clearPendingPointerInteraction();
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

  private tryPointerInteraction(worldX: number, worldY: number): void {
    if (!this.worldRuntimeCoordinator || !this.playerController) {
      return;
    }

    const clickedTarget = this.worldRuntimeCoordinator.findInteractionTargetAtWorldPoint(worldX, worldY);

    if (!clickedTarget) {
      this.tryMoveToPointer(worldX, worldY);
      return;
    }

    const interactionType = clickedTarget.definition.interactionType;
    const targetId = clickedTarget.definition.id;

    if (this.worldRuntimeCoordinator.isTargetInInteractionRange(interactionType, targetId)) {
      this.clearPendingPointerInteraction();
      const result = this.worldRuntimeCoordinator.triggerTargetInteractionByRef(
        interactionType,
        targetId,
      );

      if (result) {
        this.handleGameplayResult(result, { allowAutosave: true });
      }
      return;
    }

    const approachPoint = this.worldRuntimeCoordinator.findInteractionApproachWorldPoint(
      interactionType,
      targetId,
    );

    if (!approachPoint) {
      return;
    }

    this.pendingPointerInteraction = {
      interactionType,
      targetId,
      action: 'use',
    };
    this.tryMoveToPointer(approachPoint.x, approachPoint.y, true);
  }

  private tryPointerContext(worldX: number, worldY: number): void {
    if (!this.worldRuntimeCoordinator) {
      return;
    }

    const clickedTarget = this.worldRuntimeCoordinator.findInteractionTargetAtWorldPoint(worldX, worldY);

    if (!clickedTarget) {
      return;
    }

    this.clearPendingPointerInteraction();
    this.worldRuntimeCoordinator.openInteractionChoiceMenuByRef(
      clickedTarget.definition.interactionType,
      clickedTarget.definition.id,
    );
  }

  private tryMenuPointer(screenX: number, screenY: number): void {
    if (!this.uiManager || !this.worldRuntimeCoordinator) {
      return;
    }

    const optionIndex = this.uiManager.getChoiceMenuOptionIndexAt(screenX, screenY);

    if (optionIndex === null) {
      return;
    }

    this.worldRuntimeCoordinator.setChoiceMenuSelection(optionIndex);
    this.tryConfirmChoiceMenu();
  }

  private resolvePendingPointerInteraction(): void {
    if (!this.pendingPointerInteraction || !this.worldRuntimeCoordinator || !this.playerController) {
      return;
    }

    if (
      this.worldRuntimeCoordinator.isChoiceMenuOpen()
      || this.worldRuntimeCoordinator.isPlacementModeActive()
      || this.worldRuntimeCoordinator.isActionInProgress()
    ) {
      return;
    }

    const { interactionType, targetId, action } = this.pendingPointerInteraction;

    if (!this.worldRuntimeCoordinator.isTargetInInteractionRange(interactionType, targetId)) {
      if (!this.playerController.hasClickMoveTarget()) {
        this.clearPendingPointerInteraction();
      }

      return;
    }

    this.playerController.clearClickMoveTarget();
    this.clearPendingPointerInteraction();
    const result = action === 'inspect'
      ? this.worldRuntimeCoordinator.inspectTargetByRef(interactionType, targetId)
      : this.worldRuntimeCoordinator.triggerTargetInteractionByRef(interactionType, targetId);

    if (result) {
      this.handleGameplayResult(result, { allowAutosave: true });
    }
  }

  private tryMoveToPointer(worldX: number, worldY: number, preservePendingInteraction = false): void {
    if (!this.playerController || !this.worldRuntimeCoordinator || !this.telegraphSystem) {
      return;
    }

    const isoTilemap = this.worldRuntimeCoordinator.getIsoTilemap();
    const targetTile = isoTilemap.transform.worldToTile(worldX, worldY);

    if (!isoTilemap.isTileInBounds(targetTile.x, targetTile.y)) {
      if (!preservePendingInteraction) {
        this.playerController.clearClickMoveTarget();
        this.clearPendingPointerInteraction();
      }
      return;
    }

    const tileCenter = isoTilemap.transform.getTileCenterWorld(targetTile.x, targetTile.y);
    const tilePoints = isoTilemap.transform.getTileDiamondPoints(targetTile.x, targetTile.y);
    const walkable = isoTilemap.isTileWalkable(targetTile.x, targetTile.y);

    this.telegraphSystem.showTelegraph({
      id: GameScene.MOVE_TARGET_TELEGRAPH_ID,
      worldX: tileCenter.x,
      worldY: tileCenter.y,
      shape: {
        kind: 'polygon',
        points: tilePoints.map((point) => ({
          x: point.x - tileCenter.x,
          y: point.y - tileCenter.y,
        })),
      },
      startedAtMs: this.time.now,
      durationMs: GameScene.MOVE_TARGET_HIGHLIGHT_MS,
      warningColor: walkable ? 0x60a5fa : 0xef4444,
      strokeAlpha: 0.9,
      fillAlphaMultiplier: 0.3,
    });

    if (!walkable) {
      this.playerController.clearClickMoveTarget();
      if (!preservePendingInteraction) {
        this.clearPendingPointerInteraction();
      }
      return;
    }

    if (!preservePendingInteraction) {
      this.clearPendingPointerInteraction();
    }

    this.playerController.setClickMoveTarget(
      tileCenter.x,
      tileCenter.y,
      this.controlMode === 'combat' ? 4 : undefined,
    );
  }

  private syncMoveTargetTelegraph(): void {
    if (!this.playerController || !this.telegraphSystem) {
      return;
    }

    if (!this.playerController.hasClickMoveTarget()) {
      this.telegraphSystem.removeTelegraph(GameScene.MOVE_TARGET_TELEGRAPH_ID);
    }
  }

  private clearPendingPointerInteraction(): void {
    this.pendingPointerInteraction = null;
  }

  private toggleControlMode(): void {
    this.controlMode = this.controlMode === 'combat' ? 'explore' : 'combat';
    this.clearPendingPointerInteraction();

    if (this.controlMode === 'combat') {
      this.playerController?.clearClickMoveTarget();
    }

    this.uiManager?.showInfo(
      this.controlMode === 'combat' ? 'Combat controls enabled.' : 'Explore controls enabled.',
    );
  }

  private beginDeferredInteractionAction(action: DeferredInteractionAction): void {
    if (!this.worldRuntimeCoordinator) {
      return;
    }

    const approachPoint = this.worldRuntimeCoordinator.findInteractionApproachWorldPoint(
      action.interactionType,
      action.targetId,
    );

    if (!approachPoint) {
      return;
    }

    this.pendingPointerInteraction = {
      interactionType: action.interactionType,
      targetId: action.targetId,
      action: action.action,
    };
    this.tryMoveToPointer(approachPoint.x, approachPoint.y, true);
  }
}

function isDeferredInteractionAction(
  value: InteractionResult | DeferredInteractionAction,
): value is DeferredInteractionAction {
  return 'kind' in value && value.kind === 'deferred_interaction_action';
}
