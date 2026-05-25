import Phaser from 'phaser';
import {
  getEditorTerrainAt,
  getEditorTerrainTilePaint,
  type EditorMapDefinition,
  type EditorTerrainTilePaint,
} from '../../shared/editor/EditorMapModel';
import {
  getTileCenterWorld,
  getTileDiamondPoints,
  getTileTopWorld,
  type IsoTransformConfig,
} from '../../shared/iso/IsoCoordinates';
import type { TerrainFamily } from '../../shared/map/TerrainTypes';
import {
  getDefaultBrushForFamily,
  type EditorTerrainCatalog,
} from './EditorTerrainCatalog';

export const EDITOR_CHUNK_SIZE = 32;
const TERRAIN_DEPTH = 0;

type ChunkObject = Phaser.GameObjects.GameObject;

export class EditorTerrainChunkRenderer {
  private readonly chunks = new Map<string, ChunkObject[]>();
  private uiCamera?: Phaser.Cameras.Scene2D.Camera;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly transform: IsoTransformConfig,
    private readonly catalog: EditorTerrainCatalog,
  ) {}

  setUiCamera(camera: Phaser.Cameras.Scene2D.Camera): void {
    this.uiCamera = camera;

    for (const objects of this.chunks.values()) {
      this.uiCamera.ignore(objects);
    }
  }

  renderAll(map: EditorMapDefinition): void {
    this.clear();

    for (const { chunkX, chunkY } of getChunkCoordsForMap(map.width, map.height)) {
      this.renderChunk(map, chunkX, chunkY);
    }
  }

  renderChunksAroundTile(map: EditorMapDefinition, tileX: number, tileY: number): void {
    const chunks = new Set<string>();

    for (let y = tileY - 1; y <= tileY + 1; y += 1) {
      for (let x = tileX - 1; x <= tileX + 1; x += 1) {
        if (!isTileInsideMap(map, x, y)) {
          continue;
        }

        chunks.add(chunkKey(getChunkX(x), getChunkY(y)));
      }
    }

    for (const key of chunks) {
      const [chunkX, chunkY] = parseChunkKey(key);
      this.renderChunk(map, chunkX, chunkY);
    }
  }

  getTilePaint(map: EditorMapDefinition, tileX: number, tileY: number): EditorTerrainTilePaint | null {
    const exactPaint = getEditorTerrainTilePaint(map, tileX, tileY);

    if (exactPaint) {
      return exactPaint;
    }

    const family = getEditorTerrainAt(map, tileX, tileY);

    if (!family) {
      return null;
    }

    return toPaint(getDefaultBrushForFamily(this.catalog, family));
  }

  drawChunkOverlay(map: EditorMapDefinition, graphics: Phaser.GameObjects.Graphics): void {
    graphics.clear();
    graphics.setDepth(8_000);
    graphics.lineStyle(1, 0x60a5fa, 0.24);

    for (const { chunkX, chunkY } of getChunkCoordsForMap(map.width, map.height)) {
      const startX = chunkX * EDITOR_CHUNK_SIZE;
      const startY = chunkY * EDITOR_CHUNK_SIZE;
      const endX = Math.min(startX + EDITOR_CHUNK_SIZE, map.width);
      const endY = Math.min(startY + EDITOR_CHUNK_SIZE, map.height);
      const points = [
        getTileTopWorld(this.transform, startX, startY),
        getTileTopWorld(this.transform, endX, startY),
        getTileTopWorld(this.transform, endX, endY),
        getTileTopWorld(this.transform, startX, endY),
      ].map((point) => new Phaser.Geom.Point(point.x, point.y));

      graphics.strokePoints(points, true);
    }
  }

  clear(): void {
    for (const key of this.chunks.keys()) {
      this.clearChunk(key);
    }
  }

  private renderChunk(map: EditorMapDefinition, chunkX: number, chunkY: number): void {
    const key = chunkKey(chunkX, chunkY);
    this.clearChunk(key);

    const startX = chunkX * EDITOR_CHUNK_SIZE;
    const startY = chunkY * EDITOR_CHUNK_SIZE;
    const endX = Math.min(startX + EDITOR_CHUNK_SIZE, map.width);
    const endY = Math.min(startY + EDITOR_CHUNK_SIZE, map.height);
    const objects: ChunkObject[] = [];

    for (const { tileX, tileY } of createTerrainDrawOrder(startX, startY, endX, endY)) {
      const paint = this.getTilePaint(map, tileX, tileY);

      if (!paint) {
        continue;
      }

      objects.push(this.createTileObject(tileX, tileY, paint));
    }

    this.chunks.set(key, objects);
    this.uiCamera?.ignore(objects);
  }

  private createTileObject(
    tileX: number,
    tileY: number,
    paint: EditorTerrainTilePaint,
  ): ChunkObject {
    if (!this.scene.textures.exists(paint.textureKey)) {
      return this.createFallbackTile(tileX, tileY);
    }

    const center = getTileCenterWorld(this.transform, tileX, tileY);
    const textureScale = paint.textureScale;

    if (textureScale !== undefined) {
      const image = this.scene.add.image(
        center.x + (paint.textureOffsetX ?? 0),
        center.y + (paint.textureOffsetY ?? 0),
        paint.textureKey,
      );
      image.setOrigin(0.5, 0.5);
      image.setScale(textureScale);
      image.setFlip(paint.flipX, paint.flipY);
      image.setDepth(TERRAIN_DEPTH);
      return image;
    }

    const image = this.scene.add.image(center.x, center.y - this.transform.tileHeight / 2, paint.textureKey);
    image.setOrigin(0.5, 0);
    image.setFlip(paint.flipX, paint.flipY);
    image.setDepth(TERRAIN_DEPTH);
    return image;
  }

  private createFallbackTile(tileX: number, tileY: number): ChunkObject {
    const graphics = this.scene.add.graphics();
    const points = getTileDiamondPoints(this.transform, tileX, tileY)
      .map((point) => new Phaser.Geom.Point(point.x, point.y));

    graphics.fillStyle(0xff00ff, 0.45);
    graphics.fillPoints(points, true);
    graphics.lineStyle(1, 0xffffff, 0.6);
    graphics.strokePoints(points, true);
    graphics.setDepth(TERRAIN_DEPTH);
    return graphics;
  }

  private clearChunk(key: string): void {
    const objects = this.chunks.get(key);

    if (!objects) {
      return;
    }

    objects.forEach((object) => object.destroy());
    this.chunks.delete(key);
  }
}

export function toPaint(brush: {
  id: string;
  category?: string;
  family: TerrainFamily;
  textureKey: string;
  textureDataUrl?: string;
  textureOffsetX?: number;
  textureOffsetY?: number;
  textureScale?: number;
  walkable: boolean;
  flipX: boolean;
  flipY: boolean;
}): EditorTerrainTilePaint {
  return {
    id: brush.id,
    category: brush.category,
    family: brush.family,
    textureKey: brush.textureKey,
    ...(brush.textureDataUrl !== undefined ? { textureDataUrl: brush.textureDataUrl } : {}),
    ...(brush.textureOffsetX !== undefined ? { textureOffsetX: brush.textureOffsetX } : {}),
    ...(brush.textureOffsetY !== undefined ? { textureOffsetY: brush.textureOffsetY } : {}),
    ...(brush.textureScale !== undefined ? { textureScale: brush.textureScale } : {}),
    walkable: brush.walkable,
    flipX: brush.flipX,
    flipY: brush.flipY,
  };
}

function createTerrainDrawOrder(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): Array<{ tileX: number; tileY: number }> {
  const tiles: Array<{ tileX: number; tileY: number }> = [];

  for (let diagonal = startX + startY; diagonal <= endX + endY - 2; diagonal += 1) {
    for (let tileX = startX; tileX < endX; tileX += 1) {
      const tileY = diagonal - tileX;

      if (tileY >= startY && tileY < endY) {
        tiles.push({ tileX, tileY });
      }
    }
  }

  return tiles;
}

function getChunkCoordsForMap(width: number, height: number): Array<{ chunkX: number; chunkY: number }> {
  const chunks: Array<{ chunkX: number; chunkY: number }> = [];
  const chunkWidth = Math.ceil(width / EDITOR_CHUNK_SIZE);
  const chunkHeight = Math.ceil(height / EDITOR_CHUNK_SIZE);

  for (let chunkY = 0; chunkY < chunkHeight; chunkY += 1) {
    for (let chunkX = 0; chunkX < chunkWidth; chunkX += 1) {
      chunks.push({ chunkX, chunkY });
    }
  }

  return chunks;
}

function isTileInsideMap(map: EditorMapDefinition, tileX: number, tileY: number): boolean {
  return tileX >= 0 && tileY >= 0 && tileX < map.width && tileY < map.height;
}

function getChunkX(tileX: number): number {
  return Math.floor(tileX / EDITOR_CHUNK_SIZE);
}

function getChunkY(tileY: number): number {
  return Math.floor(tileY / EDITOR_CHUNK_SIZE);
}

function chunkKey(chunkX: number, chunkY: number): string {
  return `${chunkX},${chunkY}`;
}

function parseChunkKey(key: string): [number, number] {
  const [chunkX, chunkY] = key.split(',').map((part) => Number.parseInt(part, 10));
  return [chunkX, chunkY];
}
