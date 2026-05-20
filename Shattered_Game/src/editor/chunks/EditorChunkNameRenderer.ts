import Phaser from 'phaser';
import { getTileCenterWorld, type IsoTransformConfig } from '../../shared/iso/IsoCoordinates';
import type { EditorMapDefinition } from '../../shared/editor/EditorMapModel';
import { EDITOR_CHUNK_SIZE } from '../terrain/EditorTerrainChunkRenderer';

const LABEL_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: "'Asimovian', 'Palatino Linotype', Palatino, serif",
  fontSize: '13px',
  color: '#cecca0',
  backgroundColor: '#0c0702cc',
  padding: { x: 6, y: 3 },
};

export class EditorChunkNameRenderer {
  private readonly labels = new Map<string, Phaser.GameObjects.Text>();
  private uiCamera?: Phaser.Cameras.Scene2D.Camera;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly transform: IsoTransformConfig,
  ) {}

  setUiCamera(camera: Phaser.Cameras.Scene2D.Camera): void {
    this.uiCamera = camera;
    this.uiCamera.ignore([...this.labels.values()]);
  }

  setMapContext(map: EditorMapDefinition): void {
    this.clear();
    const cols = Math.ceil(map.width  / EDITOR_CHUNK_SIZE);
    const rows = Math.ceil(map.height / EDITOR_CHUNK_SIZE);

    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        this.upsertLabel(cx, cy, map.chunkNames);
      }
    }
  }

  setChunkName(chunkX: number, chunkY: number, chunkNames: Record<string, string> | undefined): void {
    this.upsertLabel(chunkX, chunkY, chunkNames);
  }

  clear(): void {
    this.labels.forEach((t) => t.destroy());
    this.labels.clear();
  }

  private upsertLabel(
    chunkX: number,
    chunkY: number,
    chunkNames: Record<string, string> | undefined,
  ): void {
    const key  = `${chunkX},${chunkY}`;
    const name = chunkNames?.[key] ?? '';
    const text = name ? `[${chunkX},${chunkY}] ${name}` : `[${chunkX},${chunkY}]`;

    // Position at the isometric centre of the chunk
    const midTileX = chunkX * EDITOR_CHUNK_SIZE + (EDITOR_CHUNK_SIZE - 1) / 2;
    const midTileY = chunkY * EDITOR_CHUNK_SIZE + (EDITOR_CHUNK_SIZE - 1) / 2;
    const world = getTileCenterWorld(this.transform, midTileX, midTileY);

    const existing = this.labels.get(key);

    if (existing) {
      existing.setText(text).setPosition(world.x, world.y);
      return;
    }

    const label = this.scene.add.text(world.x, world.y, text, LABEL_STYLE)
      .setOrigin(0.5, 0.5)
      .setDepth(12_000);

    this.labels.set(key, label);
    this.uiCamera?.ignore(label);
  }
}
