import Phaser from 'phaser';
import type {
  EditorMapDefinition,
  EditorTerrainTilePaint,
} from '../../shared/editor/EditorMapModel';
import type { TerrainFamily } from '../../shared/map/TerrainTypes';
import type { EditorTerrainBrush } from '../terrain/EditorTerrainCatalog';

type EditorHudHoverState = {
  family: TerrainFamily | null;
  objectDefinitionId: string | null;
  paint: EditorTerrainTilePaint | null;
  tile: { x: number; y: number } | null;
};

export type EditorHudState = {
  hover: EditorHudHoverState;
  map: EditorMapDefinition;
  selectedBrush: EditorTerrainBrush;
  selectedBrushIndexLabel: string;
  selectedObjectDisplayName: string;
  toolMode: string;
};

export class EditorHudController {
  private infoText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private selectedPreviewImage?: Phaser.GameObjects.Image;
  private hoveredPreviewImage?: Phaser.GameObjects.Image;

  constructor(private readonly scene: Phaser.Scene) {}

  create(selectedBrush: EditorTerrainBrush): void {
    this.infoText = this.scene.add.text(16, 16, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#dbeafe',
      backgroundColor: '#0f172acc',
      padding: { x: 8, y: 6 },
    }).setScrollFactor(0).setDepth(10_000);
    this.statusText = this.scene.add.text(16, 198, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#bfdbfe',
      backgroundColor: '#0f172acc',
      padding: { x: 8, y: 6 },
    }).setScrollFactor(0).setDepth(10_000);
    this.selectedPreviewImage = this.scene.add.image(48, 306, selectedBrush.textureKey)
      .setOrigin(0.5, 0)
      .setDepth(10_000)
      .setScrollFactor(0)
      .setScale(1.5);
    this.hoveredPreviewImage = this.scene.add.image(128, 306, selectedBrush.textureKey)
      .setOrigin(0.5, 0)
      .setDepth(10_000)
      .setScrollFactor(0)
      .setScale(1.5);
  }

  getObjects(): Phaser.GameObjects.GameObject[] {
    const objects: Phaser.GameObjects.GameObject[] = [];

    if (this.infoText) objects.push(this.infoText);
    if (this.statusText) objects.push(this.statusText);
    if (this.selectedPreviewImage) objects.push(this.selectedPreviewImage);
    if (this.hoveredPreviewImage) objects.push(this.hoveredPreviewImage);

    return objects;
  }

  setStatus(message: string): void {
    this.statusText?.setText(message);
  }

  update(state: EditorHudState): void {
    if (!this.infoText) {
      return;
    }

    this.updatePreviewImages(state.selectedBrush, state.hover.paint);
    this.infoText.setText([
      `Map: ${state.map.displayName} (${state.map.width}x${state.map.height})`,
      `Mode: ${state.toolMode}`,
      `Selected: ${state.selectedBrush.label} ${state.selectedBrushIndexLabel}`,
      `Selected object: ${state.selectedObjectDisplayName}`,
      `Selected art: ${state.selectedBrush.textureKey}`,
      `Selected flip: ${formatFlip(state.selectedBrush)}`,
      `Hover tile: ${state.hover.tile ? `${state.hover.tile.x},${state.hover.tile.y}` : '-'}`,
      `Hover terrain: ${state.hover.family ?? '-'}`,
      `Hover art: ${state.hover.paint?.id ?? '-'}`,
      `Hover object: ${state.hover.objectDefinitionId ?? '-'}`,
      `Camera: WASD/arrows, right/middle drag, wheel zoom`,
      `Mode: T terrain, O object`,
      `Terrain: 1-5 family, Q/E or [/] exact tile, F/V flip brush`,
      `Object: Q/E or [/] object, left click place, Shift+click/D/Del remove`,
      `Map: R resize, C center, X map export, Y chunk export, I import`,
    ]);
  }

  private updatePreviewImages(
    selectedBrush: EditorTerrainBrush,
    hoverPaint: EditorTerrainTilePaint | null,
  ): void {
    this.updatePreviewImage(this.selectedPreviewImage, selectedBrush);
    this.updatePreviewImage(this.hoveredPreviewImage, hoverPaint);
  }

  private updatePreviewImage(
    image: Phaser.GameObjects.Image | undefined,
    paint: { textureKey: string; flipX: boolean; flipY: boolean } | null,
  ): void {
    if (!image) {
      return;
    }

    if (!paint || !this.scene.textures.exists(paint.textureKey)) {
      image.setVisible(false);
      return;
    }

    image
      .setVisible(true)
      .setTexture(paint.textureKey)
      .setFlip(paint.flipX, paint.flipY);
  }
}

function formatFlip(paint: { flipX: boolean; flipY: boolean }): string {
  return `${paint.flipX ? 'X' : '-'} ${paint.flipY ? 'Y' : '-'}`;
}
