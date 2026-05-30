import Phaser from 'phaser';
import {
  paintTerrainElevation,
  paintTerrainWalkability,
  paintTerrainZone,
  type EditorMapDefinition,
  type EditorWorldZoneTag,
} from '../../shared/editor/EditorMapModel';
import type { EditorToolMode } from '../input/EditorInputController';
import type { EditorObjectToolController } from '../objects/EditorObjectToolController';
import type { EditorTerrainToolController } from '../terrain/EditorTerrainToolController';

type TileCoord = { x: number; y: number };

type EditorMapEditCallbacks = {
  getHoverTile: () => TileCoord | null;
  getMap: () => EditorMapDefinition;
  markTileDirty: (tileX: number, tileY: number) => void;
  persistWorkingDraft: () => void;
  placeNpcAtHover: () => void;
  redrawObjects: () => void;
  redrawOverlay: () => void;
  removeNpcAtHover: () => void;
  renderChunksAroundTile: (map: EditorMapDefinition, tileX: number, tileY: number) => void;
  setMap: (map: EditorMapDefinition) => void;
  setStatus: (message: string) => void;
  snapshot: (map: EditorMapDefinition) => void;
  updateInfoText: () => void;
};

export class EditorMapEditWorkflowController {
  private selectedWalkable = true;
  private selectedElevation = 0;
  private selectedZoneTag: EditorWorldZoneTag | null = 'wilds';

  constructor(
    private readonly terrainTool: EditorTerrainToolController,
    private readonly objectTool: EditorObjectToolController,
    private readonly callbacks: EditorMapEditCallbacks,
  ) {}

  getSelectedWalkable(): boolean {
    return this.selectedWalkable;
  }

  getSelectedElevation(): number {
    return this.selectedElevation;
  }

  getSelectedZoneTag(): EditorWorldZoneTag | null {
    return this.selectedZoneTag;
  }

  applyHoveredPrimaryAction(pointer: Phaser.Input.Pointer, toolMode: EditorToolMode): void {
    if (toolMode === 'object') {
      if (this.objectTool.shouldDeleteWithPointer(pointer)) {
        this.removeHoveredObject(toolMode);
        return;
      }

      this.placeHoveredObject();
      return;
    }

    if (toolMode === 'walkability') {
      this.paintHoveredWalkability();
      return;
    }

    if (toolMode === 'elevation') {
      this.paintHoveredElevation();
      return;
    }

    if (toolMode === 'zone') {
      this.paintHoveredZone();
      return;
    }

    if (toolMode === 'encounter') {
      this.callbacks.redrawOverlay();
      return;
    }

    if (toolMode === 'npc') {
      this.callbacks.placeNpcAtHover();
      return;
    }

    this.paintHoveredTile();
  }

  removeHoveredObject(toolMode: EditorToolMode): void {
    if (toolMode === 'npc') {
      this.callbacks.removeNpcAtHover();
      return;
    }

    const hoverTile = this.callbacks.getHoverTile();

    if (!hoverTile) {
      return;
    }

    const map = this.callbacks.getMap();
    this.callbacks.snapshot(map);
    const result = this.objectTool.removeObject(map, hoverTile.x, hoverTile.y);
    this.callbacks.setMap(result.map);

    if (result.removed) {
      this.callbacks.markTileDirty(hoverTile.x, hoverTile.y);
    }

    this.callbacks.redrawObjects();
    this.callbacks.updateInfoText();
    this.callbacks.persistWorkingDraft();
    this.callbacks.setStatus(
      result.removed
        ? 'Removed object at hovered tile.'
        : 'No object at hovered tile.',
    );
  }

  setWalkabilityBrush(walkable: boolean): void {
    this.selectedWalkable = walkable;
    this.callbacks.updateInfoText();
    this.callbacks.setStatus(walkable ? 'Painting walkable tiles.' : 'Painting blocked tiles.');
  }

  adjustElevation(delta: number): void {
    this.selectedElevation = Math.max(0, Math.min(9, this.selectedElevation + delta));
    this.callbacks.updateInfoText();
    this.callbacks.setStatus(`Painting height ${this.selectedElevation}.`);
  }

  setZoneTag(tag: EditorWorldZoneTag | null): void {
    this.selectedZoneTag = tag;
    this.callbacks.updateInfoText();
    this.callbacks.setStatus(tag ? `Painting zone: ${tag}.` : 'Zone erase mode.');
  }

  private paintHoveredTile(): void {
    const hoverTile = this.callbacks.getHoverTile();

    if (!hoverTile) {
      return;
    }

    this.paintTile(hoverTile.x, hoverTile.y);
  }

  private paintTile(tileX: number, tileY: number): void {
    const map = this.callbacks.getMap();
    const paintedTiles = this.terrainTool.paintTile(map, tileX, tileY);

    if (paintedTiles.length === 0) {
      return;
    }

    for (const tile of paintedTiles) {
      this.callbacks.renderChunksAroundTile(map, tile.x, tile.y);
      this.callbacks.markTileDirty(tile.x, tile.y);
    }

    this.callbacks.redrawObjects();
    this.callbacks.redrawOverlay();
    this.callbacks.updateInfoText();
    this.callbacks.persistWorkingDraft();
  }

  private paintHoveredWalkability(): void {
    const hoverTile = this.callbacks.getHoverTile();

    if (!hoverTile) {
      return;
    }

    const map = this.callbacks.getMap();
    const paintedTiles = this.terrainTool.getBrushFootprint(hoverTile.x, hoverTile.y)
      .filter((tile) => paintTerrainWalkability(map, tile.x, tile.y, this.selectedWalkable));

    this.markPaintedTilesDirty(paintedTiles);
  }

  private paintHoveredElevation(): void {
    const hoverTile = this.callbacks.getHoverTile();

    if (!hoverTile) {
      return;
    }

    const map = this.callbacks.getMap();
    const paintedTiles = this.terrainTool.getBrushFootprint(hoverTile.x, hoverTile.y)
      .filter((tile) => paintTerrainElevation(map, tile.x, tile.y, this.selectedElevation));

    this.markPaintedTilesDirty(paintedTiles);
  }

  private paintHoveredZone(): void {
    const hoverTile = this.callbacks.getHoverTile();

    if (!hoverTile) {
      return;
    }

    const map = this.callbacks.getMap();
    const footprint = this.terrainTool.getBrushFootprint(hoverTile.x, hoverTile.y);
    const painted = footprint.filter(
      (tile) => paintTerrainZone(map, tile.x, tile.y, this.selectedZoneTag),
    );
    this.markPaintedTilesDirty(painted);
  }

  private markPaintedTilesDirty(tiles: TileCoord[]): void {
    if (tiles.length === 0) {
      return;
    }

    const map = this.callbacks.getMap();

    for (const tile of tiles) {
      this.callbacks.renderChunksAroundTile(map, tile.x, tile.y);
      this.callbacks.markTileDirty(tile.x, tile.y);
    }

    this.callbacks.redrawOverlay();
    this.callbacks.updateInfoText();
    this.callbacks.persistWorkingDraft();
  }

  private placeHoveredObject(): void {
    const hoverTile = this.callbacks.getHoverTile();

    if (!hoverTile) {
      return;
    }

    const map = this.callbacks.getMap();
    this.callbacks.snapshot(map);
    this.callbacks.setMap(this.objectTool.placeObject(map, hoverTile.x, hoverTile.y));
    this.callbacks.markTileDirty(hoverTile.x, hoverTile.y);
    this.callbacks.redrawObjects();
    this.callbacks.updateInfoText();
    this.callbacks.persistWorkingDraft();
  }
}
