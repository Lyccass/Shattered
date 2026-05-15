import Phaser from 'phaser';
import { CameraSystem } from '../camera/CameraSystem';
import { PlayerController } from '../player/PlayerController';
import { RENDER_DEPTHS } from '../render/RenderLayers';
import { IsoTilemap } from '../world/IsoTilemap';

type DebugOverlaySystemConfig = {
  scene: Phaser.Scene;
  worldCamera: Phaser.Cameras.Scene2D.Camera;
  cameraSystem: CameraSystem;
  playerController: PlayerController;
  isoTilemap: IsoTilemap;
};

export class DebugOverlaySystem {
  private readonly scene: Phaser.Scene;
  private readonly cameraSystem: CameraSystem;
  private readonly playerController: PlayerController;
  private readonly isoTilemap: IsoTilemap;
  private readonly uiCamera: Phaser.Cameras.Scene2D.Camera;
  private readonly zoomText: Phaser.GameObjects.Text;
  private readonly detailText: Phaser.GameObjects.Text;
  private readonly playerFeetMarker: Phaser.GameObjects.Arc;
  private isVisible = false;

  constructor({
    scene,
    worldCamera,
    cameraSystem,
    playerController,
    isoTilemap,
  }: DebugOverlaySystemConfig) {
    this.scene = scene;
    this.cameraSystem = cameraSystem;
    this.playerController = playerController;
    this.isoTilemap = isoTilemap;
    this.uiCamera = this.scene.cameras.add(0, 0, this.scene.scale.width, this.scene.scale.height);
    this.zoomText = this.createText(16, 16);
    this.detailText = this.createText(16, 56);
    this.playerFeetMarker = this.createPlayerFeetMarker();

    worldCamera.ignore([this.zoomText, this.detailText]);
    this.ignoreWorldForUiCamera();
    this.registerResizeHandler();
    this.registerToggleKey();
    this.setVisible(false);
  }

  update(): void {
    const zoom = this.cameraSystem.getZoom();
    const gridMode = this.isoTilemap.getGridMode();

    this.zoomText.setText(`Zoom: ${zoom.toFixed(2)}x  Grid: ${gridMode}  [Z/Wheel] [G] [K]`);

    if (!this.isVisible) {
      return;
    }

    const player = this.playerController.sprite;
    const feetPoint = this.playerController.getFeetPoint();
    const playerGrid = this.playerController.getGridPosition();
    const pointer = this.scene.input.activePointer;
    const mouseWorld = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const mouseGrid = this.isoTilemap.transform.getMouseGridPosition(pointer, this.scene.cameras.main);
    const mouseTile = this.isoTilemap.transform.worldToTile(mouseWorld.x, mouseWorld.y);
    const playerFeetTile = this.playerController.getFeetTile();
    const isPlayerFeetBlocked = this.playerController.isFeetTileBlocked();
    const isMouseGridWalkable = this.isoTilemap.isWorldGridWalkable(mouseGrid.x, mouseGrid.y);
    const isMouseTileBlocked = !this.isoTilemap.isTileWalkable(mouseTile.x, mouseTile.y);
    const fps = this.scene.game.loop.actualFps;

    this.playerFeetMarker.setPosition(feetPoint.x, feetPoint.y);
    this.playerFeetMarker.setFillStyle(isPlayerFeetBlocked ? 0xff3b5c : 0xffff00, 1);

    this.detailText.setText([
      'Debug [K]',
      `Player: ${player.x.toFixed(1)}, ${player.y.toFixed(1)}`,
      `Player grid: ${playerGrid.x.toFixed(2)}, ${playerGrid.y.toFixed(2)}`,
      `Player feet tile: ${playerFeetTile.x}, ${playerFeetTile.y} ${isPlayerFeetBlocked ? 'BLOCKED' : 'walkable'}`,
      `Feet/depth: ${feetPoint.x.toFixed(1)}, ${feetPoint.y.toFixed(1)}`,
      `Mouse world: ${mouseWorld.x.toFixed(1)}, ${mouseWorld.y.toFixed(1)}`,
      `Mouse fractional grid: ${mouseGrid.x.toFixed(2)}, ${mouseGrid.y.toFixed(2)} ${isMouseGridWalkable ? 'walkable' : 'BLOCKED'}`,
      `Mouse resolved tile: ${mouseTile.x}, ${mouseTile.y} ${isMouseTileBlocked ? 'BLOCKED' : 'walkable'}`,
      `FPS: ${fps.toFixed(0)}`,
      `Zoom: ${zoom.toFixed(2)}x`,
      `Grid mode: ${gridMode}`,
      `Map/chunks: ${this.isoTilemap.width}x${this.isoTilemap.height} / ${this.isoTilemap.getTerrainChunkCount()}`,
      `Terrain-blocked tiles: ${this.isoTilemap.getTerrainBlockedTileCount()}`,
      'Legend:',
      'yellow dot = player feet/depth anchor',
      'fractional grid = raw world position projected into grid space',
      'resolved tile = rounded tile used by walkability checks',
      'BLOCKED = terrain/water tile only',
    ]);
  }

  private createText(x: number, y: number): Phaser.GameObjects.Text {
    const text = this.scene.add.text(x, y, '', {
      color: '#d7f3ff',
      fontFamily: 'monospace',
      fontSize: '16px',
      backgroundColor: '#07111fcc',
      padding: {
        x: 10,
        y: 8,
      },
    });

    text.setScrollFactor(0);
    text.setDepth(RENDER_DEPTHS.UI);

    return text;
  }

  private createPlayerFeetMarker(): Phaser.GameObjects.Arc {
    const marker = this.scene.add.circle(0, 0, 5, 0xffff00, 1);

    marker.setStrokeStyle(2, 0x111111, 0.85);
    marker.setDepth(RENDER_DEPTHS.DEBUG + 4);

    return marker;
  }

  private registerToggleKey(): void {
    this.scene.input.keyboard?.on('keydown-K', (event: KeyboardEvent) => {
      event.preventDefault();
      this.setVisible(!this.isVisible);
    });
  }

  private setVisible(isVisible: boolean): void {
    this.isVisible = isVisible;
    this.detailText.setVisible(isVisible);
    this.playerFeetMarker.setVisible(isVisible);
  }

  private registerResizeHandler(): void {
    this.scene.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.uiCamera.setViewport(0, 0, gameSize.width, gameSize.height);
    });
  }

  private ignoreWorldForUiCamera(): void {
    const nonUiChildren = this.scene.children
      .getChildren()
      .filter((child) => child !== this.zoomText && child !== this.detailText);

    this.uiCamera.ignore(nonUiChildren);
  }
}
