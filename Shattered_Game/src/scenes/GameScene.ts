import Phaser from 'phaser';
import { SfxSystem } from '../audio/SfxSystem';
import { CameraSystem } from '../camera/CameraSystem';
import { DebugOverlaySystem } from '../debug/DebugOverlaySystem';
import { GameEventBus } from '../events/GameEventBus';
import { InputSystem } from '../input/InputSystem';
import type { InputCallbacks, InputMode } from '../input/InputTypes';
import { preloadObjectAssets } from '../objects/ObjectAssets';
import { LocalSaveService } from '../persistence/LocalSaveService';
import { PLAYER_ASSET_PATH, PLAYER_TEXTURE_KEY } from '../player/PlayerAssets';
import { PLAYER_CONFIG } from '../player/PlayerConfig';
import { PlayerController } from '../player/PlayerController';
import type { PlayerItemKey } from '../player/PlayerInventoryState';
import { UiManager } from '../ui/UiManager';
import { emptyUiStateSnapshot } from '../ui/UiTypes';
import type { LoadedMapRuntime } from '../world/maps/MapRuntime';
import { WorldRuntimeCoordinator } from '../world/maps/WorldRuntimeCoordinator';
import { createTerrainRenderTextures, preloadTerrainAssets } from '../world/TerrainAssets';
import type { InteractionResult } from '../interactions/InteractionTypes';

export class GameScene extends Phaser.Scene {
  private readonly gameEventBus = new GameEventBus();
  private readonly localSaveService = new LocalSaveService();
  private player?: Phaser.GameObjects.Sprite;
  private playerController?: PlayerController;
  private cameraSystem?: CameraSystem;
  private debugOverlaySystem?: DebugOverlaySystem;
  private uiManager?: UiManager;
  private sfxSystem?: SfxSystem;
  private worldRuntimeCoordinator?: WorldRuntimeCoordinator;
  private inputSystem?: InputSystem;
  private lastInteractionAt = 0;
  private lastAutosaveAt = 0;
  private hasShutdown = false;

  constructor() {
    super('GameScene');
  }

  preload(): void {
    if (!this.textures.exists(PLAYER_TEXTURE_KEY)) {
      this.load.image(PLAYER_TEXTURE_KEY, PLAYER_ASSET_PATH);
    }

    preloadTerrainAssets(this);
    preloadObjectAssets(this);
  }

  create(): void {
    createTerrainRenderTextures(this);

    this.sfxSystem = new SfxSystem(this, this.gameEventBus);
    this.worldRuntimeCoordinator = new WorldRuntimeCoordinator(this, this.gameEventBus);
    this.initializeWorldRuntime('test_home_island', 'default');
    this.uiManager = new UiManager(this);
    this.inputSystem = new InputSystem(this, this.buildInputCallbacks());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.handleShutdown, this);
    this.tryAutoLoadSave();
  }

  update(_time: number, delta: number): void {
    this.inputSystem?.setMode(this.computeInputMode());

    if (this.inputSystem?.shouldProcessMovement() ?? true) {
      this.playerController?.update(delta);
    }

    const uiResults = this.worldRuntimeCoordinator?.updatePlayerRuntimeState(delta) ?? [];
    uiResults.forEach((result) => this.handleGameplayResult(result, { allowAutosave: true }));
    this.worldRuntimeCoordinator?.getObjectOcclusionSystem()?.update(delta);
    this.uiManager?.update(this.worldRuntimeCoordinator?.getUiState() ?? emptyUiStateSnapshot());
    this.debugOverlaySystem?.update();
  }

  private computeInputMode(): InputMode {
    if (this.worldRuntimeCoordinator?.isChoiceMenuOpen()) return 'menu';
    if (this.worldRuntimeCoordinator?.isPlacementModeActive()) return 'placement';
    if (this.worldRuntimeCoordinator?.isActionInProgress()) return 'action_progress';
    return 'normal';
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
      onMenuMoveUp: () => this.worldRuntimeCoordinator?.moveChoiceMenuSelection(-1),
      onMenuMoveDown: () => this.worldRuntimeCoordinator?.moveChoiceMenuSelection(1),
      onMenuConfirm: () => this.tryConfirmChoiceMenu(),
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
    this.bindDebugOverlayToRuntime();
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

        this.bindDebugOverlayToRuntime();
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
      this.bindDebugOverlayToRuntime();
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
}
