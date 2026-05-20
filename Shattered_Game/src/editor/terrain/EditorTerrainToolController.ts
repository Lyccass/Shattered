import {
  paintTerrainTile,
  type EditorMapDefinition,
  type EditorTerrainTilePaint,
} from '../../shared/editor/EditorMapModel';
import type { TerrainFamily } from '../../shared/map/TerrainTypes';
import {
  createEditorTerrainCatalog,
  getBrushAtOffset,
  getDefaultBrushForFamily,
  withBrushFlip,
  type EditorTerrainBrush,
  type EditorTerrainCatalog,
} from './EditorTerrainCatalog';
import { toPaint } from './EditorTerrainChunkRenderer';

export class EditorTerrainToolController {
  private readonly catalog = createEditorTerrainCatalog();
  private selectedBrush: EditorTerrainBrush = getDefaultBrushForFamily(this.catalog, 'grass');
  private lastPaintedCenterKey?: string;
  private brushSize = 1;

  getCatalog(): EditorTerrainCatalog {
    return this.catalog;
  }

  getSelectedBrush(): EditorTerrainBrush {
    return this.selectedBrush;
  }

  getSelectedPaint(): EditorTerrainTilePaint {
    return toPaint(this.selectedBrush);
  }

  getSelectedBrushIndexLabel(): string {
    const familyBrushes = this.catalog.byFamily[this.selectedBrush.family];
    const index = familyBrushes.findIndex((brush) => brush.id === this.selectedBrush.id);
    return index >= 0 ? `(${index + 1}/${familyBrushes.length})` : '';
  }

  getBrushSize(): number {
    return this.brushSize;
  }

  setBrushSize(size: number): void {
    this.brushSize = Math.max(1, Math.min(4, size));
  }

  selectFamily(family: TerrainFamily): EditorTerrainBrush {
    this.selectedBrush = getDefaultBrushForFamily(this.catalog, family);
    return this.selectedBrush;
  }

  selectById(id: string): EditorTerrainBrush {
    const brush = this.catalog.byId.get(id);
    if (brush) {
      this.selectedBrush = { ...brush };
    }
    return this.selectedBrush;
  }

  cycle(offset: number): EditorTerrainBrush {
    this.selectedBrush = getBrushAtOffset(this.catalog, this.selectedBrush, offset);
    return this.selectedBrush;
  }

  flip(axis: 'x' | 'y'): EditorTerrainBrush {
    this.selectedBrush = withBrushFlip(this.selectedBrush, axis);
    return this.selectedBrush;
  }

  resetStroke(): void {
    this.lastPaintedCenterKey = undefined;
  }

  getBrushFootprint(centerX: number, centerY: number): Array<{ x: number; y: number }> {
    const radius = this.brushSize - 1;

    if (radius === 0) {
      return [{ x: centerX, y: centerY }];
    }

    const tiles: Array<{ x: number; y: number }> = [];

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) + Math.abs(dy) <= radius) {
          tiles.push({ x: centerX + dx, y: centerY + dy });
        }
      }
    }

    return tiles;
  }

  /**
   * Paints the current brush at (centerX, centerY).
   * Returns every tile that was actually written — empty if the center was already
   * the last painted center (dedup during drag).
   */
  paintTile(map: EditorMapDefinition, centerX: number, centerY: number): Array<{ x: number; y: number }> {
    const key = tileKey(centerX, centerY);

    if (this.lastPaintedCenterKey === key) {
      return [];
    }

    const paint = this.getSelectedPaint();
    const footprint = this.getBrushFootprint(centerX, centerY);
    const painted: Array<{ x: number; y: number }> = [];

    for (const tile of footprint) {
      if (paintTerrainTile(map, tile.x, tile.y, paint)) {
        painted.push(tile);
      }
    }

    if (painted.length > 0) {
      this.lastPaintedCenterKey = key;
    }

    return painted;
  }
}

function tileKey(tileX: number, tileY: number): string {
  return `${tileX},${tileY}`;
}
