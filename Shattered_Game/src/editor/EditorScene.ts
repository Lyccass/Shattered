import Phaser from 'phaser';
import {
  createEditorMap,
  createSampleEditorMap,
  getEditorTerrainElevationAt,
  getEditorTerrainAt,
  type EditorMapDefinition,
  getEditorTerrainWalkabilityAt,
  paintTerrainElevation,
  paintTerrainWalkability,
  resizeEditorMap,
} from '../shared/editor/EditorMapModel';
import {
  getTileDiamondPoints,
  worldToTile,
  type IsoTransformConfig,
} from '../shared/iso/IsoCoordinates';
import type { TerrainFamily } from '../shared/map/TerrainTypes';
import { preloadTerrainAssets, createTerrainRenderTextures } from '../world/terrain/TerrainAssets';
import { preloadObjectAssets } from '../objects/ObjectAssets';
import {
  EDITOR_CHUNK_SIZE,
  EditorTerrainChunkRenderer,
} from './terrain/EditorTerrainChunkRenderer';
import { EditorTerrainToolController } from './terrain/EditorTerrainToolController';
import { EditorHudController } from './ui/EditorHudController';
import { EditorObjectLayerRenderer } from './objects/EditorObjectLayerRenderer';
import { EditorObjectToolController } from './objects/EditorObjectToolController';
import { EditorDirtyChunkTracker } from './chunks/EditorDirtyChunkTracker';
import { createDirtyChunkBundle } from './chunks/EditorDirtyChunkBundle';
import { EditorMapIoController } from './io/EditorMapIoController';
import {
  applySavedChunkBundle,
  deleteSavedChunkBundle,
  deleteSavedMap,
  loadEditorWorkingDraft,
  listSavedChunkBundlesFromProjectLibrary,
  listSavedMapsFromProjectLibrary,
  loadSavedMap,
  saveEditorWorkingDraft,
  saveDirtyChunkBundleToProjectLibrary,
  saveMapToProjectLibrary,
  type SavedDirtyChunkBundleRecord,
  type SavedEditorMapRecord,
} from './io/EditorLocalLibrary';
import { EditorInputController, type EditorToolMode } from './input/EditorInputController';
import { EditorViewportController } from './viewport/EditorViewportController';
import { EditorChunkNameRenderer } from './chunks/EditorChunkNameRenderer';
import { EditorTilePaletteController } from './ui/EditorTilePaletteController';
import { EditorHistoryStack } from './EditorHistoryStack';

const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;
const MAP_ORIGIN_X = 760;
const MAP_ORIGIN_Y = 80;
const CAMERA_PAN_SPEED = 620;
const MIN_CAMERA_ZOOM = 0.45;
const MAX_CAMERA_ZOOM = 2.2;
const ZOOM_STEP = 0.12;

type LoadedChunkWindowContext = {
  chunkSize: number;
  loadedChunks: Set<string>;
  occupiedChunks: Set<string>;
  originChunkX: number;
  originChunkY: number;
  regionId: string;
  sourceDisplayName: string;
  sourceMapId: string;
  sourceRecordId: string;
  worldId: string;
};

type PreparedDefinitionImage = {
  dataUrl: string;
  height: number;
  width: number;
};

type DefinitionFitDraft = {
  offsetX: number;
  offsetY: number;
  scale: number;
};

type DefinitionFitProjection = {
  anchorX: number;
  anchorY: number;
  imageHeight: number;
  imageWidth: number;
  imageX: number;
  imageY: number;
  zoom: number;
};

export class EditorScene extends Phaser.Scene {
  private readonly terrainTool = new EditorTerrainToolController();
  private readonly objectTool = new EditorObjectToolController();
  private readonly dirtyChunks = new EditorDirtyChunkTracker(EDITOR_CHUNK_SIZE);
  private readonly mapIo = new EditorMapIoController();
  private readonly history = new EditorHistoryStack();
  private map: EditorMapDefinition = createSampleEditorMap(this.terrainTool.getSelectedPaint());
  private worldId = 'the_wake';
  private regionId = 'editor_region';
  private readonly transform: IsoTransformConfig = {
    originX: MAP_ORIGIN_X,
    originY: MAP_ORIGIN_Y,
    tileWidth: TILE_WIDTH,
    tileHeight: TILE_HEIGHT,
  };

  private hoverTile: { x: number; y: number } | null = null;
  private overlayGraphics?: Phaser.GameObjects.Graphics;
  private chunkOverlayGraphics?: Phaser.GameObjects.Graphics;
  private hud?: EditorHudController;
  private uiCamera?: Phaser.Cameras.Scene2D.Camera;
  private terrainRenderer?: EditorTerrainChunkRenderer;
  private objectRenderer?: EditorObjectLayerRenderer;
  private chunkNameRenderer?: EditorChunkNameRenderer;
  private palette?: EditorTilePaletteController;
  private viewport?: EditorViewportController;
  private definitionPanelSubmit: (() => void | Promise<void>) | null = null;
  private pendingChunkRename: { chunkX: number; chunkY: number } | null = null;
  private toolMode: EditorToolMode = 'terrain';
  private selectedWalkable = true;
  private selectedElevation = 0;
  private loadedChunkWindow: LoadedChunkWindowContext | null = null;

  preload(): void {
    preloadTerrainAssets(this);
    preloadObjectAssets(this);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#07111f');
    this.input.mouse?.disableContextMenu();
    createTerrainRenderTextures(this);

    this.terrainRenderer = new EditorTerrainChunkRenderer(this, this.transform, this.terrainTool.getCatalog());
    this.objectRenderer = new EditorObjectLayerRenderer(this, this.transform, this.objectTool.getCatalog());
    this.chunkNameRenderer = new EditorChunkNameRenderer(this, this.transform);
    this.overlayGraphics = this.add.graphics();
    this.chunkOverlayGraphics = this.add.graphics();
    const restoredWorkingDraft = this.restoreWorkingDraft();
    this.hud = new EditorHudController(this, {
      onAdjustBrushSize: (delta) => this.adjustBrushSize(delta),
      onAdjustElevation: (delta) => this.adjustElevation(delta),
      onClearGameMap: () => this.clearPublishedGameMap(),
      onCreateCustomObject: () => this.createCustomObjectDefinition(),
      onCreateCustomTile: () => this.createCustomTerrainBrush(),
      onDeleteAllInstances: () => this.deleteAllInstancesOfSelectedObject(),
      onDeleteCustomObject: () => this.deleteSelectedCustomObjectDefinition(),
      onDeleteCustomTile: () => this.deleteSelectedCustomTerrainBrush(),
      onExportDirtyChunks: () => this.saveDirtyChunksToLibrary(),
      onExportMap: () => { void this.exportMap(); },
      onExportWorldChunk: () => { void this.exportWorldChunk(); },
      onImportDirtyChunks: () => this.openChunkLibrary(),
      onImportMap: () => this.openMapLibrary(),
      onOpenChunkWindow: () => this.openChunkWindowPanel(),
      onOpenPalette: () => this.togglePalette(),
      onOpenMap: () => this.openMapLibrary(),
      onRedo: () => this.applyRedo(),
      onRenameMap: (displayName) => this.renameMap(displayName),
      onSaveMap: () => this.saveMapToLibrary(),
      onSetWalkabilityBrush: (walkable) => this.setWalkabilityBrush(walkable),
      onSetMode: (mode) => this.setToolMode(mode as EditorToolMode),
      onTestInGame: () => this.testMapInGame(),
      onResizeMap: () => this.openResizePanel(),
      onUndo: () => this.applyUndo(),
    });
    this.hud.create(this.terrainTool.getSelectedBrush());
    this.palette = new EditorTilePaletteController(
      this,
      this.terrainTool.getCatalog(),
      this.objectTool.getCatalog(),
      {
        onSelectBrush: (brush) => this.selectBrushById(brush.id),
        onSelectObject: (def) => this.selectObjectById(def.id),
      },
    );
    this.viewport = new EditorViewportController(this, {
      maxZoom: MAX_CAMERA_ZOOM,
      minZoom: MIN_CAMERA_ZOOM,
      panSpeed: CAMERA_PAN_SPEED,
      transform: this.transform,
      zoomStep: ZOOM_STEP,
      onZoomChanged: () => this.updateInfoText(),
    });

    this.createUiCamera();
    this.registerInputController();
    document.getElementById('ed-library-close')?.addEventListener('click', () => this.hideLibraryPanel());
    document.getElementById('ed-definition-close')?.addEventListener('click', () => this.hideDefinitionPanel());
    document.getElementById('ed-definition-cancel')?.addEventListener('click', () => this.hideDefinitionPanel());
    document.getElementById('ed-definition-create')?.addEventListener('click', () => { void this.definitionPanelSubmit?.(); });
    document.getElementById('ed-chunk-window-close')?.addEventListener('click', () => this.hideChunkWindowPanel());
    document.getElementById('ed-chunk-window-cancel')?.addEventListener('click', () => this.hideChunkWindowPanel());
    document.getElementById('ed-chunk-window-load')?.addEventListener('click', () => this.loadChunkWindowFromPanel());
    document.getElementById('ed-resize-close')?.addEventListener('click', () => this.hideResizePanel());
    document.getElementById('ed-resize-cancel')?.addEventListener('click', () => this.hideResizePanel());
    document.getElementById('ed-resize-apply')?.addEventListener('click', () => this.applyResizeFromPanel());
    document.getElementById('ed-chunk-name-close')?.addEventListener('click', () => this.hideChunkNamePanel());
    document.getElementById('ed-chunk-name-cancel')?.addEventListener('click', () => this.hideChunkNamePanel());
    document.getElementById('ed-chunk-name-apply')?.addEventListener('click', () => this.applyChunkNameFromPanel());
    this.redrawTerrain();
    this.redrawObjects();
    this.centerCameraOnMap();
    this.updateInfoText();
    if (restoredWorkingDraft) {
      this.setStatus(`Restored ${this.map.displayName} from editor draft.`);
    }
  }

  update(_time: number, deltaMs: number): void {
    this.viewport?.update(deltaMs);
  }

  private createUiCamera(): void {
    this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height)
      .setScroll(0, 0)
      .setZoom(1);
    this.ignoreWorldObjectsForUiCamera();
    this.terrainRenderer?.setUiCamera(this.uiCamera);
    this.objectRenderer?.setUiCamera(this.uiCamera);
    this.chunkNameRenderer?.setUiCamera(this.uiCamera);

    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.uiCamera?.setSize(gameSize.width, gameSize.height);
    });
  }

  private registerInputController(): void {
    const inputController = new EditorInputController(this, {
      applyPrimaryAction: (pointer) => this.applyHoveredPrimaryAction(pointer),
      adjustBrushSize: (delta) => this.adjustBrushSize(delta),
      beginStroke: () => this.history.beginStroke(this.map),
      centerCameraOnMap: () => this.centerCameraOnMap(),
      cycleSelection: (offset) => this.cycleSelection(offset),
      endStroke: () => this.history.endStroke(),
      exportDirtyChunks: () => this.saveDirtyChunksToLibrary(),
      exportMap: () => { void this.exportMap(); },
      exportWorldChunk: () => { void this.exportWorldChunk(); },
      flipSelectedBrush: (axis) => this.flipSelectedBrush(axis),
      getToolMode: () => this.toolMode,
      importDirtyChunks: () => this.openChunkLibrary(),
      importMap: () => this.openMapLibrary(),
      isPaletteOpen: () => this.palette?.isVisible() ?? false,
      isPointerPanning: () => this.viewport?.isPanning() ?? false,
      openMapFromFile: () => this.openMapLibrary(),
      redo: () => this.applyRedo(),
      redrawPointerState: () => this.redrawPointerState(),
      removeHoveredObject: () => this.removeHoveredObject(),
      renameHoveredChunk: () => this.renameHoveredChunk(),
      resetTerrainStroke: () => this.terrainTool.resetStroke(),
      resizeMap: () => this.openResizePanel(),
      saveMapToFile: () => this.saveMapToLibrary(),
      selectBrushForFamily: (family) => this.selectBrushForFamily(family),
      setToolMode: (mode) => this.setToolMode(mode),
      startPointerPan: (pointer) => this.viewport?.startPointerPan(pointer),
      stopPointerPan: () => this.viewport?.stopPointerPan(),
      togglePalette: () => this.togglePalette(),
      undo: () => this.applyUndo(),
      updateHoverFromPointer: (pointer) => {
        this.hoverTile = this.getTileFromPointer(pointer);
      },
      updatePointerPan: (pointer) => this.viewport?.updatePointerPan(pointer),
      zoom: (direction) => this.viewport?.adjustZoom(direction),
    });
    inputController.register();
  }

  private redrawPointerState(): void {
    this.redrawOverlay();
    this.updateInfoText();
  }

  private setToolMode(mode: EditorToolMode): void {
    this.toolMode = mode;
    this.updateInfoText();
    this.setStatus(formatToolModeStatus(mode));
  }

  private selectBrushForFamily(family: TerrainFamily): void {
    const selectedBrush = this.terrainTool.selectFamily(family);
    this.palette?.updateTerrainSelection(selectedBrush);
    this.updateInfoText();
    this.setStatus(`Selected ${selectedBrush.label}. Use Q/E or [/] to choose a specific tile.`);
  }

  private selectBrushById(brushId: string): void {
    const selectedBrush = this.terrainTool.selectById(brushId);
    this.palette?.updateTerrainSelection(selectedBrush);
    this.updateInfoText();
    this.setStatus(`Selected tile ${selectedBrush.label}.`);
  }

  private selectObjectById(definitionId: string): void {
    const def = this.objectTool.selectById(definitionId);
    this.palette?.updateObjectSelection(def.id);
    this.updateInfoText();
    this.setStatus(`Selected object ${def.displayName}.`);
  }

  private createCustomTerrainBrush(): void {
    const base = this.terrainTool.getSelectedBrush();
    this.showDefinitionPanel({
      flagChecked: base.walkable,
      flagLabel: 'Walkable tile',
      idValue: `custom_${base.id}`,
      nameValue: base.label,
      categoryValue: base.category ?? base.family,
      previewColor: null,
      previewSrc: this.getTexturePreviewDataUrl(base.textureKey),
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
        this.map = {
          ...this.map,
          customTerrainBrushes: upsertById(this.map.customTerrainBrushes, paint),
        };
        this.palette?.updateTerrainSelection(brush);
        this.updateInfoText();
        this.persistWorkingDraft();
        this.hideDefinitionPanel();
        this.setStatus(`Added custom tile ${brush.label} (${flag ? 'walkable' : 'blocked'}).`);
      },
    });
  }

  private createCustomObjectDefinition(): void {
    const base = this.objectTool.getSelectedDefinition();
    this.showDefinitionPanel({
      flagChecked: base.blocksMovement,
      flagLabel: 'Blocks movement',
      idValue: `custom_${base.id}`,
      nameValue: base.displayName,
      categoryValue: base.category,
      footprintHeight: getFootprintHeight(base.collisionFootprint),
      footprintWidth: getFootprintWidth(base.collisionFootprint),
      previewColor: this.objectTool.getPreviewColor(),
      previewSrc: this.getTexturePreviewDataUrl(this.objectTool.getPreviewTextureKey()),
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
        this.map = {
          ...this.map,
          customObjectDefinitions: upsertById(this.map.customObjectDefinitions, definition),
        };
        this.palette?.updateObjectSelection(definition.id);
        this.updateInfoText();
        this.persistWorkingDraft();
        this.hideDefinitionPanel();
        this.setStatus(`Added custom object ${definition.displayName} (${flag ? 'blocking' : 'walkable'}).`);
      },
    });
  }

  private deleteSelectedCustomTerrainBrush(): void {
    const brush = this.terrainTool.getSelectedBrush();

    if (brush.source !== 'custom') {
      this.setStatus('Only custom tiles can be deleted.');
      return;
    }

    const usedCount = Object.values(this.map.terrainTiles).filter((p) => p.id === brush.id).length;
    if (!window.confirm(`Delete custom tile "${brush.label}"?\nThis will replace ${usedCount} painted tile(s) across the map.`)) {
      return;
    }

    this.history.snapshot(this.map);
    const replacementBrush = this.terrainTool.selectFamily(brush.family);
    const replacementPaint = this.terrainTool.getSelectedPaint();
    let replacedTiles = 0;

    for (const [key, paint] of Object.entries(this.map.terrainTiles)) {
      if (paint.id !== brush.id) {
        continue;
      }

      const [tileX, tileY] = parseTileKey(key);
      this.map.terrain[tileY][tileX] = replacementPaint.family;
      this.map.terrainTiles[key] = { ...replacementPaint };
      this.map.terrainWalkability[key] = replacementPaint.walkable;
      replacedTiles += 1;
    }

    const deleted = this.terrainTool.deleteCustomBrush(brush.id);

    if (!deleted) {
      this.setStatus('Custom tile could not be deleted.');
      return;
    }

    this.map = {
      ...this.map,
      customTerrainBrushes: this.map.customTerrainBrushes.filter((paint) => paint.id !== brush.id),
    };
    this.dirtyChunks.markAllChunksDirty(this.map.width, this.map.height);
    this.palette?.updateTerrainSelection(replacementBrush);
    this.redrawTerrain();
    this.redrawOverlay();
    this.updateInfoText();
    this.persistWorkingDraft();
    this.setStatus(`Deleted custom tile ${brush.label}. Replaced ${replacedTiles} painted tile(s).`);
  }

  private deleteSelectedCustomObjectDefinition(): void {
    const definition = this.objectTool.getSelectedDefinition();

    if (!definition.id.startsWith('custom_')) {
      this.setStatus('Only custom objects can be deleted.');
      return;
    }

    const removedObjects = this.map.objects.filter((object) => object.definitionId === definition.id).length;
    if (!window.confirm(`Delete custom object "${definition.displayName}"?\nThis will remove ${removedObjects} placed instance(s) from the map.`)) {
      return;
    }

    this.history.snapshot(this.map);
    const deleted = this.objectTool.deleteCustomDefinition(definition.id);

    if (!deleted) {
      this.setStatus('Custom object could not be deleted.');
      return;
    }

    const selected = this.objectTool.getSelectedDefinition();
    this.map = {
      ...this.map,
      customObjectDefinitions: this.map.customObjectDefinitions.filter((candidate) => candidate.id !== definition.id),
      objects: this.map.objects.filter((object) => object.definitionId !== definition.id),
    };
    this.dirtyChunks.markAllChunksDirty(this.map.width, this.map.height);
    this.palette?.updateObjectSelection(selected.id);
    this.redrawObjects();
    this.updateInfoText();
    this.persistWorkingDraft();
    this.setStatus(`Deleted custom object ${definition.displayName}. Removed ${removedObjects} placed instance(s).`);
  }

  private deleteAllInstancesOfSelectedObject(): void {
    const definition = this.objectTool.getSelectedDefinition();
    const count = this.map.objects.filter((o) => o.definitionId === definition.id).length;

    if (count === 0) {
      this.setStatus(`No placed instances of "${definition.displayName}" on the map.`);
      return;
    }

    if (!window.confirm(`Delete all ${count} placed instance(s) of "${definition.displayName}" from the map?`)) {
      return;
    }

    this.history.snapshot(this.map);
    this.map = { ...this.map, objects: this.map.objects.filter((o) => o.definitionId !== definition.id) };
    this.dirtyChunks.markAllChunksDirty(this.map.width, this.map.height);
    this.redrawObjects();
    this.updateInfoText();
    this.persistWorkingDraft();
    this.setStatus(`Removed all ${count} instance(s) of "${definition.displayName}".`);
  }

  private cycleSelection(offset: number): void {
    if (this.toolMode === 'object') {
      const def = this.objectTool.cycle(offset);
      this.palette?.updateObjectSelection(def.id);
      this.updateInfoText();
      this.setStatus(`Selected object ${def.displayName}.`);
      return;
    }

    this.cycleSelectedBrush(offset);
  }

  private cycleSelectedBrush(offset: number): void {
    const selectedBrush = this.terrainTool.cycle(offset);
    this.palette?.updateTerrainSelection(selectedBrush);
    this.updateInfoText();
    this.setStatus(`Selected tile ${selectedBrush.label}.`);
  }

  private flipSelectedBrush(axis: 'x' | 'y'): void {
    const selectedBrush = this.terrainTool.flip(axis);
    this.palette?.updateTerrainSelection(selectedBrush);
    this.updateInfoText();
    this.setStatus(axis === 'x' ? 'Selected brush flipped left/right.' : 'Selected brush flipped up/down.');
  }

  private togglePalette(): void {
    this.palette?.toggle(
      this.toolMode === 'object' ? 'object' : 'terrain',
      this.terrainTool.getSelectedBrush(),
      this.objectTool.getSelectedDefinition().id,
    );
  }

  private adjustBrushSize(delta: number): void {
    this.terrainTool.setBrushSize(this.terrainTool.getBrushSize() + delta);
    this.redrawOverlay();
    this.updateInfoText();
    this.setStatus(`Brush size ${this.terrainTool.getBrushSize()}.`);
  }

  private applyHoveredPrimaryAction(pointer: Phaser.Input.Pointer): void {
    if (this.toolMode === 'object') {
      if (this.objectTool.shouldDeleteWithPointer(pointer)) {
        this.removeHoveredObject();
        return;
      }

      this.placeHoveredObject();
      return;
    }

    if (this.toolMode === 'walkability') {
      this.paintHoveredWalkability();
      return;
    }

    if (this.toolMode === 'elevation') {
      this.paintHoveredElevation();
      return;
    }

    this.paintHoveredTile();
  }

  private paintHoveredTile(): void {
    if (!this.hoverTile) {
      return;
    }

    this.paintTile(this.hoverTile.x, this.hoverTile.y);
  }

  private paintTile(tileX: number, tileY: number): void {
    const paintedTiles = this.terrainTool.paintTile(this.map, tileX, tileY);

    if (paintedTiles.length === 0) {
      return;
    }

    for (const tile of paintedTiles) {
      this.terrainRenderer?.renderChunksAroundTile(this.map, tile.x, tile.y);
      this.dirtyChunks.markTileDirty(tile.x, tile.y);
    }

    this.redrawObjects();
    this.redrawOverlay();
    this.updateInfoText();
    this.persistWorkingDraft();
  }

  private paintHoveredWalkability(): void {
    if (!this.hoverTile) {
      return;
    }

    const paintedTiles = this.terrainTool.getBrushFootprint(this.hoverTile.x, this.hoverTile.y)
      .filter((tile) => paintTerrainWalkability(this.map, tile.x, tile.y, this.selectedWalkable));

    this.markPaintedTilesDirty(paintedTiles);
  }

  private paintHoveredElevation(): void {
    if (!this.hoverTile) {
      return;
    }

    const paintedTiles = this.terrainTool.getBrushFootprint(this.hoverTile.x, this.hoverTile.y)
      .filter((tile) => paintTerrainElevation(this.map, tile.x, tile.y, this.selectedElevation));

    this.markPaintedTilesDirty(paintedTiles);
  }

  private markPaintedTilesDirty(tiles: Array<{ x: number; y: number }>): void {
    if (tiles.length === 0) {
      return;
    }

    for (const tile of tiles) {
      this.terrainRenderer?.renderChunksAroundTile(this.map, tile.x, tile.y);
      this.dirtyChunks.markTileDirty(tile.x, tile.y);
    }

    this.redrawOverlay();
    this.updateInfoText();
    this.persistWorkingDraft();
  }

  private placeHoveredObject(): void {
    if (!this.hoverTile) {
      return;
    }

    this.history.snapshot(this.map);
    this.map = this.objectTool.placeObject(this.map, this.hoverTile.x, this.hoverTile.y);
    this.dirtyChunks.markTileDirty(this.hoverTile.x, this.hoverTile.y);
    this.redrawObjects();
    this.updateInfoText();
    this.persistWorkingDraft();
  }

  private removeHoveredObject(): void {
    if (!this.hoverTile) {
      return;
    }

    this.history.snapshot(this.map);
    const result = this.objectTool.removeObject(this.map, this.hoverTile.x, this.hoverTile.y);
    this.map = result.map;

    if (result.removed) {
      this.dirtyChunks.markTileDirty(this.hoverTile.x, this.hoverTile.y);
    }

    this.redrawObjects();
    this.updateInfoText();
    this.persistWorkingDraft();
    this.setStatus(
      result.removed
        ? 'Removed object at hovered tile.'
        : 'No object at hovered tile.',
    );
  }

  private redrawTerrain(): void {
    this.terrainRenderer?.renderAll(this.map);
    this.chunkNameRenderer?.setMapContext(this.map);
    this.redrawChunkOverlay();
  }

  private redrawObjects(): void {
    this.objectRenderer?.renderAll(this.map);
  }

  private redrawChunkOverlay(): void {
    if (!this.chunkOverlayGraphics) {
      return;
    }

    this.terrainRenderer?.drawChunkOverlay(this.map, this.chunkOverlayGraphics);
  }

  private redrawOverlay(): void {
    const graphics = this.overlayGraphics;

    if (!graphics) {
      return;
    }

    graphics.clear();
    graphics.setDepth(9_000);
    this.drawTileDataOverlay(graphics);

    if (!this.hoverTile || !this.isTileInBounds(this.hoverTile.x, this.hoverTile.y)) {
      return;
    }

    const footprint = this.toolMode === 'terrain'
      ? this.terrainTool.getBrushFootprint(this.hoverTile.x, this.hoverTile.y)
      : [this.hoverTile];

    for (const tile of footprint) {
      if (!this.isTileInBounds(tile.x, tile.y)) {
        continue;
      }

      const isCenter = tile.x === this.hoverTile.x && tile.y === this.hoverTile.y;
      const points = getTileDiamondPoints(this.transform, tile.x, tile.y)
        .map((point) => new Phaser.Geom.Point(point.x, point.y));

      graphics.fillStyle(0xfacc15, isCenter ? 0.22 : 0.12);
      graphics.fillPoints(points, true);
      graphics.lineStyle(isCenter ? 2 : 1, 0xf8fafc, isCenter ? 0.95 : 0.45);
      graphics.strokePoints(points, true);
    }
  }

  private drawTileDataOverlay(graphics: Phaser.GameObjects.Graphics): void {
    if (this.toolMode !== 'walkability' && this.toolMode !== 'elevation') {
      return;
    }

    for (let tileY = 0; tileY < this.map.height; tileY += 1) {
      for (let tileX = 0; tileX < this.map.width; tileX += 1) {
        const points = getTileDiamondPoints(this.transform, tileX, tileY)
          .map((point) => new Phaser.Geom.Point(point.x, point.y));

        if (this.toolMode === 'walkability') {
          const walkable = getEditorTerrainWalkabilityAt(this.map, tileX, tileY) ?? true;
          graphics.fillStyle(walkable ? 0x22c55e : 0xef4444, walkable ? 0.08 : 0.28);
          graphics.fillPoints(points, true);
          continue;
        }

        const elevation = getEditorTerrainElevationAt(this.map, tileX, tileY) ?? 0;

        if (elevation <= 0) {
          continue;
        }

        graphics.fillStyle(0x60a5fa, Math.min(0.42, 0.1 + elevation * 0.055));
        graphics.fillPoints(points, true);
      }
    }
  }

  private getTileFromPointer(pointer: Phaser.Input.Pointer): { x: number; y: number } | null {
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const tile = worldToTile(this.transform, worldPoint.x, worldPoint.y);

    if (!this.isTileInBounds(tile.x, tile.y)) {
      return null;
    }

    return tile;
  }

  private updateInfoText(): void {
    if (!this.hud) {
      return;
    }

    const hover = this.hoverTile && this.isTileInBounds(this.hoverTile.x, this.hoverTile.y)
      ? this.hoverTile
      : null;
    const hoverFamily = hover ? getEditorTerrainAt(this.map, hover.x, hover.y) : null;
    const hoverPaint = hover ? this.terrainRenderer?.getTilePaint(this.map, hover.x, hover.y) ?? null : null;
    const hoverWalkable = hover ? getEditorTerrainWalkabilityAt(this.map, hover.x, hover.y) : null;
    const hoverElevation = hover ? getEditorTerrainElevationAt(this.map, hover.x, hover.y) : null;
    const hoverObject = hover ? this.objectRenderer?.getObjectAtTile(this.map, hover.x, hover.y) ?? null : null;
    const hoverChunk = hover ? this.getChunkInfo(hover.x, hover.y) : null;
    const selectedBrush = this.terrainTool.getSelectedBrush();
    const selectedObjectDefinition = this.objectTool.getSelectedDefinition();

    this.hud.update({
      brushSize: this.terrainTool.getBrushSize(),
      hover: {
        chunkName: hoverChunk?.chunkName ?? null,
        chunkX: hoverChunk?.chunkX ?? null,
        chunkY: hoverChunk?.chunkY ?? null,
        elevation: hoverElevation,
        family: hoverFamily,
        objectDefinitionId: hoverObject?.definitionId ?? null,
        paint: hoverPaint,
        tile: hover,
        walkable: hoverWalkable,
      },
      dirtyChunks: this.dirtyChunks.getSummary(),
      map: this.map,
      objectPreviewColor: this.objectTool.getPreviewColor(),
      objectPreviewTextureKey: this.objectTool.getPreviewTextureKey(),
      selectedBrush,
      selectedBrushIndexLabel: this.terrainTool.getSelectedBrushIndexLabel(),
      selectedElevation: this.selectedElevation,
      selectedWalkable: this.selectedWalkable,
      selectedObjectDisplayName: selectedObjectDefinition.displayName,
      toolMode: this.toolMode,
    });
  }

  private setWalkabilityBrush(walkable: boolean): void {
    this.selectedWalkable = walkable;
    this.updateInfoText();
    this.setStatus(walkable ? 'Painting walkable tiles.' : 'Painting blocked tiles.');
  }

  private adjustElevation(delta: number): void {
    this.selectedElevation = Math.max(0, Math.min(9, this.selectedElevation + delta));
    this.updateInfoText();
    this.setStatus(`Painting height ${this.selectedElevation}.`);
  }

  private renameMap(displayName: string): void {
    const trimmed = displayName.trim();

    if (!trimmed || trimmed === this.map.displayName) {
      this.updateInfoText();
      return;
    }

    this.map = {
      ...this.map,
      displayName: trimmed,
      id: slugifyMapId(trimmed),
    };
    this.updateInfoText();
    this.persistWorkingDraft();
    this.setStatus(`Map renamed to ${trimmed}.`);
  }

  private async exportMap(): Promise<void> {
    const result = await this.mapIo.exportMap(this.map);
    this.dirtyChunks.clear();
    this.updateInfoText();
    this.setStatus(
      result === 'clipboard'
        ? 'MapDefinition export copied to clipboard.'
        : 'MapDefinition export printed to console.',
    );
  }

  private async exportWorldChunk(): Promise<void> {
    const result = await this.mapIo.exportWorldChunk(this.map, {
      worldId: this.worldId,
      regionId: this.regionId,
      chunkX: 0,
      chunkY: 0,
    });
    this.dirtyChunks.clear();
    this.updateInfoText();
    this.setStatus(
      result === 'clipboard'
        ? 'WorldChunkDefinition export copied to clipboard.'
        : 'WorldChunkDefinition export printed to console.',
    );
  }

  private restoreWorkingDraft(): boolean {
    const draft = loadEditorWorkingDraft();

    if (!draft) {
      return false;
    }

    this.map = draft;
    this.loadedChunkWindow = null;
    this.history.clear();
    this.applyMapCustomDefinitions();
    return true;
  }

  private persistWorkingDraft(): void {
    try {
      saveEditorWorkingDraft(this.map);
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : 'Editor draft save failed.');
    }
  }

  private async saveDirtyChunksToLibrary(): Promise<void> {
    try {
      const dirtyChunks = this.dirtyChunks.getDirtyChunks();

      if (dirtyChunks.length === 0) {
        this.setStatus('No dirty chunks to save.');
        return;
      }

      const bundle = createDirtyChunkBundle(this.map, dirtyChunks, {
        chunkSize: EDITOR_CHUNK_SIZE,
        originChunkX: this.loadedChunkWindow?.originChunkX ?? 0,
        originChunkY: this.loadedChunkWindow?.originChunkY ?? 0,
        regionId: this.loadedChunkWindow?.regionId ?? this.regionId,
        sourceMapId: this.loadedChunkWindow?.sourceMapId,
        worldId: this.loadedChunkWindow?.worldId ?? this.worldId,
      });
      const record = await saveDirtyChunkBundleToProjectLibrary(bundle);
      this.dirtyChunks.clear();
      this.updateInfoText();
      this.setStatus(`Saved ${record.chunkCount} dirty chunk(s) to project chunk library.`);
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : 'Dirty chunk save failed.');
    }
  }

  private async saveMapToLibrary(): Promise<void> {
    try {
      const record = await saveMapToProjectLibrary(this.map);
      this.dirtyChunks.clear();
      this.updateInfoText();
      this.setStatus(`Saved ${record.displayName} to project map library.`);
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : 'Map save failed.');
    }
  }

  private async openMapLibrary(): Promise<void> {
    this.showLibraryPanel({
      emptyMessage: 'No saved maps yet.',
      records: await listSavedMapsFromProjectLibrary(),
      title: 'Open Map',
      type: 'map',
    });
  }

  private async openChunkLibrary(): Promise<void> {
    this.showLibraryPanel({
      emptyMessage: 'No saved chunk bundles yet.',
      records: await listSavedChunkBundlesFromProjectLibrary(),
      title: 'Apply Chunks',
      type: 'chunks',
    });
  }

  private loadMapFromLibrary(recordId: string): void {
    try {
      this.map = loadSavedMap(recordId);
      this.loadedChunkWindow = null;
      this.history.clear();
      this.applyMapCustomDefinitions();
      this.dirtyChunks.clear();
      this.persistWorkingDraft();
      this.centerCameraOnMap();
      this.redrawTerrain();
      this.redrawObjects();
      this.redrawOverlay();
      this.updateInfoText();
      this.hideLibraryPanel();
      this.setStatus('Map loaded from editor library.');
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : 'Map library load failed.');
    }
  }

  private loadChunksFromLibrary(recordId: string): void {
    try {
      this.history.snapshot(this.map);
      this.map = applySavedChunkBundle(
        this.map,
        recordId,
        this.loadedChunkWindow?.originChunkX ?? 0,
        this.loadedChunkWindow?.originChunkY ?? 0,
      );
      this.dirtyChunks.clear();
      this.persistWorkingDraft();
      this.redrawTerrain();
      this.redrawObjects();
      this.redrawOverlay();
      this.updateInfoText();
      this.hideLibraryPanel();
      this.setStatus('Chunk bundle loaded from editor library.');
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : 'Chunk library load failed.');
    }
  }

  private async openChunkWindowPanel(): Promise<void> {
    const panel = document.getElementById('ed-chunk-window');
    const select = document.getElementById('ed-chunk-window-map') as HTMLSelectElement | null;
    const chunkX = document.getElementById('ed-chunk-window-x') as HTMLInputElement | null;
    const chunkY = document.getElementById('ed-chunk-window-y') as HTMLInputElement | null;
    const radius = document.getElementById('ed-chunk-window-radius') as HTMLInputElement | null;
    const worldIdInput = document.getElementById('ed-chunk-window-world-id') as HTMLInputElement | null;
    const regionIdInput = document.getElementById('ed-chunk-window-region-id') as HTMLInputElement | null;

    if (!panel || !select || !chunkX || !chunkY || !radius) {
      return;
    }

    const maps = await listSavedMapsFromProjectLibrary();

    if (maps.length === 0) {
      this.setStatus('Save a map before loading chunk windows.');
      return;
    }

    select.innerHTML = '';

    for (const map of maps) {
      const option = document.createElement('option');
      option.value = map.id;
      option.textContent = `${map.displayName} (${map.width}x${map.height})`;
      select.appendChild(option);
    }

    chunkX.value = String(this.loadedChunkWindow?.originChunkX ?? 0);
    chunkY.value = String(this.loadedChunkWindow?.originChunkY ?? 0);
    radius.value = '0';
    if (worldIdInput) worldIdInput.value = this.worldId;
    if (regionIdInput) regionIdInput.value = this.regionId;
    panel.style.display = 'flex';
  }

  private hideChunkWindowPanel(): void {
    const panel = document.getElementById('ed-chunk-window');

    if (panel) {
      panel.style.display = 'none';
    }
  }

  private loadChunkWindowFromPanel(): void {
    try {
      const select = document.getElementById('ed-chunk-window-map') as HTMLSelectElement | null;
      const chunkXInput = document.getElementById('ed-chunk-window-x') as HTMLInputElement | null;
      const chunkYInput = document.getElementById('ed-chunk-window-y') as HTMLInputElement | null;
      const radiusInput = document.getElementById('ed-chunk-window-radius') as HTMLInputElement | null;
      const worldIdInput = document.getElementById('ed-chunk-window-world-id') as HTMLInputElement | null;
      const regionIdInput = document.getElementById('ed-chunk-window-region-id') as HTMLInputElement | null;

      if (!select || !chunkXInput || !chunkYInput || !radiusInput) {
        return;
      }

      const recordId = select.value;
      const centerChunkX = parseIntegerInput(chunkXInput.value, 0);
      const centerChunkY = parseIntegerInput(chunkYInput.value, 0);
      const radius = Math.max(0, parseIntegerInput(radiusInput.value, 0));
      this.worldId = worldIdInput?.value.trim() || this.worldId;
      this.regionId = regionIdInput?.value.trim() || this.regionId;
      const sourceMap = loadSavedMap(recordId);
      const { context, map } = this.createChunkWindowMap(sourceMap, recordId, centerChunkX, centerChunkY, radius);

      this.map = map;
      this.loadedChunkWindow = context;
      this.applyMapCustomDefinitions();
      this.dirtyChunks.clear();
      this.hoverTile = null;
      this.persistWorkingDraft();
      this.centerCameraOnMap();
      this.redrawTerrain();
      this.redrawObjects();
      this.redrawOverlay();
      this.updateInfoText();
      this.hideChunkWindowPanel();
      const endChunkX = context.originChunkX + Math.ceil(map.width  / context.chunkSize) - 1;
      const endChunkY = context.originChunkY + Math.ceil(map.height / context.chunkSize) - 1;
      this.setStatus(
        `Loaded "${context.sourceDisplayName}" — ` +
        `chunks ${context.originChunkX},${context.originChunkY}–${endChunkX},${endChunkY} | ` +
        `tiles 0,0–${map.width - 1},${map.height - 1}.`,
      );
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : 'Chunk window load failed.');
    }
  }

  private openResizePanel(): void {
    const panel = document.getElementById('ed-resize');
    const widthInput = document.getElementById('ed-resize-width') as HTMLInputElement | null;
    const heightInput = document.getElementById('ed-resize-height') as HTMLInputElement | null;

    if (!panel || !widthInput || !heightInput) {
      return;
    }

    widthInput.value = String(Math.ceil(this.map.width / EDITOR_CHUNK_SIZE));
    heightInput.value = String(Math.ceil(this.map.height / EDITOR_CHUNK_SIZE));
    panel.style.display = 'flex';
    widthInput.focus();
    widthInput.select();
  }

  private hideResizePanel(): void {
    const panel = document.getElementById('ed-resize');

    if (panel) {
      panel.style.display = 'none';
    }
  }

  private applyResizeFromPanel(): void {
    try {
      const widthInput = document.getElementById('ed-resize-width') as HTMLInputElement | null;
      const heightInput = document.getElementById('ed-resize-height') as HTMLInputElement | null;

      if (!widthInput || !heightInput) {
        return;
      }

      const widthChunks = parseIntegerInput(widthInput.value, Math.ceil(this.map.width / EDITOR_CHUNK_SIZE));
      const heightChunks = parseIntegerInput(heightInput.value, Math.ceil(this.map.height / EDITOR_CHUNK_SIZE));
      const width = widthChunks * EDITOR_CHUNK_SIZE;
      const height = heightChunks * EDITOR_CHUNK_SIZE;
      const guardrailError = this.getResizeGuardrailError(width, height);

      if (guardrailError) {
        this.setStatus(guardrailError);
        return;
      }

      this.history.snapshot(this.map);
      this.map = resizeEditorMap(this.map, width, height, this.terrainTool.getSelectedPaint());
      this.refreshLoadedChunkWindowAfterResize(width, height);
      this.hoverTile = null;
      this.dirtyChunks.markAllChunksDirty(this.map.width, this.map.height);
      this.redrawTerrain();
      this.redrawObjects();
      this.redrawOverlay();
      this.updateInfoText();
      this.persistWorkingDraft();
      this.hideResizePanel();
      this.setStatus(`Map resized to ${widthChunks}x${heightChunks} chunks (${this.map.width}x${this.map.height} tiles).`);
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : 'Resize failed.');
    }
  }

  private createChunkWindowMap(
    sourceMap: EditorMapDefinition,
    sourceRecordId: string,
    centerChunkX: number,
    centerChunkY: number,
    radius: number,
  ): { context: LoadedChunkWindowContext; map: EditorMapDefinition } {
    const maxChunkX = Math.max(0, Math.ceil(sourceMap.width / EDITOR_CHUNK_SIZE) - 1);
    const maxChunkY = Math.max(0, Math.ceil(sourceMap.height / EDITOR_CHUNK_SIZE) - 1);
    const startChunkX = clamp(centerChunkX - radius, 0, maxChunkX);
    const startChunkY = clamp(centerChunkY - radius, 0, maxChunkY);
    const endChunkX = clamp(centerChunkX + radius, 0, maxChunkX);
    const endChunkY = clamp(centerChunkY + radius, 0, maxChunkY);
    const startX = startChunkX * EDITOR_CHUNK_SIZE;
    const startY = startChunkY * EDITOR_CHUNK_SIZE;
    const width = Math.min(sourceMap.width - startX, (endChunkX - startChunkX + 1) * EDITOR_CHUNK_SIZE);
    const height = Math.min(sourceMap.height - startY, (endChunkY - startChunkY + 1) * EDITOR_CHUNK_SIZE);
    const fallbackPaint = Object.values(sourceMap.terrainTiles)[0] ?? this.terrainTool.getSelectedPaint();
    const map = createEditorMap(
      width,
      height,
      sourceMap.terrain[startY]?.[startX] ?? fallbackPaint.family,
      `${sourceMap.id}_window_${startChunkX}_${startChunkY}_${endChunkX}_${endChunkY}`,
      `${sourceMap.displayName} ${startChunkX},${startChunkY}-${endChunkX},${endChunkY}`,
      fallbackPaint,
    );

    map.terrain = Array.from({ length: height }, (_, localY) =>
      Array.from({ length: width }, (_, localX) => sourceMap.terrain[startY + localY][startX + localX]),
    );
    map.terrainTiles = copyTileRecordWindow(sourceMap.terrainTiles, startX, startY, width, height);
    map.terrainWalkability = copyTileRecordWindow(sourceMap.terrainWalkability, startX, startY, width, height);
    map.terrainElevation = copyTileRecordWindow(sourceMap.terrainElevation, startX, startY, width, height);
    map.customTerrainBrushes = [...sourceMap.customTerrainBrushes];
    map.customObjectDefinitions = [...sourceMap.customObjectDefinitions];
    map.chunkNames = copyChunkNamesWindow(sourceMap.chunkNames, startChunkX, startChunkY, endChunkX, endChunkY);
    map.objects = sourceMap.objects
      .filter((object) => isInsideRect(object.tileX, object.tileY, startX, startY, width, height))
      .map((object) => ({
        ...object,
        tileX: object.tileX - startX,
        tileY: object.tileY - startY,
      }));
    map.enemySpawns = sourceMap.enemySpawns
      .filter((spawn) => isInsideRect(spawn.tileX, spawn.tileY, startX, startY, width, height))
      .map((spawn) => ({
        ...spawn,
        tileX: spawn.tileX - startX,
        tileY: spawn.tileY - startY,
      }));

    const context: LoadedChunkWindowContext = {
      chunkSize: EDITOR_CHUNK_SIZE,
      loadedChunks: createChunkKeySet(startChunkX, startChunkY, endChunkX, endChunkY),
      occupiedChunks: createChunkKeySet(0, 0, maxChunkX, maxChunkY),
      originChunkX: startChunkX,
      originChunkY: startChunkY,
      regionId: this.regionId,
      sourceDisplayName: sourceMap.displayName,
      sourceMapId: sourceMap.id,
      sourceRecordId,
      worldId: this.worldId,
    };

    return { context, map };
  }

  private getResizeGuardrailError(width: number, height: number): string | null {
    if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
      return 'Width and height must be positive chunk counts.';
    }

    if (!this.loadedChunkWindow) {
      return null;
    }

    const nextChunks = createLocalWindowChunkKeys(
      this.loadedChunkWindow.originChunkX,
      this.loadedChunkWindow.originChunkY,
      width,
      height,
      this.loadedChunkWindow.chunkSize,
    );

    const curEndChunkX = this.loadedChunkWindow.originChunkX + Math.ceil(this.map.width  / this.loadedChunkWindow.chunkSize) - 1;
    const curEndChunkY = this.loadedChunkWindow.originChunkY + Math.ceil(this.map.height / this.loadedChunkWindow.chunkSize) - 1;

    for (const key of nextChunks) {
      if (this.loadedChunkWindow.occupiedChunks.has(key) && !this.loadedChunkWindow.loadedChunks.has(key)) {
        return (
          `Blocked: chunk ${key} of "${this.loadedChunkWindow.sourceDisplayName}" is outside this window. ` +
          `Current window: chunks ${this.loadedChunkWindow.originChunkX},${this.loadedChunkWindow.originChunkY}–${curEndChunkX},${curEndChunkY} ` +
          `(tiles 0,0–${this.map.width - 1},${this.map.height - 1}). ` +
          `Reload with a larger radius to include chunk ${key}.`
        );
      }
    }

    return null;
  }

  private refreshLoadedChunkWindowAfterResize(width: number, height: number): void {
    if (!this.loadedChunkWindow) {
      return;
    }

    this.loadedChunkWindow.loadedChunks = createLocalWindowChunkKeys(
      this.loadedChunkWindow.originChunkX,
      this.loadedChunkWindow.originChunkY,
      width,
      height,
      this.loadedChunkWindow.chunkSize,
    );
  }

  private testMapInGame(): void {
    try {
      this.mapIo.publishToGame(this.map);
      window.open('/index.html?editorMap=1', '_blank', 'noopener,noreferrer');
      this.setStatus(`Testing ${this.map.displayName} in game.`);
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : 'Test in game failed.');
    }
  }

  private clearPublishedGameMap(): void {
    this.mapIo.clearPublishedGameMap();
    this.setStatus('Cleared the editor test map from game startup.');
  }

  private applyMapCustomDefinitions(): void {
    this.registerMapEmbeddedTextures(this.map);
    this.terrainTool.addCustomPaints(this.map.customTerrainBrushes);
    this.objectTool.addCustomDefinitions(this.map.customObjectDefinitions);
    this.repairImportedTerrainScales();
  }

  private registerMapEmbeddedTextures(map: EditorMapDefinition): void {
    for (const paint of map.customTerrainBrushes) {
      if (paint.textureDataUrl && !this.textures.exists(paint.textureKey)) {
        this.textures.addBase64(paint.textureKey, paint.textureDataUrl);
      }
    }

    for (const definition of map.customObjectDefinitions) {
      for (const part of definition.visual.parts) {
        if (part.shape === 'sprite' && part.editorTextureDataUrl && !this.textures.exists(part.textureKey)) {
          this.textures.addBase64(part.textureKey, part.editorTextureDataUrl);
        }
      }
    }
  }

  private repairImportedTerrainScales(): void {
    const repairs: Array<Promise<{ key: string; scale: number } | null>> = [];

    const enqueueRepair = (
      key: string,
      paint: { textureDataUrl?: string; textureScale?: number },
    ): void => {
      if (!paint.textureDataUrl || paint.textureScale !== undefined) return;
      repairs.push(
        loadImageFromDataUrl(paint.textureDataUrl)
          .then((image) => {
            const scale = getTerrainTileFitScale(image.width, image.height);
            return scale !== undefined ? { key, scale } : null;
          })
          .catch(() => null),
      );
    };

    for (const paint of this.map.customTerrainBrushes) {
      enqueueRepair(`brush:${paint.id}`, paint);
    }
    for (const [tileKey, paint] of Object.entries(this.map.terrainTiles)) {
      enqueueRepair(`tile:${tileKey}`, paint);
    }

    if (repairs.length === 0) return;

    void Promise.all(repairs).then((results) => {
      const fixes = results.filter((r): r is { key: string; scale: number } => r !== null);
      if (fixes.length === 0) return;

      const scaleByBrushId: Record<string, number> = {};
      const scaleByTileKey: Record<string, number> = {};
      for (const { key, scale } of fixes) {
        if (key.startsWith('brush:')) scaleByBrushId[key.slice(6)] = scale;
        else scaleByTileKey[key.slice(5)] = scale;
      }

      this.map = {
        ...this.map,
        customTerrainBrushes: this.map.customTerrainBrushes.map((p) =>
          scaleByBrushId[p.id] !== undefined ? { ...p, textureScale: scaleByBrushId[p.id] } : p,
        ),
        terrainTiles: Object.fromEntries(
          Object.entries(this.map.terrainTiles).map(([k, p]) =>
            scaleByTileKey[k] !== undefined ? [k, { ...p, textureScale: scaleByTileKey[k] }] : [k, p],
          ),
        ),
      };
      this.terrainTool.addCustomPaints(this.map.customTerrainBrushes);
      this.persistWorkingDraft();
      this.redrawTerrain();
      this.updateInfoText();
    });
  }

  private showLibraryPanel(config:
    | {
      emptyMessage: string;
      records: SavedEditorMapRecord[];
      title: string;
      type: 'map';
    }
    | {
      emptyMessage: string;
      records: SavedDirtyChunkBundleRecord[];
      title: string;
      type: 'chunks';
    },
  ): void {
    const panel = document.getElementById('ed-library');
    const title = document.getElementById('ed-library-title');
    const grid = document.getElementById('ed-library-grid');
    const empty = document.getElementById('ed-library-empty');

    if (!panel || !title || !grid || !empty) {
      return;
    }

    title.textContent = config.title;
    grid.innerHTML = '';
    empty.textContent = config.emptyMessage;
    empty.style.display = config.records.length === 0 ? '' : 'none';

    if (config.type === 'map') {
      for (const record of config.records) {
        grid.appendChild(this.createLibraryCard({
          actionLabel: 'Open',
          meta: `${record.width}x${record.height} saved ${formatShortDate(record.savedAt)}`,
          name: record.displayName,
          onDelete: () => {
            deleteSavedMap(record.id);
            this.openMapLibrary();
          },
          onLoad: () => this.loadMapFromLibrary(record.id),
          previewDataUrl: record.previewDataUrl,
        }));
      }
    } else {
      for (const record of config.records) {
        grid.appendChild(this.createLibraryCard({
          actionLabel: 'Apply',
          meta: `${record.sourceMapId} saved ${formatShortDate(record.savedAt)}`,
          name: `${record.regionId} (${record.chunkCount} chunks)`,
          onDelete: () => {
            deleteSavedChunkBundle(record.id);
            this.openChunkLibrary();
          },
          onLoad: () => this.loadChunksFromLibrary(record.id),
          previewDataUrl: record.previewDataUrl,
        }));
      }
    }

    panel.style.display = 'flex';
  }

  private createLibraryCard(options: {
    actionLabel: string;
    meta: string;
    name: string;
    onDelete: () => void;
    onLoad: () => void;
    previewDataUrl: string;
  }): HTMLElement {
    const card = document.createElement('div');
    card.className = 'ed-library-card';
    card.role = 'button';
    card.tabIndex = 0;

    const preview = document.createElement('img');
    preview.className = 'ed-library-preview';
    preview.src = options.previewDataUrl;
    preview.alt = '';

    const name = document.createElement('div');
    name.className = 'ed-library-name';
    name.textContent = options.name;

    const meta = document.createElement('div');
    meta.className = 'ed-library-meta';
    meta.textContent = options.meta;

    const actions = document.createElement('div');
    actions.className = 'ed-library-actions';

    const load = document.createElement('button');
    load.className = 'ed-library-action';
    load.type = 'button';
    load.textContent = options.actionLabel;
    load.addEventListener('click', (event) => {
      event.stopPropagation();
      options.onLoad();
    });

    const remove = document.createElement('button');
    remove.className = 'ed-library-action';
    remove.type = 'button';
    remove.textContent = 'Delete';
    remove.addEventListener('click', (event) => {
      event.stopPropagation();
      options.onDelete();
    });

    actions.append(load, remove);
    card.append(preview, name, meta, actions);
    card.addEventListener('click', options.onLoad);
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        options.onLoad();
      }
    });
    return card;
  }

  private hideLibraryPanel(): void {
    const panel = document.getElementById('ed-library');

    if (panel) {
      panel.style.display = 'none';
    }
  }

  private showDefinitionPanel(options: {
    assetKind: 'object' | 'terrainTile';
    categoryValue: string;
    flagChecked: boolean;
    flagLabel: string;
    footprintHeight?: number;
    footprintWidth?: number;
    idValue: string;
    nameValue: string;
    onCreate: (values: {
      category: string;
      flag: boolean;
      footprintHeight: number;
      footprintWidth: number;
      id: string;
      name: string;
      textureDataUrl?: string;
      textureHeight?: number;
      textureKey?: string;
      textureOffsetX?: number;
      textureOffsetY?: number;
      textureScale?: number;
      textureWidth?: number;
    }) => void;
    previewColor: number | null;
    previewSrc: string | null;
    title: string;
  }): void {
    const panel = document.getElementById('ed-definition');
    const title = document.getElementById('ed-definition-title');
    const preview = document.getElementById('ed-definition-preview') as HTMLDivElement | null;
    const fitGrid = document.getElementById('ed-definition-fit-grid') as HTMLCanvasElement | null;
    const idInput = document.getElementById('ed-definition-id') as HTMLInputElement | null;
    const nameInput = document.getElementById('ed-definition-name') as HTMLInputElement | null;
    const categoryInput = document.getElementById('ed-definition-category') as HTMLInputElement | null;
    const footprintPanel = document.getElementById('ed-definition-footprint');
    const footprintWidthInput = document.getElementById('ed-definition-footprint-width') as HTMLInputElement | null;
    const footprintHeightInput = document.getElementById('ed-definition-footprint-height') as HTMLInputElement | null;
    const flagInput = document.getElementById('ed-definition-flag') as HTMLInputElement | null;
    const flagLabel = document.getElementById('ed-definition-flag-label');
    const fileInput = document.getElementById('ed-definition-file') as HTMLInputElement | null;
    const scaleInput = document.getElementById('ed-definition-scale') as HTMLInputElement | null;
    const offsetXInput = document.getElementById('ed-definition-offset-x') as HTMLInputElement | null;
    const offsetYInput = document.getElementById('ed-definition-offset-y') as HTMLInputElement | null;
    const fitButton = document.getElementById('ed-definition-fit') as HTMLButtonElement | null;
    const openFitButton = document.getElementById('ed-definition-open-fit') as HTMLButtonElement | null;
    const cleanInput = document.getElementById('ed-definition-clean') as HTMLInputElement | null;
    const previewImg = document.getElementById('ed-definition-preview-img') as HTMLImageElement | null;
    const previewColor = document.getElementById('ed-definition-preview-color') as HTMLCanvasElement | null;
    const resizeHandle = document.getElementById('ed-definition-resize-handle') as HTMLDivElement | null;
    const fitPanel = document.getElementById('ed-fit-panel') as HTMLDivElement | null;
    const fitCloseButton = document.getElementById('ed-fit-close') as HTMLButtonElement | null;
    const fitCancelButton = document.getElementById('ed-fit-cancel') as HTMLButtonElement | null;
    const fitApplyButton = document.getElementById('ed-fit-apply') as HTMLButtonElement | null;
    const fitStage = document.getElementById('ed-fit-stage') as HTMLDivElement | null;
    const fitStageGrid = document.getElementById('ed-fit-grid') as HTMLCanvasElement | null;
    const fitStageImage = document.getElementById('ed-fit-image') as HTMLImageElement | null;
    const fitSelection = document.getElementById('ed-fit-selection') as HTMLDivElement | null;
    const fitScaleRange = document.getElementById('ed-fit-scale-range') as HTMLInputElement | null;
    const fitScaleNumber = document.getElementById('ed-fit-scale-number') as HTMLInputElement | null;

    if (
      !panel ||
      !title ||
      !preview ||
      !fitGrid ||
      !idInput ||
      !nameInput ||
      !categoryInput ||
      !footprintPanel ||
      !footprintWidthInput ||
      !footprintHeightInput ||
      !flagInput ||
      !flagLabel ||
      !fileInput ||
      !scaleInput ||
      !offsetXInput ||
      !offsetYInput ||
      !fitButton ||
      !openFitButton ||
      !cleanInput ||
      !previewImg ||
      !previewColor ||
      !resizeHandle ||
      !fitPanel ||
      !fitCloseButton ||
      !fitCancelButton ||
      !fitApplyButton ||
      !fitStage ||
      !fitStageGrid ||
      !fitStageImage ||
      !fitSelection ||
      !fitScaleRange ||
      !fitScaleNumber
    ) {
      return;
    }

    title.textContent = options.title;
    idInput.value = options.idValue;
    nameInput.value = options.nameValue;
    categoryInput.value = options.categoryValue;
    footprintPanel.style.display = options.assetKind === 'object' ? '' : 'none';
    footprintWidthInput.value = String(options.footprintWidth ?? 1);
    footprintHeightInput.value = String(options.footprintHeight ?? 1);
    flagInput.checked = options.flagChecked;
    flagLabel.textContent = options.flagLabel;
    fileInput.value = '';
    scaleInput.value = '1';
    offsetXInput.value = '0';
    offsetYInput.value = '0';
    cleanInput.checked = false;
    fitPanel.style.display = 'none';

    if (options.previewSrc) {
      previewImg.src = options.previewSrc;
      previewImg.style.display = '';
      previewColor.style.display = 'none';
      resizeHandle.style.display = '';
    } else {
      previewImg.style.display = 'none';
      previewColor.style.display = '';
      resizeHandle.style.display = 'none';
      this.drawDefinitionColorPreview(previewColor, options.previewColor ?? 0xfacc15);
    }

    let pendingImage: PreparedDefinitionImage | null = null;
    let previewProjection = drawDefinitionFitPreview(
      preview,
      fitGrid,
      previewImg,
      resizeHandle,
      scaleInput,
      offsetXInput,
      offsetYInput,
      pendingImage,
      getDefinitionFitFootprint(options.assetKind, footprintWidthInput, footprintHeightInput),
    );

    const setPreviewImage = (image: PreparedDefinitionImage): void => {
      pendingImage = image;
      previewImg.src = image.dataUrl;
      previewImg.style.display = '';
      previewColor.style.display = 'none';
      resizeHandle.style.display = '';
      previewProjection = drawDefinitionFitPreview(
        preview,
        fitGrid,
        previewImg,
        resizeHandle,
        scaleInput,
        offsetXInput,
        offsetYInput,
        pendingImage,
        getDefinitionFitFootprint(options.assetKind, footprintWidthInput, footprintHeightInput),
      );
    };
    if (options.previewSrc) {
      void loadImageFromDataUrl(options.previewSrc)
        .then((image) => {
          if (!pendingImage && options.previewSrc) {
            setPreviewImage({
              dataUrl: options.previewSrc,
              height: image.height,
              width: image.width,
            });
          }
        })
        .catch(() => {
          this.setStatus('Could not prepare selected asset preview for fitting.');
        });
    }
    const prepareAndSetPreviewDataUrl = (rawDataUrl: string): void => {
      void prepareDefinitionImageDataUrl(rawDataUrl, options.assetKind, cleanInput.checked)
        .then(setPreviewImage)
        .catch((error: unknown) => {
          this.setStatus(error instanceof Error ? error.message : 'Image import failed.');
        });
    };

    fileInput.onchange = () => {
      const file = fileInput.files?.[0];

      if (!file) {
        return;
      }

      void readFileAsDataUrl(file).then(prepareAndSetPreviewDataUrl);
    };
    cleanInput.onchange = () => {
      const file = fileInput.files?.[0];

      if (!file) {
        return;
      }

      void readFileAsDataUrl(file).then(prepareAndSetPreviewDataUrl);
    };
    panel.ondragover = (event) => {
      event.preventDefault();
    };
    panel.ondrop = (event) => {
      event.preventDefault();
      const file = Array.from(event.dataTransfer?.files ?? [])
        .find((candidate) => candidate.type.startsWith('image/'));

      if (file) {
        void readFileAsDataUrl(file).then(prepareAndSetPreviewDataUrl);
      }
    };

    const updateFitPreview = (): void => {
      previewProjection = drawDefinitionFitPreview(
        preview,
        fitGrid,
        previewImg,
        resizeHandle,
        scaleInput,
        offsetXInput,
        offsetYInput,
        pendingImage,
        getDefinitionFitFootprint(options.assetKind, footprintWidthInput, footprintHeightInput),
      );
    };
    const fitHandles = Array.from(fitSelection.querySelectorAll<HTMLDivElement>('.ed-fit-handle'));
    let fitDraft: DefinitionFitDraft | null = null;
    let fitProjection: DefinitionFitProjection | null = null;
    let fitMoveStart: {
      offsetX: number;
      offsetY: number;
      pointerX: number;
      pointerY: number;
    } | null = null;
    let fitResizeStart: {
      anchorX: number;
      anchorY: number;
      corner: string;
      oppositeX: number;
      oppositeY: number;
      startDistance: number;
      startScale: number;
      zoom: number;
    } | null = null;
    const syncFitScaleControls = (): void => {
      if (!fitDraft) {
        return;
      }

      const scale = String(Number(fitDraft.scale.toFixed(2)));
      fitScaleRange.value = scale;
      fitScaleNumber.value = scale;
    };
    const drawFitEditor = (): void => {
      if (!pendingImage || !fitDraft || fitPanel.style.display === 'none') {
        return;
      }

      syncFitScaleControls();
      fitProjection = drawDefinitionFitStage(
        fitStage,
        fitStageGrid,
        fitStageImage,
        fitSelection,
        pendingImage,
        getDefinitionFitFootprint(options.assetKind, footprintWidthInput, footprintHeightInput),
        fitDraft,
      );
    };
    const closeFitEditor = (): void => {
      fitPanel.style.display = 'none';
      fitMoveStart = null;
      fitResizeStart = null;
      fitDraft = null;
    };
    const openFitEditor = (): void => {
      if (!pendingImage) {
        this.setStatus('Select or drop an image before opening the fit editor.');
        return;
      }

      fitDraft = {
        offsetX: parseNumberInput(offsetXInput.value, 0),
        offsetY: parseNumberInput(offsetYInput.value, 0),
        scale: clamp(parseNumberInput(scaleInput.value, 1), 0.05, 4),
      };
      fitStageImage.src = pendingImage.dataUrl;
      fitPanel.style.display = 'flex';
      drawFitEditor();
    };
    const updateFitDraftScale = (value: string): void => {
      if (!fitDraft) {
        return;
      }

      fitDraft.scale = clamp(parseNumberInput(value, fitDraft.scale), 0.05, 4);
      drawFitEditor();
    };
    const startFitMove = (event: PointerEvent): void => {
      if (!pendingImage || !fitDraft) {
        return;
      }

      event.preventDefault();
      fitStage.setPointerCapture(event.pointerId);
      fitMoveStart = {
        offsetX: fitDraft.offsetX,
        offsetY: fitDraft.offsetY,
        pointerX: event.clientX,
        pointerY: event.clientY,
      };
    };
    preview.ondblclick = openFitEditor;
    openFitButton.onclick = openFitEditor;
    fitCloseButton.onclick = closeFitEditor;
    fitCancelButton.onclick = closeFitEditor;
    fitScaleRange.oninput = () => updateFitDraftScale(fitScaleRange.value);
    fitScaleNumber.oninput = () => updateFitDraftScale(fitScaleNumber.value);
    fitApplyButton.onclick = () => {
      if (!fitDraft) {
        return;
      }

      scaleInput.value = String(Number(fitDraft.scale.toFixed(2)));
      offsetXInput.value = String(Math.round(fitDraft.offsetX));
      offsetYInput.value = String(Math.round(fitDraft.offsetY));
      updateFitPreview();
      closeFitEditor();
    };
    fitStageImage.onpointerdown = startFitMove;
    fitSelection.onpointerdown = startFitMove;
    fitStage.onpointermove = (event) => {
      if (fitMoveStart && fitDraft && fitProjection) {
        fitDraft.offsetX = fitMoveStart.offsetX + (event.clientX - fitMoveStart.pointerX) / fitProjection.zoom;
        fitDraft.offsetY = fitMoveStart.offsetY + (event.clientY - fitMoveStart.pointerY) / fitProjection.zoom;
        drawFitEditor();
        return;
      }

      if (fitResizeStart && fitDraft && pendingImage) {
        const currentDistance = Math.max(1, Math.hypot(
          event.clientX - fitResizeStart.oppositeX,
          event.clientY - fitResizeStart.oppositeY,
        ));
        const stageRect = fitStage.getBoundingClientRect();
        const oppositeX = fitResizeStart.oppositeX - stageRect.left;
        const oppositeY = fitResizeStart.oppositeY - stageRect.top;
        const nextScale = clamp(
          fitResizeStart.startScale * (currentDistance / fitResizeStart.startDistance),
          0.05,
          4,
        );
        const nextImageWidth = pendingImage.width * nextScale * fitResizeStart.zoom;
        const nextImageHeight = pendingImage.height * nextScale * fitResizeStart.zoom;
        const directionX = fitResizeStart.corner.includes('e') ? 1 : -1;
        const directionY = fitResizeStart.corner.includes('s') ? 1 : -1;
        const nextImageX = oppositeX + (nextImageWidth / 2) * directionX;
        const nextImageY = oppositeY + (nextImageHeight / 2) * directionY;

        fitDraft.scale = nextScale;
        fitDraft.offsetX = (nextImageX - fitResizeStart.anchorX) / fitResizeStart.zoom;
        fitDraft.offsetY = (nextImageY - fitResizeStart.anchorY) / fitResizeStart.zoom;
        drawFitEditor();
      }
    };
    fitStage.onpointerup = () => {
      fitMoveStart = null;
      fitResizeStart = null;
    };
    fitStage.onpointercancel = () => {
      fitMoveStart = null;
      fitResizeStart = null;
    };
    fitHandles.forEach((handle) => {
      handle.onpointerdown = (event) => {
        if (!fitProjection || !fitDraft) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        fitStage.setPointerCapture(event.pointerId);
        const corner = handle.dataset.corner ?? 'se';
        const stageRect = fitStage.getBoundingClientRect();
        const oppositeX = stageRect.left + (corner.includes('e')
          ? fitProjection.imageX - fitProjection.imageWidth / 2
          : fitProjection.imageX + fitProjection.imageWidth / 2);
        const oppositeY = stageRect.top + (corner.includes('s')
          ? fitProjection.imageY - fitProjection.imageHeight / 2
          : fitProjection.imageY + fitProjection.imageHeight / 2);
        const cornerX = stageRect.left + (corner.includes('e')
          ? fitProjection.imageX + fitProjection.imageWidth / 2
          : fitProjection.imageX - fitProjection.imageWidth / 2);
        const cornerY = stageRect.top + (corner.includes('s')
          ? fitProjection.imageY + fitProjection.imageHeight / 2
          : fitProjection.imageY - fitProjection.imageHeight / 2);

        fitResizeStart = {
          anchorX: fitProjection.anchorX,
          anchorY: fitProjection.anchorY,
          corner,
          oppositeX,
          oppositeY,
          startDistance: Math.max(1, Math.hypot(cornerX - oppositeX, cornerY - oppositeY)),
          startScale: fitDraft.scale,
          zoom: fitProjection.zoom,
        };
      };
    });
    scaleInput.oninput = () => {
      updateFitPreview();
      if (fitDraft) {
        fitDraft.scale = clamp(parseNumberInput(scaleInput.value, 1), 0.05, 4);
        drawFitEditor();
      }
    };
    offsetXInput.oninput = () => {
      updateFitPreview();
      if (fitDraft) {
        fitDraft.offsetX = parseNumberInput(offsetXInput.value, 0);
        drawFitEditor();
      }
    };
    offsetYInput.oninput = () => {
      updateFitPreview();
      if (fitDraft) {
        fitDraft.offsetY = parseNumberInput(offsetYInput.value, 0);
        drawFitEditor();
      }
    };
    footprintWidthInput.oninput = () => {
      updateFitPreview();
      drawFitEditor();
    };
    footprintHeightInput.oninput = () => {
      updateFitPreview();
      drawFitEditor();
    };
    fitButton.onclick = () => {
      if (!pendingImage) {
        return;
      }

      scaleInput.value = String(getDefaultDefinitionFitScale(
        pendingImage.width,
        pendingImage.height,
        options.assetKind,
      ));
      offsetXInput.value = '0';
      offsetYInput.value = '0';
      updateFitPreview();
    };
    let dragStart: { offsetX: number; offsetY: number; pointerX: number; pointerY: number } | null = null;
    let resizeStart: { pointerX: number; pointerY: number; scale: number } | null = null;
    previewImg.onpointerdown = (event) => {
      if (!pendingImage) {
        return;
      }

      previewImg.setPointerCapture(event.pointerId);
      dragStart = {
        offsetX: parseNumberInput(offsetXInput.value, 0),
        offsetY: parseNumberInput(offsetYInput.value, 0),
        pointerX: event.clientX,
        pointerY: event.clientY,
      };
    };
    previewImg.onpointermove = (event) => {
      if (!dragStart) {
        return;
      }

      offsetXInput.value = String(Math.round(dragStart.offsetX + (event.clientX - dragStart.pointerX) / previewProjection.zoom));
      offsetYInput.value = String(Math.round(dragStart.offsetY + (event.clientY - dragStart.pointerY) / previewProjection.zoom));
      updateFitPreview();
    };
    previewImg.onpointerup = () => {
      dragStart = null;
    };
    previewImg.onpointercancel = () => {
      dragStart = null;
    };
    resizeHandle.onpointerdown = (event) => {
      if (!pendingImage) {
        return;
      }

      event.preventDefault();
      resizeHandle.setPointerCapture(event.pointerId);
      resizeStart = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        scale: parseNumberInput(scaleInput.value, 1),
      };
    };
    resizeHandle.onpointermove = (event) => {
      if (!resizeStart) {
        return;
      }

      const delta = ((event.clientX - resizeStart.pointerX) + (event.clientY - resizeStart.pointerY)) / 120;
      scaleInput.value = String(Number(clamp(resizeStart.scale + delta, 0.05, 4).toFixed(2)));
      updateFitPreview();
    };
    resizeHandle.onpointerup = () => {
      resizeStart = null;
    };
    resizeHandle.onpointercancel = () => {
      resizeStart = null;
    };

    this.definitionPanelSubmit = async () => {
      const id = idInput.value.trim();
      const name = nameInput.value.trim() || id;
      const category = categoryInput.value.trim() || (options.assetKind === 'object' ? 'custom' : 'custom tiles');

      if (!id) {
        this.setStatus('Custom definition needs an id.');
        return;
      }

      const file = fileInput.files?.[0];
      const preparedImage = pendingImage ?? (file
        ? await prepareDefinitionImageDataUrl(await readFileAsDataUrl(file), options.assetKind, cleanInput.checked)
        : null);
      const textureKey = preparedImage
        ? await this.loadDroppedTexture(slugifyMapId(`editor_asset_${id}`), preparedImage.dataUrl)
        : undefined;
      const textureScale = preparedImage
        ? clamp(parseNumberInput(scaleInput.value, 1), 0.05, 4)
        : undefined;
      const textureOffsetX = preparedImage
        ? Math.round(parseNumberInput(offsetXInput.value, 0))
        : undefined;
      const textureOffsetY = preparedImage
        ? Math.round(parseNumberInput(offsetYInput.value, 0))
        : undefined;

      options.onCreate({
        flag: flagInput.checked,
        category,
        footprintHeight: Math.max(1, parseIntegerInput(footprintHeightInput.value, 1)),
        footprintWidth: Math.max(1, parseIntegerInput(footprintWidthInput.value, 1)),
        id,
        name,
        textureDataUrl: preparedImage?.dataUrl,
        textureHeight: preparedImage?.height,
        textureKey,
        textureOffsetX,
        textureOffsetY,
        textureScale,
        textureWidth: preparedImage?.width,
      });
    };

    panel.style.display = 'flex';
    idInput.focus();
    idInput.select();
  }

  private hideDefinitionPanel(): void {
    const panel = document.getElementById('ed-definition');
    const fitPanel = document.getElementById('ed-fit-panel');

    if (panel) {
      panel.style.display = 'none';
    }

    if (fitPanel) {
      fitPanel.style.display = 'none';
    }

    this.definitionPanelSubmit = null;
  }

  private getTexturePreviewDataUrl(textureKey: string | null): string | null {
    if (!textureKey || !this.textures.exists(textureKey)) {
      return null;
    }

    return this.textures.getBase64(textureKey);
  }

  private drawDefinitionColorPreview(canvas: HTMLCanvasElement, color: number): void {
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return;
    }

    const cssColor = `#${color.toString(16).padStart(6, '0')}`;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = cssColor;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 6);
    ctx.lineTo(canvas.width - 6, canvas.height / 2);
    ctx.lineTo(canvas.width / 2, canvas.height - 6);
    ctx.lineTo(6, canvas.height / 2);
    ctx.closePath();
    ctx.fill();
  }

  private loadDroppedTexture(textureKey: string, dataUrl: string): Promise<string> {
    if (this.textures.exists(textureKey)) {
      this.textures.remove(textureKey);
    }

    return new Promise((resolve, reject) => {
      const onLoad = (loadedKey: string): void => {
        if (loadedKey !== textureKey) {
          return;
        }

        cleanup();
        resolve(textureKey);
      };
      const onError = (failedKey: string): void => {
        if (failedKey !== textureKey) {
          return;
        }

        cleanup();
        reject(new Error(`Could not load image for ${textureKey}.`));
      };
      const cleanup = (): void => {
        this.textures.off('onload', onLoad);
        this.textures.off('onerror', onError);
      };

      this.textures.on('onload', onLoad);
      this.textures.on('onerror', onError);
      this.textures.addBase64(textureKey, dataUrl);
    });
  }

  private renameHoveredChunk(): void {
    if (!this.hoverTile) {
      this.setStatus('Hover a chunk before renaming it.');
      return;
    }

    const chunk = this.getChunkInfo(this.hoverTile.x, this.hoverTile.y);
    const panel = document.getElementById('ed-chunk-name-panel');
    const title = document.getElementById('ed-chunk-name-title');
    const input = document.getElementById('ed-chunk-name-input') as HTMLInputElement | null;

    if (!panel || !title || !input) {
      return;
    }

    this.pendingChunkRename = {
      chunkX: chunk.chunkX,
      chunkY: chunk.chunkY,
    };
    title.textContent = `Name Chunk ${chunk.chunkX},${chunk.chunkY}`;
    input.value = chunk.chunkName;
    panel.style.display = 'flex';
    input.focus();
    input.select();
  }

  private hideChunkNamePanel(): void {
    const panel = document.getElementById('ed-chunk-name-panel');

    if (panel) {
      panel.style.display = 'none';
    }

    this.pendingChunkRename = null;
  }

  private applyChunkNameFromPanel(): void {
    if (!this.pendingChunkRename) {
      return;
    }

    const input = document.getElementById('ed-chunk-name-input') as HTMLInputElement | null;

    if (!input) {
      return;
    }

    const { chunkX, chunkY } = this.pendingChunkRename;
    this.history.snapshot(this.map);
    const key = `${chunkX},${chunkY}`;
    const chunkNames = { ...(this.map.chunkNames ?? {}) };
    const trimmed = input.value.trim();

    if (trimmed) {
      chunkNames[key] = trimmed;
    } else {
      delete chunkNames[key];
    }

    this.map = {
      ...this.map,
      chunkNames,
    };
    this.chunkNameRenderer?.setChunkName(chunkX, chunkY, chunkNames);
    this.dirtyChunks.markChunkDirty({ chunkX, chunkY });
    this.updateInfoText();
    this.persistWorkingDraft();
    this.hideChunkNamePanel();
    this.setStatus(trimmed ? `Chunk ${key} named "${trimmed}".` : `Chunk ${key} name cleared.`);
  }

  private centerCameraOnMap(): void {
    this.viewport?.centerOnMap(this.map.width, this.map.height);
    this.setStatus('Camera centered on map.');
  }

  private getChunkInfo(tileX: number, tileY: number): { chunkName: string; chunkX: number; chunkY: number } {
    const chunkX = Math.floor(tileX / EDITOR_CHUNK_SIZE);
    const chunkY = Math.floor(tileY / EDITOR_CHUNK_SIZE);
    const chunkName = this.map.chunkNames?.[`${chunkX},${chunkY}`] ?? '';
    return { chunkName, chunkX, chunkY };
  }

  private applyUndo(): void {
    const prev = this.history.popUndo(this.map);
    if (!prev) { this.setStatus('Nothing to undo.'); return; }
    this.map = prev;
    this.dirtyChunks.markAllChunksDirty(this.map.width, this.map.height);
    this.redrawTerrain();
    this.redrawObjects();
    this.redrawOverlay();
    this.updateInfoText();
    this.persistWorkingDraft();
    this.setStatus('Undo.');
  }

  private applyRedo(): void {
    const next = this.history.popRedo(this.map);
    if (!next) { this.setStatus('Nothing to redo.'); return; }
    this.map = next;
    this.dirtyChunks.markAllChunksDirty(this.map.width, this.map.height);
    this.redrawTerrain();
    this.redrawObjects();
    this.redrawOverlay();
    this.updateInfoText();
    this.persistWorkingDraft();
    this.setStatus('Redo.');
  }

  private setStatus(message: string): void {
    this.hud?.setStatus(message);
  }

  private isTileInBounds(tileX: number, tileY: number): boolean {
    return (
      Number.isInteger(tileX) &&
      Number.isInteger(tileY) &&
      tileX >= 0 &&
      tileY >= 0 &&
      tileX < this.map.width &&
      tileY < this.map.height
    );
  }

  private ignoreWorldObjectsForUiCamera(): void {
    const worldObjects: Phaser.GameObjects.GameObject[] = [];
    if (this.overlayGraphics) worldObjects.push(this.overlayGraphics);
    if (this.chunkOverlayGraphics) worldObjects.push(this.chunkOverlayGraphics);
    this.uiCamera?.ignore(worldObjects);
  }

}

function upsertById<T extends { id: string }>(items: T[], item: T): T[] {
  const next = items.filter((candidate) => candidate.id !== item.id);
  next.push(item);
  return next;
}

function formatShortDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatToolModeStatus(mode: EditorToolMode): string {
  switch (mode) {
    case 'elevation':
      return 'Height paint mode.';
    case 'object':
      return 'Object mode.';
    case 'walkability':
      return 'Walkability paint mode.';
    case 'terrain':
    default:
      return 'Terrain mode.';
  }
}

function slugifyMapId(displayName: string): string {
  const slug = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return slug || 'editor_map';
}

function parseIntegerInput(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseNumberInput(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getTerrainTileFitScale(
  textureWidth: number | undefined,
  textureHeight: number | undefined,
): number | undefined {
  if (
    textureWidth === undefined ||
    textureHeight === undefined ||
    textureWidth <= 0 ||
    textureHeight <= 0
  ) {
    return undefined;
  }

  const scale = Math.min(TILE_WIDTH / textureWidth, TILE_HEIGHT / textureHeight);
  return Math.max(0.05, Math.min(1, scale));
}

function getDefaultDefinitionFitScale(
  textureWidth: number,
  textureHeight: number,
  assetKind: 'object' | 'terrainTile',
): number {
  const targetWidth = assetKind === 'terrainTile' ? TILE_WIDTH : TILE_WIDTH * 2;
  const targetHeight = assetKind === 'terrainTile' ? TILE_HEIGHT : TILE_HEIGHT * 3;
  const scale = Math.min(targetWidth / textureWidth, targetHeight / textureHeight);
  return Number(Math.max(0.05, Math.min(4, scale)).toFixed(2));
}

function getDefinitionFitFootprint(
  assetKind: 'object' | 'terrainTile',
  footprintWidthInput: HTMLInputElement,
  footprintHeightInput: HTMLInputElement,
): { height: number; width: number } {
  if (assetKind === 'terrainTile') {
    return { height: 1, width: 1 };
  }

  return {
    height: clamp(parseIntegerInput(footprintHeightInput.value, 1), 1, 16),
    width: clamp(parseIntegerInput(footprintWidthInput.value, 1), 1, 16),
  };
}

function drawDefinitionFitPreview(
  preview: HTMLDivElement,
  gridCanvas: HTMLCanvasElement,
  previewImg: HTMLImageElement,
  resizeHandle: HTMLDivElement,
  scaleInput: HTMLInputElement,
  offsetXInput: HTMLInputElement,
  offsetYInput: HTMLInputElement,
  image: PreparedDefinitionImage | null,
  footprint: { height: number; width: number },
): DefinitionFitProjection {
  const width = preview.clientWidth || 156;
  const height = preview.clientHeight || 132;
  const dpr = window.devicePixelRatio || 1;

  gridCanvas.width = Math.round(width * dpr);
  gridCanvas.height = Math.round(height * dpr);
  gridCanvas.style.width = `${width}px`;
  gridCanvas.style.height = `${height}px`;

  const ctx = gridCanvas.getContext('2d');
  const bounds = getIsoFootprintBounds(footprint.width, footprint.height);
  const zoom = Math.min(
    2,
    (width - 20) / Math.max(1, bounds.maxX - bounds.minX),
    (height - 20) / Math.max(1, bounds.maxY - bounds.minY),
  );
  const originX = width / 2 - ((bounds.minX + bounds.maxX) / 2) * zoom;
  const originY = height / 2 - ((bounds.minY + bounds.maxY) / 2) * zoom;
  const center = getDefinitionFootprintCenterOffset(footprint.width, footprint.height);
  const anchorX = originX + center.x * zoom;
  const anchorY = originY + center.y * zoom;

  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 1;

    for (let tileY = 0; tileY < footprint.height; tileY += 1) {
      for (let tileX = 0; tileX < footprint.width; tileX += 1) {
        const points = getIsoDiamondPoints(tileX, tileY)
          .map((point) => ({
            x: originX + point.x * zoom,
            y: originY + point.y * zoom,
          }));

        ctx.beginPath();
        points.forEach((point, index) => {
          if (index === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
        ctx.fillStyle = 'rgba(66, 107, 52, 0.32)';
        ctx.strokeStyle = 'rgba(215, 243, 255, 0.68)';
        ctx.fill();
        ctx.stroke();
      }
    }

    ctx.beginPath();
    ctx.arc(anchorX, anchorY, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#facc15';
    ctx.fill();
  }

  const scale = clamp(parseNumberInput(scaleInput.value, 1), 0.05, 4);
  const offsetX = parseNumberInput(offsetXInput.value, 0);
  const offsetY = parseNumberInput(offsetYInput.value, 0);
  const imageX = anchorX + offsetX * zoom;
  const imageY = anchorY + offsetY * zoom;
  const imageWidth = image ? image.width * scale * zoom : 0;
  const imageHeight = image ? image.height * scale * zoom : 0;

  previewImg.style.transform = `translate(-50%, -50%) translate(${imageX - width / 2}px, ${imageY - height / 2}px) scale(${scale * zoom})`;

  if (image) {
    resizeHandle.style.display = '';
    resizeHandle.style.left = `${imageX + imageWidth / 2 - 5}px`;
    resizeHandle.style.top = `${imageY + imageHeight / 2 - 5}px`;
  } else {
    resizeHandle.style.display = 'none';
  }

  return { anchorX, anchorY, imageHeight, imageWidth, imageX, imageY, zoom };
}

function drawDefinitionFitStage(
  stage: HTMLDivElement,
  gridCanvas: HTMLCanvasElement,
  fitImage: HTMLImageElement,
  selection: HTMLDivElement,
  image: PreparedDefinitionImage,
  footprint: { height: number; width: number },
  draft: DefinitionFitDraft,
): DefinitionFitProjection {
  const width = stage.clientWidth || 696;
  const height = stage.clientHeight || 430;
  const dpr = window.devicePixelRatio || 1;

  gridCanvas.width = Math.round(width * dpr);
  gridCanvas.height = Math.round(height * dpr);
  gridCanvas.style.width = `${width}px`;
  gridCanvas.style.height = `${height}px`;

  const ctx = gridCanvas.getContext('2d');
  const bounds = getIsoFootprintBounds(footprint.width, footprint.height);
  const zoom = Math.min(
    5,
    (width - 96) / Math.max(1, bounds.maxX - bounds.minX),
    (height - 96) / Math.max(1, bounds.maxY - bounds.minY),
  );
  const originX = width / 2 - ((bounds.minX + bounds.maxX) / 2) * zoom;
  const originY = height / 2 - ((bounds.minY + bounds.maxY) / 2) * zoom;
  const center = getDefinitionFootprintCenterOffset(footprint.width, footprint.height);
  const anchorX = originX + center.x * zoom;
  const anchorY = originY + center.y * zoom;

  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 1;

    for (let tileY = 0; tileY < footprint.height; tileY += 1) {
      for (let tileX = 0; tileX < footprint.width; tileX += 1) {
        const points = getIsoDiamondPoints(tileX, tileY)
          .map((point) => ({
            x: originX + point.x * zoom,
            y: originY + point.y * zoom,
          }));

        ctx.beginPath();
        points.forEach((point, index) => {
          if (index === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
        ctx.fillStyle = 'rgba(66, 107, 52, 0.36)';
        ctx.strokeStyle = 'rgba(215, 243, 255, 0.78)';
        ctx.fill();
        ctx.stroke();
      }
    }

    ctx.beginPath();
    ctx.arc(anchorX, anchorY, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#facc15';
    ctx.fill();
  }

  const scale = clamp(draft.scale, 0.05, 4);
  const imageX = anchorX + draft.offsetX * zoom;
  const imageY = anchorY + draft.offsetY * zoom;
  const imageWidth = image.width * scale * zoom;
  const imageHeight = image.height * scale * zoom;

  fitImage.style.display = '';
  fitImage.style.left = `${imageX - imageWidth / 2}px`;
  fitImage.style.top = `${imageY - imageHeight / 2}px`;
  fitImage.style.width = `${imageWidth}px`;
  fitImage.style.height = `${imageHeight}px`;
  fitImage.style.transform = 'none';

  selection.style.display = '';
  selection.style.left = `${imageX - imageWidth / 2}px`;
  selection.style.top = `${imageY - imageHeight / 2}px`;
  selection.style.width = `${imageWidth}px`;
  selection.style.height = `${imageHeight}px`;

  return { anchorX, anchorY, imageHeight, imageWidth, imageX, imageY, zoom };
}

function getDefinitionFootprintCenterOffset(footprintWidth: number, footprintHeight: number): { x: number; y: number } {
  return {
    x: ((footprintWidth - footprintHeight) * TILE_WIDTH) / 4,
    y: ((footprintWidth + footprintHeight - 2) * TILE_HEIGHT) / 4,
  };
}

function getIsoDiamondPoints(tileX: number, tileY: number): Array<{ x: number; y: number }> {
  const centerX = ((tileX - tileY) * TILE_WIDTH) / 2;
  const centerY = ((tileX + tileY) * TILE_HEIGHT) / 2;

  return [
    { x: centerX, y: centerY - TILE_HEIGHT / 2 },
    { x: centerX + TILE_WIDTH / 2, y: centerY },
    { x: centerX, y: centerY + TILE_HEIGHT / 2 },
    { x: centerX - TILE_WIDTH / 2, y: centerY },
  ];
}

function getIsoFootprintBounds(footprintWidth: number, footprintHeight: number): {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
} {
  const points: Array<{ x: number; y: number }> = [];

  for (let tileY = 0; tileY < footprintHeight; tileY += 1) {
    for (let tileX = 0; tileX < footprintWidth; tileX += 1) {
      points.push(...getIsoDiamondPoints(tileX, tileY));
    }
  }

  return {
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
  };
}

function copyTileRecordWindow<T>(
  source: Record<string, T>,
  startX: number,
  startY: number,
  width: number,
  height: number,
): Record<string, T> {
  const result: Record<string, T> = {};

  for (let localY = 0; localY < height; localY += 1) {
    for (let localX = 0; localX < width; localX += 1) {
      const value = source[`${startX + localX},${startY + localY}`];

      if (value !== undefined) {
        result[`${localX},${localY}`] = (typeof value === 'object' && value !== null
          ? { ...value }
          : value) as T;
      }
    }
  }

  return result;
}

function copyChunkNamesWindow(
  names: Record<string, string> | undefined,
  startChunkX: number,
  startChunkY: number,
  endChunkX: number,
  endChunkY: number,
): Record<string, string> | undefined {
  if (!names) {
    return undefined;
  }

  const result: Record<string, string> = {};

  for (let chunkY = startChunkY; chunkY <= endChunkY; chunkY += 1) {
    for (let chunkX = startChunkX; chunkX <= endChunkX; chunkX += 1) {
      const name = names[`${chunkX},${chunkY}`];

      if (name) {
        result[`${chunkX - startChunkX},${chunkY - startChunkY}`] = name;
      }
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function createChunkKeySet(startChunkX: number, startChunkY: number, endChunkX: number, endChunkY: number): Set<string> {
  const keys = new Set<string>();

  for (let chunkY = startChunkY; chunkY <= endChunkY; chunkY += 1) {
    for (let chunkX = startChunkX; chunkX <= endChunkX; chunkX += 1) {
      keys.add(`${chunkX},${chunkY}`);
    }
  }

  return keys;
}

function createLocalWindowChunkKeys(
  originChunkX: number,
  originChunkY: number,
  width: number,
  height: number,
  chunkSize: number,
): Set<string> {
  const endChunkX = originChunkX + Math.max(0, Math.ceil(width / chunkSize) - 1);
  const endChunkY = originChunkY + Math.max(0, Math.ceil(height / chunkSize) - 1);
  return createChunkKeySet(originChunkX, originChunkY, endChunkX, endChunkY);
}

function isInsideRect(
  tileX: number,
  tileY: number,
  rectX: number,
  rectY: number,
  width: number,
  height: number,
): boolean {
  return tileX >= rectX && tileY >= rectY && tileX < rectX + width && tileY < rectY + height;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error(`Could not read ${file.name}.`));
    };
    reader.readAsDataURL(file);
  });
}

async function prepareDefinitionImageDataUrl(
  dataUrl: string,
  assetKind: 'object' | 'terrainTile',
  cleanImage: boolean,
): Promise<PreparedDefinitionImage> {
  if (!cleanImage) {
    const image = await loadImageFromDataUrl(dataUrl);
    return {
      dataUrl,
      height: image.height,
      width: image.width,
    };
  }

  const canvas = await cleanImportedAssetImage(dataUrl, assetKind);

  return {
    dataUrl: canvas.toDataURL('image/png'),
    height: canvas.height,
    width: canvas.width,
  };
}

async function cleanImportedAssetImage(
  dataUrl: string,
  assetKind: 'object' | 'terrainTile',
): Promise<HTMLCanvasElement> {
  const image = await loadImageFromDataUrl(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not create tile import canvas.');
  }

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0);
  removeEdgeBackgroundPixels(ctx, canvas.width, canvas.height, assetKind);
  removeNearBlackPixels(ctx, canvas.width, canvas.height);
  return cropTransparentBounds(ctx, canvas.width, canvas.height);
}

function removeEdgeBackgroundPixels(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  assetKind: 'object' | 'terrainTile',
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const background = sampleDominantCornerColor(data, width, height);

  if (!background) {
    return;
  }

  const tolerance = assetKind === 'object' ? 26 : 18;

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3] ?? 0;

    if (alpha === 0) {
      continue;
    }

    const red = data[index] ?? 0;
    const green = data[index + 1] ?? 0;
    const blue = data[index + 2] ?? 0;

    if (colorDistance(red, green, blue, background.red, background.green, background.blue) <= tolerance) {
      data[index + 3] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

function sampleDominantCornerColor(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { blue: number; green: number; red: number } | null {
  const samples = [
    getPixel(data, width, 0, 0),
    getPixel(data, width, width - 1, 0),
    getPixel(data, width, 0, height - 1),
    getPixel(data, width, width - 1, height - 1),
  ].filter((sample): sample is { blue: number; green: number; red: number } => sample !== null);

  if (samples.length === 0) {
    return null;
  }

  return samples
    .map((sample) => ({
      sample,
      matches: samples.filter((candidate) =>
        colorDistance(sample.red, sample.green, sample.blue, candidate.red, candidate.green, candidate.blue) <= 18,
      ).length,
    }))
    .sort((a, b) => b.matches - a.matches)[0]?.sample ?? null;
}

function getPixel(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
): { blue: number; green: number; red: number } | null {
  const index = (y * width + x) * 4;
  const alpha = data[index + 3] ?? 0;

  if (alpha === 0) {
    return null;
  }

  return {
    red: data[index] ?? 0,
    green: data[index + 1] ?? 0,
    blue: data[index + 2] ?? 0,
  };
}

function colorDistance(
  redA: number,
  greenA: number,
  blueA: number,
  redB: number,
  greenB: number,
  blueB: number,
): number {
  return Math.max(Math.abs(redA - redB), Math.abs(greenA - greenB), Math.abs(blueA - blueB));
}

function removeNearBlackPixels(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index] ?? 0;
    const green = data[index + 1] ?? 0;
    const blue = data[index + 2] ?? 0;

    if (red <= 8 && green <= 8 && blue <= 8) {
      data[index + 3] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

function cropTransparentBounds(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): HTMLCanvasElement {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3] ?? 0;

      if (alpha <= 0) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    const empty = document.createElement('canvas');
    empty.width = 1;
    empty.height = 1;
    return empty;
  }

  const cropped = document.createElement('canvas');
  cropped.width = maxX - minX + 1;
  cropped.height = maxY - minY + 1;
  const croppedCtx = cropped.getContext('2d');

  if (!croppedCtx) {
    return cropped;
  }

  croppedCtx.imageSmoothingEnabled = false;
  croppedCtx.putImageData(ctx.getImageData(minX, minY, cropped.width, cropped.height), 0, 0);
  return cropped;
}

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load dropped image.'));
    image.src = dataUrl;
  });
}
