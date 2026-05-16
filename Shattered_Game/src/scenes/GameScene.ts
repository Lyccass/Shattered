import Phaser from 'phaser';
import { CameraSystem } from '../camera/CameraSystem';
import { DebugOverlaySystem } from '../debug/DebugOverlaySystem';
import { preloadObjectAssets } from '../objects/ObjectAssets';
import { OBJECT_DEFINITIONS } from '../objects/ObjectDefinitions';
import { ObjectDebugRenderer } from '../objects/ObjectDebugRenderer';
import { ObjectOcclusionSystem } from '../objects/ObjectOcclusionSystem';
import { ObjectPlacementSystem } from '../objects/ObjectPlacementSystem';
import { ObjectRegistry } from '../objects/ObjectRegistry';
import { ObjectRenderer } from '../objects/ObjectRenderer';
import { PLAYER_ASSET_PATH, PLAYER_TEXTURE_KEY } from '../player/PlayerAssets';
import { PLAYER_CONFIG } from '../player/PlayerConfig';
import { PlayerController } from '../player/PlayerController';
import { IsoTilemap } from '../world/IsoTilemap';
import { MapLoader } from '../world/maps/MapLoader';
import type { LoadedMapRuntime } from '../world/maps/MapRuntime';
import { MapTransitionSystem } from '../world/maps/MapTransitionSystem';
import { MapTransitionVisualSystem } from '../world/maps/MapTransitionVisualSystem';
import { createTerrainRenderTextures, preloadTerrainAssets } from '../world/TerrainAssets';

export class GameScene extends Phaser.Scene {
  private player?: Phaser.GameObjects.Sprite;
  private playerController?: PlayerController;
  private isoTilemap?: IsoTilemap;
  private cameraSystem?: CameraSystem;
  private debugOverlaySystem?: DebugOverlaySystem;
  private objectRegistry?: ObjectRegistry;
  private objectRenderer?: ObjectRenderer;
  private objectPlacementSystem?: ObjectPlacementSystem;
  private objectDebugRenderer?: ObjectDebugRenderer;
  private objectOcclusionSystem?: ObjectOcclusionSystem;
  private mapLoader?: MapLoader;
  private mapTransitionSystem?: MapTransitionSystem;
  private mapTransitionVisualSystem?: MapTransitionVisualSystem;
  private lastMapTransitionAt = 0;

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

    this.mapLoader = new MapLoader(this);
    this.objectRegistry = new ObjectRegistry(OBJECT_DEFINITIONS);
    this.mapTransitionSystem = new MapTransitionSystem();
    this.mapTransitionVisualSystem = new MapTransitionVisualSystem(this);
    this.loadMapIntoScene('test_wild_island', 'dock');
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
    this.updateActiveTransitionState();
    this.objectOcclusionSystem?.update(delta);
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
      this.isoTilemap?.cycleGridMode();
    });

    // Object debug controls.
    keyboard.on('keydown-O', () => {
      this.objectDebugRenderer?.toggle();
    });

    keyboard.on('keydown-L', () => {
      this.objectPlacementSystem?.debugLogPlacementInfo();
    });

    keyboard.on('keydown-E', () => {
      this.tryTriggerActiveTransition();
    });
  }

  private loadMapIntoScene(mapId: string, spawnId: string): void {
    if (!this.mapLoader || !this.objectRegistry || !this.mapTransitionSystem) {
      return;
    }

    const objectDebugVisible = this.objectDebugRenderer?.isVisible() ?? false;
    this.objectPlacementSystem?.clear();

    const loadedMap = this.mapLoader.loadMap(mapId, spawnId);
    this.isoTilemap = loadedMap.isoTilemap;
    this.mapTransitionSystem.setTransitions(loadedMap.transitions);
    this.mapTransitionVisualSystem?.setMapContext(this.isoTilemap.transform, loadedMap.transitions);

    this.objectRenderer = new ObjectRenderer(this, this.isoTilemap.transform);
    this.objectDebugRenderer = new ObjectDebugRenderer(this, this.isoTilemap.transform);
    this.objectDebugRenderer.setVisible(objectDebugVisible);
    this.objectPlacementSystem = new ObjectPlacementSystem(
      this.isoTilemap.worldGrid,
      this.objectRegistry,
      this.objectRenderer,
      this.objectDebugRenderer,
    );
    this.mapLoader.placeCurrentMapObjects(this.objectPlacementSystem);

    this.bindPlayerToMap(loadedMap);
    this.bindCameraToMap(loadedMap);
    this.bindDebugOverlayToMap();
    this.updateActiveTransitionState();
  }

  private bindPlayerToMap(loadedMap: LoadedMapRuntime): void {
    const spawnPoint = this.mapLoader?.getCurrentSpawnWorldPoint();

    if (!spawnPoint) {
      return;
    }

    if (!this.player) {
      this.player = this.add.sprite(spawnPoint.x, spawnPoint.y, PLAYER_TEXTURE_KEY);
      this.player.setScale(PLAYER_CONFIG.visualScale);
    }

    if (!this.playerController) {
      this.playerController = new PlayerController(this, this.player, loadedMap.isoTilemap);
    } else {
      this.playerController.setTilemap(loadedMap.isoTilemap);
      this.playerController.setWorldPosition(spawnPoint.x, spawnPoint.y);
    }

    if (!this.objectRenderer) {
      return;
    }

    this.objectOcclusionSystem = new ObjectOcclusionSystem(this.objectRenderer, this.player);
  }

  private bindCameraToMap(loadedMap: LoadedMapRuntime): void {
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

    this.cameras.main.centerOn(this.player.x, this.player.y);
  }

  private bindDebugOverlayToMap(): void {
    if (!this.playerController || !this.isoTilemap || !this.cameraSystem) {
      return;
    }

    if (!this.debugOverlaySystem) {
      this.debugOverlaySystem = new DebugOverlaySystem({
        scene: this,
        worldCamera: this.cameras.main,
        cameraSystem: this.cameraSystem,
        playerController: this.playerController,
        isoTilemap: this.isoTilemap,
        mapLoader: this.mapLoader,
        mapTransitionSystem: this.mapTransitionSystem,
        objectPlacementSystem: this.objectPlacementSystem,
        objectDebugRenderer: this.objectDebugRenderer,
      });
      return;
    }

    this.debugOverlaySystem.setWorldContext({
      isoTilemap: this.isoTilemap,
      mapLoader: this.mapLoader,
      mapTransitionSystem: this.mapTransitionSystem,
      objectPlacementSystem: this.objectPlacementSystem,
      objectDebugRenderer: this.objectDebugRenderer,
    });
  }

  private updateActiveTransitionState(): void {
    if (!this.playerController || !this.mapTransitionSystem) {
      return;
    }

    const feetTile = this.playerController.getFeetTile();
    const activeTransition = this.mapTransitionSystem.updateActiveTransition(feetTile.x, feetTile.y);
    this.mapTransitionVisualSystem?.setActiveTransition(activeTransition?.id ?? null);
  }

  private tryTriggerActiveTransition(): void {
    if (!this.mapTransitionSystem) {
      return;
    }

    const now = this.time.now;

    if (now - this.lastMapTransitionAt < 250) {
      return;
    }

    const transition = this.mapTransitionSystem.getActiveTransition();

    if (!transition) {
      return;
    }

    this.lastMapTransitionAt = now;
    this.loadMapIntoScene(transition.targetMapId, transition.targetSpawnId);
  }
}
