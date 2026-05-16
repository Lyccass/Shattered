import Phaser from 'phaser';
import { CameraSystem } from '../camera/CameraSystem';
import { DebugOverlaySystem } from '../debug/DebugOverlaySystem';
import { InteractionPromptSystem } from '../interactions/InteractionPromptSystem';
import { preloadObjectAssets } from '../objects/ObjectAssets';
import { PLAYER_ASSET_PATH, PLAYER_TEXTURE_KEY } from '../player/PlayerAssets';
import { PLAYER_CONFIG } from '../player/PlayerConfig';
import { PlayerController } from '../player/PlayerController';
import type { LoadedMapRuntime } from '../world/maps/MapRuntime';
import { WorldRuntimeCoordinator } from '../world/maps/WorldRuntimeCoordinator';
import { createTerrainRenderTextures, preloadTerrainAssets } from '../world/TerrainAssets';

export class GameScene extends Phaser.Scene {
  private player?: Phaser.GameObjects.Sprite;
  private playerController?: PlayerController;
  private cameraSystem?: CameraSystem;
  private debugOverlaySystem?: DebugOverlaySystem;
  private interactionPromptSystem?: InteractionPromptSystem;
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

    this.worldRuntimeCoordinator = new WorldRuntimeCoordinator(this);
    this.initializeWorldRuntime('test_home_island', 'default');
    this.interactionPromptSystem = new InteractionPromptSystem(this);
    this.registerDebugKeys();

    // Future system hooks:
    // - real isometric map rendering
    // - island building
    // - slow encounter-based combat
    // - multiplayer rooms/layers
    // - worldstate system
  }

  update(_time: number, delta: number): void {
    this.playerController?.update(delta);
    this.worldRuntimeCoordinator?.updatePlayerRuntimeState();
    this.worldRuntimeCoordinator?.getObjectOcclusionSystem()?.update(delta);
    if (this.interactionPromptSystem && this.worldRuntimeCoordinator) {
      this.interactionPromptSystem.update(
        this.worldRuntimeCoordinator.getActiveInteraction(),
        this.worldRuntimeCoordinator.getPlayerInventoryState().getSnapshot(),
        this.worldRuntimeCoordinator.getPlayerActiveEffects(),
        this.worldRuntimeCoordinator.getPlacementState(),
      );
    }
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
      if (this.worldRuntimeCoordinator?.isPlacementModeActive()) {
        this.tryConfirmPlacementMode();
        return;
      }

      this.tryTriggerActiveInteraction();
    });

    keyboard.on('keydown-SPACE', () => {
      if (this.worldRuntimeCoordinator?.isPlacementModeActive()) {
        this.tryConfirmPlacementMode();
        return;
      }

      this.tryStartPlacementMode();
    });

    keyboard.on('keydown-ESC', () => {
      const message = this.worldRuntimeCoordinator?.cancelPlacementMode();

      if (message) {
        this.interactionPromptSystem?.showFeedback(message);
      }
    });

    keyboard.on('keydown-T', () => {
      this.tryUseWarmTea();
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
    if (!this.worldRuntimeCoordinator || !this.interactionPromptSystem) {
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
    this.interactionPromptSystem.showFeedback(result.message);

    if (result.transitionRequest) {
      this.bindDebugOverlayToRuntime();
    }
    this.worldRuntimeCoordinator.updatePlayerRuntimeState();
  }

  private tryStartPlacementMode(): void {
    if (!this.worldRuntimeCoordinator || !this.interactionPromptSystem) {
      return;
    }

    this.interactionPromptSystem.showFeedback(this.worldRuntimeCoordinator.startPlacementMode());
    this.worldRuntimeCoordinator.updatePlayerRuntimeState();
  }

  private tryConfirmPlacementMode(): void {
    if (!this.worldRuntimeCoordinator || !this.interactionPromptSystem) {
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
    this.interactionPromptSystem.showFeedback(result.message);
    this.worldRuntimeCoordinator.updatePlayerRuntimeState();
  }

  private tryUseWarmTea(): void {
    if (!this.worldRuntimeCoordinator || !this.interactionPromptSystem) {
      return;
    }

    const result = this.worldRuntimeCoordinator.useItem('warm_tea');
    this.interactionPromptSystem.showFeedback(result.message);
    this.worldRuntimeCoordinator.updatePlayerRuntimeState();
  }
}
