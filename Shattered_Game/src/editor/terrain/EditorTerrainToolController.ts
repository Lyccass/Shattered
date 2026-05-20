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
  private lastPaintedTileKey?: string;

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

  selectFamily(family: TerrainFamily): EditorTerrainBrush {
    this.selectedBrush = getDefaultBrushForFamily(this.catalog, family);
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
    this.lastPaintedTileKey = undefined;
  }

  paintTile(map: EditorMapDefinition, tileX: number, tileY: number): boolean {
    const key = tileKey(tileX, tileY);

    if (this.lastPaintedTileKey === key) {
      return false;
    }

    if (!paintTerrainTile(map, tileX, tileY, this.getSelectedPaint())) {
      return false;
    }

    this.lastPaintedTileKey = key;
    return true;
  }
}

function tileKey(tileX: number, tileY: number): string {
  return `${tileX},${tileY}`;
}
