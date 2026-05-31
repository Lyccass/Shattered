import { decodeTerrainPaletteLayer } from '../../shared/world/TerrainPalette';
import type { EditorMapDefinition } from '../../shared/editor/EditorMapModel';
import type { EditorDirtyChunkBundleV1 } from '../chunks/EditorDirtyChunkBundle';

const PREVIEW_WIDTH = 160;
const PREVIEW_HEIGHT = 96;

export function createMapPreviewDataUrl(map: EditorMapDefinition): string {
  const canvas = document.createElement('canvas');
  canvas.width = PREVIEW_WIDTH;
  canvas.height = PREVIEW_HEIGHT;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return '';
  }

  drawTerrainPreview(ctx, map.terrain, map.width, map.height, canvas.width, canvas.height);

  for (const object of map.objects) {
    const x = Math.floor((object.tileX / Math.max(1, map.width - 1)) * (canvas.width - 1));
    const y = Math.floor((object.tileY / Math.max(1, map.height - 1)) * (canvas.height - 1));
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x - 1, y - 1, 3, 3);
  }

  return canvas.toDataURL('image/png');
}

export function createChunkBundlePreviewDataUrl(bundle: EditorDirtyChunkBundleV1): string {
  const canvas = document.createElement('canvas');
  canvas.width = PREVIEW_WIDTH;
  canvas.height = PREVIEW_HEIGHT;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return '';
  }

  ctx.fillStyle = '#07111f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const columns = Math.max(1, Math.ceil(Math.sqrt(bundle.chunks.length)));
  const cellWidth = canvas.width / columns;
  const cellHeight = canvas.height / Math.max(1, Math.ceil(bundle.chunks.length / columns));

  bundle.chunks.forEach((chunk, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const terrain = chunk.terrain.encoding === 'palette'
      ? decodeTerrainPaletteLayer(chunk.terrainPalette ?? {}, chunk.terrain.tiles)
      : chunk.terrain.tiles;
    ctx.save();
    ctx.translate(column * cellWidth, row * cellHeight);
    ctx.beginPath();
    ctx.rect(0, 0, cellWidth, cellHeight);
    ctx.clip();
    drawTerrainPreview(ctx, terrain, chunk.width, chunk.height, cellWidth, cellHeight);
    ctx.strokeStyle = '#bc8c40';
    ctx.strokeRect(0.5, 0.5, cellWidth - 1, cellHeight - 1);
    ctx.restore();
  });

  return canvas.toDataURL('image/png');
}

function drawTerrainPreview(
  ctx: CanvasRenderingContext2D,
  terrain: string[][],
  width: number,
  height: number,
  previewWidth: number,
  previewHeight: number,
): void {
  const tileW = previewWidth / Math.max(1, width);
  const tileH = previewHeight / Math.max(1, height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      ctx.fillStyle = terrainColor(terrain[y]?.[x] ?? 'grass');
      ctx.fillRect(Math.floor(x * tileW), Math.floor(y * tileH), Math.ceil(tileW), Math.ceil(tileH));
    }
  }
}

function terrainColor(family: string): string {
  switch (family) {
    case 'dirt':  return '#76613e';
    case 'sand':  return '#bca76a';
    case 'stone': return '#737373';
    case 'water': return '#1e5d76';
    case 'grass':
    default:      return '#426b34';
  }
}
