import type { EditorMapDefinition } from '../../shared/editor/EditorMapModel';
import type { EditorTerrainToolController } from '../terrain/EditorTerrainToolController';
import type { EditorObjectToolController } from '../objects/EditorObjectToolController';
import type { EditorAssetLibraryController } from './EditorAssetLibraryController';
import type { EditorDefinitionPanelController } from '../ui/EditorDefinitionPanelController';
import type { EditorTilePaletteController } from '../ui/EditorTilePaletteController';

type EditorCustomDefinitionCallbacks = {
  getMap: () => EditorMapDefinition;
  getTexturePreviewDataUrl: (textureKey: string | null) => string | null;
  markAllChunksDirty: (width: number, height: number) => void;
  persistWorkingDraft: () => void;
  redrawObjects: () => void;
  redrawOverlay: () => void;
  redrawTerrain: () => void;
  setMap: (map: EditorMapDefinition) => void;
  setStatus: (message: string) => void;
  snapshot: (map: EditorMapDefinition) => void;
  updateInfoText: () => void;
};

export class EditorCustomDefinitionWorkflowController {
  constructor(
    private readonly terrainTool: EditorTerrainToolController,
    private readonly objectTool: EditorObjectToolController,
    private readonly assetLibrary: EditorAssetLibraryController,
    private readonly definitionPanel: EditorDefinitionPanelController,
    private readonly getPalette: () => EditorTilePaletteController | undefined,
    private readonly callbacks: EditorCustomDefinitionCallbacks,
  ) {}

  createCustomTerrainBrush(): void {
    const base = this.terrainTool.getSelectedBrush();
    this.definitionPanel.show({
      flagChecked: base.walkable,
      flagLabel: 'Walkable tile',
      idValue: `custom_${base.id}`,
      nameValue: base.label,
      categoryValue: base.category ?? base.family,
      previewColor: null,
      previewSrc: this.callbacks.getTexturePreviewDataUrl(base.textureKey),
      title: 'Create Custom Tile',
      assetKind: 'terrainTile',
      onCreate: ({
        category,
        flag,
        id,
        name,
        textureDataUrl,
        textureKey,
        textureOffsetX,
        textureOffsetY,
        textureScale,
      }) => {
        const brush = this.terrainTool.createCustomBrushFromSelected(
          id,
          name,
          flag,
          textureKey,
          textureDataUrl,
          category,
          textureScale,
          textureOffsetX,
          textureOffsetY,
        );
        const paint = this.terrainTool.getSelectedPaint();
        this.assetLibrary.addTerrainPaint(paint);
        this.getPalette()?.updateTerrainSelection(brush);
        this.callbacks.updateInfoText();
        this.callbacks.persistWorkingDraft();
        this.definitionPanel.close();
        this.callbacks.setStatus(`Added custom tile ${brush.label} (${flag ? 'walkable' : 'blocked'}).`);
      },
    });
  }

  createCustomObjectDefinition(): void {
    const base = this.objectTool.getSelectedDefinition();
    this.definitionPanel.show({
      flagChecked: base.blocksMovement,
      flagLabel: 'Blocks movement',
      idValue: `custom_${base.id}`,
      nameValue: base.displayName,
      categoryValue: base.category,
      footprintHeight: getFootprintHeight(base.collisionFootprint),
      footprintWidth: getFootprintWidth(base.collisionFootprint),
      previewColor: this.objectTool.getPreviewColor(),
      previewSrc: this.callbacks.getTexturePreviewDataUrl(this.objectTool.getPreviewTextureKey()),
      title: 'Create Custom Object',
      assetKind: 'object',
      onCreate: ({
        category,
        flag,
        footprintHeight,
        footprintWidth,
        id,
        name,
        textureDataUrl,
        textureHeight,
        textureKey,
        textureOffsetX,
        textureOffsetY,
        textureScale,
        textureWidth,
      }) => {
        const definition = this.objectTool.createCustomDefinitionFromSelected(
          id,
          name,
          flag,
          textureKey,
          textureDataUrl,
          category,
          footprintWidth,
          footprintHeight,
          textureWidth,
          textureHeight,
          textureScale,
          textureOffsetX,
          textureOffsetY,
        );
        this.assetLibrary.addObjectDefinition(definition);
        this.getPalette()?.refresh(this.terrainTool.getSelectedBrush(), definition.id);
        this.getPalette()?.updateObjectSelection(definition.id);
        this.callbacks.updateInfoText();
        this.callbacks.persistWorkingDraft();
        this.definitionPanel.close();
        this.callbacks.setStatus(`Added custom object ${definition.displayName} (${flag ? 'blocking' : 'walkable'}).`);
      },
    });
  }

  deleteSelectedCustomTerrainBrush(): void {
    const brush = this.terrainTool.getSelectedBrush();

    if (brush.source !== 'custom') {
      this.callbacks.setStatus('Only custom tiles can be deleted.');
      return;
    }

    const map = this.callbacks.getMap();
    const usedCount = Object.values(map.terrainTiles).filter((p) => p.id === brush.id).length;
    if (!window.confirm(`Delete custom tile "${brush.label}"?\nThis will replace ${usedCount} painted tile(s) across the map.`)) {
      return;
    }

    this.callbacks.snapshot(map);
    const replacementBrush = this.terrainTool.selectFamily(brush.family);
    const replacementPaint = this.terrainTool.getSelectedPaint();
    const nextMap = {
      ...map,
      terrain: map.terrain.map((row) => [...row]),
      terrainTiles: { ...map.terrainTiles },
      terrainWalkability: { ...map.terrainWalkability },
    };
    let replacedTiles = 0;

    for (const [key, paint] of Object.entries(nextMap.terrainTiles)) {
      if (paint.id !== brush.id) {
        continue;
      }

      const [tileX, tileY] = parseTileKey(key);
      nextMap.terrain[tileY][tileX] = replacementPaint.family;
      nextMap.terrainTiles[key] = { ...replacementPaint };
      nextMap.terrainWalkability[key] = replacementPaint.walkable;
      replacedTiles += 1;
    }

    const deleted = this.terrainTool.deleteCustomBrush(brush.id);

    if (!deleted) {
      this.callbacks.setStatus('Custom tile could not be deleted.');
      return;
    }

    const mapWithoutBrush = {
      ...nextMap,
      customTerrainBrushes: nextMap.customTerrainBrushes.filter((paint) => paint.id !== brush.id),
    };
    this.callbacks.setMap(mapWithoutBrush);
    this.assetLibrary.removeTerrainPaint(brush.id);
    this.callbacks.markAllChunksDirty(mapWithoutBrush.width, mapWithoutBrush.height);
    this.getPalette()?.updateTerrainSelection(replacementBrush);
    this.callbacks.redrawTerrain();
    this.callbacks.redrawOverlay();
    this.callbacks.updateInfoText();
    this.callbacks.persistWorkingDraft();
    this.callbacks.setStatus(`Deleted custom tile ${brush.label}. Replaced ${replacedTiles} painted tile(s).`);
  }

  deleteSelectedCustomObjectDefinition(): void {
    const definition = this.objectTool.getSelectedDefinition();

    if (!definition.id.startsWith('custom_')) {
      this.callbacks.setStatus('Only custom objects can be deleted.');
      return;
    }

    const map = this.callbacks.getMap();
    const removedObjects = map.objects.filter((object) => object.definitionId === definition.id).length;
    if (!window.confirm(`Delete custom object "${definition.displayName}"?\nThis will remove ${removedObjects} placed instance(s) from the map.`)) {
      return;
    }

    this.callbacks.snapshot(map);
    const deleted = this.objectTool.deleteCustomDefinition(definition.id);

    if (!deleted) {
      this.callbacks.setStatus('Custom object could not be deleted.');
      return;
    }

    const selected = this.objectTool.getSelectedDefinition();
    const nextMap = {
      ...map,
      customObjectDefinitions: map.customObjectDefinitions.filter((candidate) => candidate.id !== definition.id),
      objects: map.objects.filter((object) => object.definitionId !== definition.id),
    };
    this.callbacks.setMap(nextMap);
    this.assetLibrary.removeObjectDefinition(definition.id);
    this.callbacks.markAllChunksDirty(nextMap.width, nextMap.height);
    this.getPalette()?.updateObjectSelection(selected.id);
    this.callbacks.redrawObjects();
    this.callbacks.updateInfoText();
    this.callbacks.persistWorkingDraft();
    this.callbacks.setStatus(`Deleted custom object ${definition.displayName}. Removed ${removedObjects} placed instance(s).`);
  }

  deleteAllInstancesOfSelectedObject(): void {
    const definition = this.objectTool.getSelectedDefinition();
    const map = this.callbacks.getMap();
    const count = map.objects.filter((o) => o.definitionId === definition.id).length;

    if (count === 0) {
      this.callbacks.setStatus(`No placed instances of "${definition.displayName}" on the map.`);
      return;
    }

    if (!window.confirm(`Delete all ${count} placed instance(s) of "${definition.displayName}" from the map?`)) {
      return;
    }

    this.callbacks.snapshot(map);
    const nextMap = { ...map, objects: map.objects.filter((o) => o.definitionId !== definition.id) };
    this.callbacks.setMap(nextMap);
    this.callbacks.markAllChunksDirty(nextMap.width, nextMap.height);
    this.callbacks.redrawObjects();
    this.callbacks.updateInfoText();
    this.callbacks.persistWorkingDraft();
    this.callbacks.setStatus(`Removed all ${count} instance(s) of "${definition.displayName}".`);
  }
}

function parseTileKey(key: string): [number, number] {
  const [tileX, tileY] = key.split(',').map((part) => Number.parseInt(part, 10));
  return [Number.isFinite(tileX) ? tileX : -1, Number.isFinite(tileY) ? tileY : -1];
}

function getFootprintWidth(footprint: ReadonlyArray<{ x: number; y: number }>): number {
  return Math.max(1, ...footprint.map((tile) => tile.x + 1));
}

function getFootprintHeight(footprint: ReadonlyArray<{ x: number; y: number }>): number {
  return Math.max(1, ...footprint.map((tile) => tile.y + 1));
}
