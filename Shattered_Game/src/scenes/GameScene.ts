import Phaser from 'phaser';
import { CameraSystem } from '../camera/CameraSystem';
import { PROTOTYPE_SCALE } from '../config/prototypeScale';
import { DebugOverlaySystem } from '../debug/DebugOverlaySystem';
import { PLAYER_CONFIG } from '../player/PlayerConfig';
import { PlayerController } from '../player/PlayerController';
import { IsoTilemap } from '../world/IsoTilemap';

const PLAYER_TEXTURE_KEY = 'placeholder-player';

export class GameScene extends Phaser.Scene {
  private player?: Phaser.GameObjects.Sprite;
  private playerController?: PlayerController;
  private isoTilemap?: IsoTilemap;
  private cameraSystem?: CameraSystem;
  private debugOverlaySystem?: DebugOverlaySystem;

  constructor() {
    super('GameScene');
  }

  preload(): void {
    this.createPlaceholderPlayerTexture();
  }

  create(): void {
    this.isoTilemap = new IsoTilemap(this, {
      width: PROTOTYPE_SCALE.mapWidth,
      height: PROTOTYPE_SCALE.mapHeight,
    });
    const worldBounds = this.isoTilemap.render();

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

  private createPlaceholderPlayerTexture(): void {
    if (this.textures.exists(PLAYER_TEXTURE_KEY)) {
      return;
    }

    const graphics = this.make.graphics({ x: 0, y: 0 }, false);

    graphics.fillStyle(0xf8fafc, 1);
    graphics.fillCircle(24, 13, 10);
    graphics.fillStyle(0x38bdf8, 1);
    graphics.fillRoundedRect(13, 24, 22, 28, 5);
    graphics.fillStyle(0x1d4ed8, 1);
    graphics.fillRect(15, 50, 8, 16);
    graphics.fillRect(25, 50, 8, 16);
    graphics.fillStyle(0xe0f2fe, 1);
    graphics.fillRect(9, 27, 5, 20);
    graphics.fillRect(34, 27, 5, 20);
    graphics.lineStyle(2, 0x082f49, 1);
    graphics.strokeRoundedRect(13, 24, 22, 28, 5);
    graphics.generateTexture(PLAYER_TEXTURE_KEY, 48, 72);
    graphics.destroy();
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
  }
}
