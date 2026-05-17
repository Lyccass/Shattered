import Phaser from 'phaser';
import { SfxSystem } from '../audio/SfxSystem';
import { CameraSystem } from '../camera/CameraSystem';
import { DebugOverlaySystem } from '../debug/DebugOverlaySystem';
import { GameEventBus } from '../events/GameEventBus';
import { preloadObjectAssets } from '../objects/ObjectAssets';
import { PLAYER_ASSET_PATH, PLAYER_TEXTURE_KEY } from '../player/PlayerAssets';
import { PLAYER_CONFIG } from '../player/PlayerConfig';
import { PlayerController } from '../player/PlayerController';
import { UiManager } from '../ui/UiManager';
import type { LoadedMapRuntime } from '../world/maps/MapRuntime';
import { WorldRuntimeCoordinator } from '../world/maps/WorldRuntimeCoordinator';
import { createTerrainRenderTextures, preloadTerrainAssets } from '../world/TerrainAssets';

export class GameScene extends Phaser.Scene {
  private readonly gameEventBus = new GameEventBus();
  private player?: Phaser.GameObjects.Sprite;
  private playerController?: PlayerController;
  private cameraSystem?: CameraSystem;
  private debugOverlaySystem?: DebugOverlaySystem;
  private uiManager?: UiManager;
  private sfxSystem?: SfxSystem;
  private worldRuntimeCoordinator?: WorldRuntimeCoordinator;
  private lastInteractionAt = 0;

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
    this.registerDebugKeys();

    // Future system hooks:
    // - real isometric map rendering
    // - island building
    // - slow encounter-based combat
    // - multiplayer rooms/layers
    // - worldstate system
  }

  update(_time: number, delta: number): void {
    if (!this.worldRuntimeCoordinator?.isChoiceMenuOpen()) {
      this.playerController?.update(delta);
    }
    const uiResults = this.worldRuntimeCoordinator?.updatePlayerRuntimeState(delta) ?? [];
    uiResults.forEach((result) => this.uiManager?.handleResult(result));
    this.worldRuntimeCoordinator?.getObjectOcclusionSystem()?.update(delta);
    this.uiManager?.update(this.worldRuntimeCoordinator?.getUiState() ?? {
      activeInteraction: null,
      choiceMenu: null,
      inventory: {
        resources: { wood: 0, stone: 0, herb: 0 },
        items: { firestarter_set: 0, wooden_marker: 0, camp_supplies: 0, warm_tea: 0 },
      },
      currency: { copper: 0, silver: 0, gold: 0, platinum: 0 },
      reputation: { harborReputation: 0 },
      skills: [],
      activeTaskCount: 0,
      journalEntries: [],
      activeEffects: [],
      placementState: null,
      actionProgress: null,
    });
    this.debugOverlaySystem?.update();
  }

  private registerDebugKeys(): void {
    const keyboard = this.input.keyboard;

    if (!keyboard) {
      return;
    }

    keyboard.on('keydown-Z', () => {
      this.cameraSystem?.cycleZoom();
    });

    keyboard.on('keydown-G', () => {
      this.worldRuntimeCoordinator?.getIsoTilemap().cycleGridMode();
    });

    keyboard.on('keydown-C', () => {
      this.worldRuntimeCoordinator?.getIsoTilemap().toggleChunkDebug();
    });

    // Object debug controls.
    keyboard.on('keydown-O', () => {
      this.worldRuntimeCoordinator?.getObjectDebugRenderer()?.toggle();
    });

    keyboard.on('keydown-L', () => {
      this.worldRuntimeCoordinator?.getObjectPlacementSystem()?.debugLogPlacementInfo();
    });

    keyboard.on('keydown-E', () => {
      if (this.worldRuntimeCoordinator?.isChoiceMenuOpen()) {
        this.tryConfirmChoiceMenu();
        return;
      }

      if (this.worldRuntimeCoordinator?.isPlacementModeActive()) {
        this.tryConfirmPlacementMode();
        return;
      }

      this.tryTriggerActiveInteraction();
    });

    keyboard.on('keydown-SPACE', () => {
      if (this.worldRuntimeCoordinator?.isChoiceMenuOpen()) {
        return;
      }

      this.cancelActiveActionForUi();

      if (this.worldRuntimeCoordinator?.isPlacementModeActive()) {
        this.tryConfirmPlacementMode();
        return;
      }

      this.tryStartPlacementMode();
    });

    keyboard.on('keydown-ESC', () => {
      if (this.cancelActiveActionForUi()) {
        return;
      }

      const menuMessage = this.worldRuntimeCoordinator?.cancelChoiceMenu();

      if (menuMessage) {
        this.uiManager?.showInfo(menuMessage);
        return;
      }

      const message = this.worldRuntimeCoordinator?.cancelPlacementMode();

      if (message) {
        this.uiManager?.showInfo(message);
      }
    });

    keyboard.on('keydown-T', () => {
      if (this.worldRuntimeCoordinator?.isChoiceMenuOpen()) {
        return;
      }

      this.cancelActiveActionForUi();

      this.tryUseWarmTea();
    });

    keyboard.on('keydown-W', () => {
      this.worldRuntimeCoordinator?.moveChoiceMenuSelection(-1);
    });

    keyboard.on('keydown-UP', () => {
      this.worldRuntimeCoordinator?.moveChoiceMenuSelection(-1);
    });

    keyboard.on('keydown-S', () => {
      this.worldRuntimeCoordinator?.moveChoiceMenuSelection(1);
    });

    keyboard.on('keydown-DOWN', () => {
      this.worldRuntimeCoordinator?.moveChoiceMenuSelection(1);
    });

    keyboard.on('keydown-ENTER', () => {
      if (this.worldRuntimeCoordinator?.isChoiceMenuOpen()) {
        this.tryConfirmChoiceMenu();
      }
    });

    keyboard.on('keydown-I', () => {
      this.cancelActiveActionForUi();
      this.uiManager?.toggleInventory();
    });

    keyboard.on('keydown-J', () => {
      this.cancelActiveActionForUi();
      this.uiManager?.toggleJournal();
    });

    keyboard.on('keydown-P', () => {
      this.cancelActiveActionForUi();
      this.uiManager?.toggleSkills();
    });
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
    this.uiManager.handleResult(result);

    if (result.transitionRequest) {
      this.bindDebugOverlayToRuntime();
    }
    this.worldRuntimeCoordinator.updatePlayerRuntimeState();
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
    this.uiManager.handleResult(result);
    this.worldRuntimeCoordinator.updatePlayerRuntimeState();
  }

  private tryUseWarmTea(): void {
    if (!this.worldRuntimeCoordinator || !this.uiManager) {
      return;
    }

    const result = this.worldRuntimeCoordinator.useItem('warm_tea');
    this.uiManager.handleResult(result);
    this.worldRuntimeCoordinator.updatePlayerRuntimeState();
  }

  private tryConfirmChoiceMenu(): void {
    if (!this.worldRuntimeCoordinator || !this.uiManager) {
      return;
    }

    const result = this.worldRuntimeCoordinator.confirmChoiceMenu();

    if (!result) {
      return;
    }

    this.uiManager.handleResult(result);
    this.worldRuntimeCoordinator.updatePlayerRuntimeState();
  }

  private cancelActiveActionForUi(): boolean {
    const message = this.worldRuntimeCoordinator?.cancelActiveAction('Action cancelled.');

    if (!message) {
      return false;
    }

    this.uiManager?.showInfo(message);
    return true;
  }
}
