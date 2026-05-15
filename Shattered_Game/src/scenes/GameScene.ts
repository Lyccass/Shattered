import Phaser from 'phaser';
import { CameraSystem } from '../camera/CameraSystem';
import { PROTOTYPE_SCALE } from '../config/prototypeScale';
import { DebugOverlaySystem } from '../debug/DebugOverlaySystem';
import { OBJECT_DEFINITIONS } from '../objects/ObjectDefinitions';
import { ObjectDebugRenderer } from '../objects/ObjectDebugRenderer';
import { ObjectPlacementSystem } from '../objects/ObjectPlacementSystem';
import { ObjectRegistry } from '../objects/ObjectRegistry';
import { ObjectRenderer } from '../objects/ObjectRenderer';
import { ObjectTestArea } from '../objects/ObjectTestArea';
import { PLAYER_ASSET_PATH, PLAYER_TEXTURE_KEY } from '../player/PlayerAssets';
import { PLAYER_CONFIG } from '../player/PlayerConfig';
import { PlayerController } from '../player/PlayerController';
import { IsoTilemap } from '../world/IsoTilemap';
import { createTerrainRenderTextures, preloadTerrainAssets } from '../world/TerrainAssets';

export class GameScene extends Phaser.Scene {
  private player?: Phaser.GameObjects.Sprite;
  private playerController?: PlayerController;
  private isoTilemap?: IsoTilemap;
  private cameraSystem?: CameraSystem;
  private debugOverlaySystem?: DebugOverlaySystem;
  private objectPlacementSystem?: ObjectPlacementSystem;
  private objectDebugRenderer?: ObjectDebugRenderer;
  private objectTestArea?: ObjectTestArea;

  constructor() {
    super('GameScene');
  }

  preload(): void {
    if (!this.textures.exists(PLAYER_TEXTURE_KEY)) {
      this.load.image(PLAYER_TEXTURE_KEY, PLAYER_ASSET_PATH);
    }

    preloadTerrainAssets(this);
  }

  create(): void {
    createTerrainRenderTextures(this);

    this.isoTilemap = new IsoTilemap(this, {
      width: PROTOTYPE_SCALE.mapWidth,
      height: PROTOTYPE_SCALE.mapHeight,
    });
    const worldBounds = this.isoTilemap.render();

    // Object system wiring. GameScene only constructs and connects subsystems —
    // all placement, rendering and debug logic lives inside src/objects/*.
    const objectRegistry = new ObjectRegistry(OBJECT_DEFINITIONS);
    const objectRenderer = new ObjectRenderer(this, this.isoTilemap.transform);
    this.objectDebugRenderer = new ObjectDebugRenderer(this, this.isoTilemap.transform);
    this.objectPlacementSystem = new ObjectPlacementSystem(
      this.isoTilemap.worldGrid,
      objectRegistry,
      objectRenderer,
      this.objectDebugRenderer,
    );
    this.objectTestArea = new ObjectTestArea(this.objectPlacementSystem);
    this.objectTestArea.build();

    const spawnPoint = this.isoTilemap.getSpawnPoint();
    this.player = this.add.sprite(spawnPoint.x, spawnPoint.y, PLAYER_TEXTURE_KEY);
    this.player.setScale(PLAYER_CONFIG.visualScale);
    this.playerController = new PlayerController(this, this.player, this.isoTilemap);

    this.cameraSystem = new CameraSystem({
      scene: this,
      camera: this.cameras.main,
      bounds: worldBounds,
      followTarget: this.player,
    });
    this.debugOverlaySystem = new DebugOverlaySystem({
      scene: this,
      worldCamera: this.cameras.main,
      cameraSystem: this.cameraSystem,
      playerController: this.playerController,
      isoTilemap: this.isoTilemap,
      objectPlacementSystem: this.objectPlacementSystem,
      objectDebugRenderer: this.objectDebugRenderer,
    });
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

    keyboard.on('keydown-X', () => {
      this.objectTestArea?.removeOneTestObject();
    });
  }
}
