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
import { EditorAssetLibraryController } from './assets/EditorAssetLibraryController';
import { loadImageFromDataUrl } from './assets/EditorDefinitionImage';
import { EditorDefinitionPanelController } from './ui/EditorDefinitionPanelController';

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

export class EditorScene extends Phaser.Scene {
  private readonly terrainTool = new EditorTerrainToolController();
  private readonly objectTool = new EditorObjectToolController();
  private readonly dirtyChunks = new EditorDirtyChunkTracker(EDITOR_CHUNK_SIZE);
  private readonly mapIo = new EditorMapIoController();
  private readonly history = new EditorHistoryStack();
  private readonly assetLibrary = new EditorAssetLibraryController(this, this.terrainTool, this.objectTool);
  private readonly definitionPanel = new EditorDefinitionPanelController({
    loadTexture: (textureKey, dataUrl) => this.loadDroppedTexture(textureKey, dataUrl),
    setStatus: (message) => this.setStatus(message),
  });
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
    const draftRestorePromise = this.assetLibrary.syncGlobalAssets()
      .then(() => this.restoreWorkingDraft());
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
    this.definitionPanel.bindGlobalEvents();
    document.getElementById('ed-chunk-window-close')?.addEventListener('click', () => this.hideChunkWindowPanel());
    document.getElementById('ed-chunk-window-cancel')?.addEventListener('click', () => this.hideChunkWindowPanel());
    document.getElementById('ed-chunk-window-load')?.addEventListener('click', () => this.loadChunkWindowFromPanel());
    document.getElementById('ed-resize-close')?.addEventListener('click', () => this.hideResizePanel());
    document.getElementById('ed-resize-cancel')?.addEventListener('click', () => this.hideResizePanel());
    document.getElementById('ed-resize-apply')?.addEventListener('click', () => this.applyResizeFromPanel());
    document.getElementById('ed-chunk-name-close')?.addEventListener('click', () => this.hideChunkNamePanel());
    document.getElementById('ed-chunk-name-cancel')?.addEventListener('click', () => this.hideChunkNamePanel());
    document.getElementById('ed-chunk-name-apply')?.addEventListener('click', () => this.applyChunkNameFromPanel());
    void draftRestorePromise.then((restored) => {
      this.redrawTerrain();
      this.redrawObjects();
      this.centerCameraOnMap();
      this.updateInfoText();
      if (restored) {
        this.setStatus(`Restored ${this.map.displayName} from editor draft.`);
      }
    });
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
    this.definitionPanel.show({
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
        this.assetLibrary.addTerrainPaint(paint);
        this.palette?.updateTerrainSelection(brush);
        this.updateInfoText();
        this.persistWorkingDraft();
        this.definitionPanel.close();
        this.setStatus(`Added custom tile ${brush.label} (${flag ? 'walkable' : 'blocked'}).`);
      },
    });
  }

  private createCustomObjectDefinition(): void {
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
        this.assetLibrary.addObjectDefinition(definition);
        this.palette?.refresh(this.terrainTool.getSelectedBrush(), definition.id);
        this.palette?.updateObjectSelection(definition.id);
        this.updateInfoText();
        this.persistWorkingDraft();
        this.definitionPanel.close();
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
    this.assetLibrary.removeTerrainPaint(brush.id);
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
    this.assetLibrary.removeObjectDefinition(definition.id);
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
    const result = await this.mapIo.exportMap(this.getSerializableMap());
    this.dirtyChunks.clear();
    this.updateInfoText();
    this.setStatus(
      result === 'clipboard'
        ? 'MapDefinition export copied to clipboard.'
        : 'MapDefinition export printed to console.',
    );
  }

  private async exportWorldChunk(): Promise<void> {
    const result = await this.mapIo.exportWorldChunk(this.getSerializableMap(), {
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

  private getSerializableMap(): EditorMapDefinition {
    return this.assetLibrary.hydrateMapForSerialization(this.map);
  }

  private async restoreWorkingDraft(): Promise<boolean> {
    const draft = loadEditorWorkingDraft();

    if (!draft) {
      return false;
    }

    this.map = draft;
    this.loadedChunkWindow = null;
    this.history.clear();
    await this.applyMapCustomDefinitions();
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

      const bundle = createDirtyChunkBundle(this.getSerializableMap(), dirtyChunks, {
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
      const record = await saveMapToProjectLibrary(this.getSerializableMap());
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
      this.dirtyChunks.clear();
      this.persistWorkingDraft();
      this.centerCameraOnMap();
      void this.applyMapCustomDefinitions().then(() => {
        this.redrawTerrain();
        this.redrawObjects();
        this.redrawOverlay();
        this.updateInfoText();
      });
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
      void this.applyMapCustomDefinitions().then(() => {
        this.redrawTerrain();
        this.redrawObjects();
        this.redrawOverlay();
        this.updateInfoText();
      });
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
      this.dirtyChunks.clear();
      this.hoverTile = null;
      this.persistWorkingDraft();
      this.centerCameraOnMap();
      void this.applyMapCustomDefinitions().then(() => {
        this.redrawTerrain();
        this.redrawObjects();
        this.redrawOverlay();
        this.updateInfoText();
      });
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
      this.mapIo.publishToGame(this.getSerializableMap());
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

  private async applyMapCustomDefinitions(): Promise<void> {
    await this.assetLibrary.applyMapDefinitions(this.map);
    this.repairImportedTerrainScales();
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

  private getTexturePreviewDataUrl(textureKey: string | null): string | null {
    if (!textureKey || !this.textures.exists(textureKey)) {
      return null;
    }

    return this.textures.getBase64(textureKey);
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
