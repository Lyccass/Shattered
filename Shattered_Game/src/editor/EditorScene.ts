import Phaser from 'phaser';
import {
  createSampleEditorMap,
  getEditorTerrainElevationAt,
  getEditorTerrainAt,
  getEditorTerrainZoneAt,
  paintTerrainZone,
  type EditorMapDefinition,
  type EditorWorldZoneTag,
  getEditorTerrainWalkabilityAt,
  paintTerrainElevation,
  paintTerrainWalkability,
  resizeEditorMap,
} from '../shared/editor/EditorMapModel';
import {
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
  consumeEditorLibraryCacheMessage,
  deleteSavedChunkBundle,
  loadEditorWorkingDraft,
  listSavedChunkBundlesFromProjectLibrary,
  saveEditorWorkingDraft,
  saveDirtyChunkBundleToProjectLibrary,
} from './io/EditorLocalLibrary';
import {
  createWorldManifestInProject,
  listProjectWorlds,
  loadEditorWorldChunkWindow,
  loadWorldManifestFromProject,
  saveWorldChunksToProject,
} from './io/EditorWorldLibrary';
import { EditorInputController, type EditorToolMode } from './input/EditorInputController';
import { EditorViewportController } from './viewport/EditorViewportController';
import { EditorChunkNameRenderer } from './chunks/EditorChunkNameRenderer';
import { EditorTilePaletteController } from './ui/EditorTilePaletteController';
import { EditorHistoryStack } from './EditorHistoryStack';
import { EditorAssetLibraryController } from './assets/EditorAssetLibraryController';
import { loadImageFromDataUrl } from './assets/EditorDefinitionImage';
import { EditorDefinitionPanelController } from './ui/EditorDefinitionPanelController';
import { EditorLibraryPanelController } from './ui/EditorLibraryPanelController';
import { EditorEncounterPanelController } from './ui/EditorEncounterPanelController';
import { EditorConnectionPanelController } from './ui/EditorConnectionPanelController';
import { EditorEncounterToolController } from './encounters/EditorEncounterToolController';
import { EditorNpcToolController } from './npcs/EditorNpcToolController';
import { drawEditorOverlay } from './overlays/EditorOverlayRenderer';
import {
  createSaveConfidenceState,
  type EditorSaveSnapshot,
} from './workflow/EditorSaveConfidence';
import {
  resolveEditorWorldTestSpawn,
  type EditorTestSpawnMode,
} from './workflow/EditorWorldTestSpawn';

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
  sourceType: 'map' | 'world';
  worldId: string;
};

export class EditorScene extends Phaser.Scene {
  private readonly terrainTool = new EditorTerrainToolController();
  private readonly objectTool = new EditorObjectToolController();
  private readonly dirtyChunks = new EditorDirtyChunkTracker(EDITOR_CHUNK_SIZE);
  private readonly encounterTool = new EditorEncounterToolController({
    getHoverTile: () => this.hoverTile,
    getMap: () => this.map,
    markChunkDirty: (chunk) => this.dirtyChunks.markChunkDirty(chunk),
    onChanged: () => this.commitEditorToolChange(),
    setMap: (map) => { this.map = map; },
    setStatus: (message) => this.setStatus(message),
    snapshot: (map) => this.history.snapshot(map),
  });
  private readonly npcTool = new EditorNpcToolController({
    getHoverTile: () => this.hoverTile,
    getMap: () => this.map,
    markTileDirty: (tileX, tileY) => this.dirtyChunks.markTileDirty(tileX, tileY),
    onChanged: () => this.commitEditorToolChange(),
    setMap: (map) => { this.map = map; },
    setStatus: (message) => this.setStatus(message),
    snapshot: (map) => this.history.snapshot(map),
  });
  private readonly mapIo = new EditorMapIoController();
  private readonly history = new EditorHistoryStack();
  private readonly assetLibrary = new EditorAssetLibraryController(this, this.terrainTool, this.objectTool);
  private readonly definitionPanel = new EditorDefinitionPanelController({
    loadTexture: (textureKey, dataUrl) => this.loadDroppedTexture(textureKey, dataUrl),
    setStatus: (message) => this.setStatus(message),
  });
  private readonly libraryPanel = new EditorLibraryPanelController();
  private readonly connectionPanel = new EditorConnectionPanelController({
    getHoverTile: () => this.hoverTile,
    getMap: () => this.map,
    getWorldId: () => this.worldId,
    isTileInBounds: (tileX, tileY) => this.isTileInBounds(tileX, tileY),
    markTileDirty: (tileX, tileY) => this.dirtyChunks.markTileDirty(tileX, tileY),
    onChanged: () => this.commitEditorToolChange(),
    setMap: (map) => { this.map = map; },
    setStatus: (message) => this.setStatus(message),
    snapshot: (map) => this.history.snapshot(map),
  });
  private map: EditorMapDefinition = createSampleEditorMap(this.terrainTool.getSelectedPaint());
  private worldId = 'the_wake';
  private regionId = 'harbor_coast';
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
  private encounterPanel?: EditorEncounterPanelController;
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
  private selectedZoneTag: EditorWorldZoneTag | null = 'wilds';
  private loadedChunkWindow: LoadedChunkWindowContext | null = null;
  private lastSaveSnapshot: EditorSaveSnapshot | null = null;
  private testSpawnMode: EditorTestSpawnMode = 'hover';

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
      onExportWorldChunk: () => { void this.exportWorldChunk(); },
      onImportDirtyChunks: () => this.openChunkLibrary(),
      onOpenChunkWindow: () => this.openChunkWindowPanel(),
      onOpenConnections: () => { void this.connectionPanel.open(); },
      onOpenPalette: () => this.togglePalette(),
      onOpenWorldPanel: () => this.openWorldPanel(),
      onRedo: () => this.applyRedo(),
      onRenameMap: (displayName) => this.renameMap(displayName),
      onSetTestSpawnMode: (mode) => this.setTestSpawnMode(mode),
      onSetWalkabilityBrush: (walkable) => this.setWalkabilityBrush(walkable),
      onSetMode: (mode) => this.setToolMode(mode as EditorToolMode),
      onSetZoneTag: (tag) => this.setZoneTag(tag),
      onSetNpcDefinitionId: (id) => this.npcTool.setSelectedDefinitionId(id),
      onPlaceNpcAtHover: () => this.npcTool.placeAtHover(),
      onRemoveNpcAtHover: () => this.npcTool.removeAtHover(),
      onTestInGame: () => this.testMapInGame(),
      onResizeMap: () => this.openResizePanel(),
      onUndo: () => this.applyUndo(),
    });
    this.hud.create(this.terrainTool.getSelectedBrush());
    this.encounterPanel = new EditorEncounterPanelController({
      onAddManualSpawnAtHover: () => this.encounterTool.addManualSpawnAtHover(),
      onAddRule: (rule) => this.encounterTool.addRule(rule),
      onCreateAreaAtHover: () => this.encounterTool.createAreaAtHover(),
      onDeleteArea: () => this.encounterTool.deleteSelectedArea(),
      onDeleteManualSpawn: () => this.encounterTool.deleteSelectedManualSpawn(),
      onDeleteRule: () => this.encounterTool.deleteSelectedRule(),
      onMoveAreaToHover: () => this.encounterTool.moveSelectedAreaToHover(),
      onSelectArea: (areaId) => this.encounterTool.selectArea(areaId),
      onSelectManualSpawn: (spawnId) => this.encounterTool.selectManualSpawn(spawnId),
      onSelectRule: (ruleId) => this.encounterTool.selectRule(ruleId),
      onUpdateArea: (patch) => this.encounterTool.updateSelectedArea(patch),
      onUpdateRule: (patch) => this.encounterTool.updateSelectedRule(patch),
    });
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
    this.libraryPanel.bindGlobalEvents();
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
    document.getElementById('ed-world-panel-close')?.addEventListener('click', () => this.hideWorldPanel());
    document.getElementById('ed-world-panel-cancel')?.addEventListener('click', () => this.hideWorldPanel());
    document.getElementById('ed-world-panel-open-selected')?.addEventListener('click', () => this.openWorldFromPanel());
    document.getElementById('ed-world-panel-create')?.addEventListener('click', () => { void this.createWorldFromPanel(); });
    this.bindWorldCreateNameGenerator();
    this.connectionPanel.bindEvents();
    void draftRestorePromise.then(async (restored) => {
      if (!restored && await this.loadWorldChunkWindowFromProject('the_wake', 0, 0, 0)) {
        return;
      }

      this.palette?.refresh(
        this.terrainTool.getSelectedBrush(),
        this.objectTool.getSelectedDefinition().id,
      );
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
      beginStroke: () => {
        if (this.toolMode === 'encounter') {
          this.encounterTool.beginStroke();
        }
        this.history.beginStroke(this.map);
      },
      centerCameraOnMap: () => this.centerCameraOnMap(),
      cycleSelection: (offset) => this.cycleSelection(offset),
      endStroke: () => {
        if (this.toolMode === 'encounter') {
          this.encounterTool.endStroke();
        }
        this.history.endStroke();
      },
      exportDirtyChunks: () => this.saveDirtyChunksToLibrary(),
      exportWorldChunk: () => { void this.exportWorldChunk(); },
      flipSelectedBrush: (axis) => this.flipSelectedBrush(axis),
      getToolMode: () => this.toolMode,
      importDirtyChunks: () => this.openChunkLibrary(),
      isPaletteOpen: () => this.palette?.isVisible() ?? false,
      isPointerPanning: () => this.viewport?.isPanning() ?? false,
      openChunkWindow: () => this.openChunkWindowPanel(),
      redo: () => this.applyRedo(),
      redrawPointerState: () => this.redrawPointerState(),
      removeHoveredObject: () => this.removeHoveredObject(),
      renameHoveredChunk: () => this.renameHoveredChunk(),
      resetTerrainStroke: () => this.terrainTool.resetStroke(),
      resizeMap: () => this.openResizePanel(),
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
    this.redrawOverlay();
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

    if (this.toolMode === 'zone') {
      this.paintHoveredZone();
      return;
    }

    if (this.toolMode === 'encounter') {
      this.redrawOverlay();
      return;
    }

    if (this.toolMode === 'npc') {
      this.npcTool.placeAtHover();
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

  private paintHoveredZone(): void {
    if (!this.hoverTile) {
      return;
    }

    const footprint = this.terrainTool.getBrushFootprint(this.hoverTile.x, this.hoverTile.y);
    const painted = footprint.filter(
      (tile) => paintTerrainZone(this.map, tile.x, tile.y, this.selectedZoneTag),
    );
    this.markPaintedTilesDirty(painted);
  }

  private setZoneTag(tag: EditorWorldZoneTag | null): void {
    this.selectedZoneTag = tag;
    this.updateInfoText();
    this.setStatus(tag ? `Painting zone: ${tag}.` : 'Zone erase mode.');
  }

  private commitEditorToolChange(): void {
    this.redrawOverlay();
    this.updateInfoText();
    this.persistWorkingDraft();
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
    if (this.toolMode === 'npc') {
      this.npcTool.removeAtHover();
      return;
    }

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

    const hoverFootprint = this.hoverTile && this.toolMode === 'terrain'
      ? this.terrainTool.getBrushFootprint(this.hoverTile.x, this.hoverTile.y)
      : this.hoverTile
        ? [this.hoverTile]
        : [];

    drawEditorOverlay({
      dragStart: this.encounterTool.getDragStart(),
      encounterSelection: this.encounterTool.getSelection(),
      graphics,
      hoverFootprint,
      hoverTile: this.hoverTile,
      isTileInBounds: (tileX, tileY) => this.isTileInBounds(tileX, tileY),
      map: this.map,
      toolMode: this.toolMode,
      transform: this.transform,
    });
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

    this.encounterTool.normalizeSelection();
    const encounterSelection = this.encounterTool.getSelection();
    const hover = this.hoverTile && this.isTileInBounds(this.hoverTile.x, this.hoverTile.y)
      ? this.hoverTile
      : null;
    const hoverFamily = hover ? getEditorTerrainAt(this.map, hover.x, hover.y) : null;
    const hoverPaint = hover ? this.terrainRenderer?.getTilePaint(this.map, hover.x, hover.y) ?? null : null;
    const hoverWalkable = hover ? getEditorTerrainWalkabilityAt(this.map, hover.x, hover.y) : null;
    const hoverElevation = hover ? getEditorTerrainElevationAt(this.map, hover.x, hover.y) : null;
    const hoverZone = hover ? getEditorTerrainZoneAt(this.map, hover.x, hover.y) : null;
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
        zone: hoverZone,
      },
      dirtyChunks: this.dirtyChunks.getSummary(),
      map: this.map,
      npcAnchorCount: this.map.npcAnchors.length,
      npcDefinitions: this.npcTool.getDefinitionOptions(),
      selectedNpcDefinitionId: this.npcTool.getSelectedDefinitionId(),
      objectPreviewColor: this.objectTool.getPreviewColor(),
      objectPreviewTextureKey: this.objectTool.getPreviewTextureKey(),
      selectedBrush,
      selectedBrushIndexLabel: this.terrainTool.getSelectedBrushIndexLabel(),
      selectedElevation: this.selectedElevation,
      selectedWalkable: this.selectedWalkable,
      selectedZoneTag: this.selectedZoneTag,
      selectedObjectDisplayName: selectedObjectDefinition.displayName,
      saveConfidence: createSaveConfidenceState(
        this.dirtyChunks.getDirtyChunks(),
        this.lastSaveSnapshot,
        this.loadedChunkWindow?.sourceType === 'world' ? 'project-world' : 'chunk-library',
      ),
      testSpawnLabel: this.getWorldTestSpawn().label,
      testSpawnMode: this.testSpawnMode,
      toolMode: this.toolMode,
    });

    this.encounterPanel?.setVisible(this.toolMode === 'encounter');
    this.encounterPanel?.update({
      areas: this.map.encounterAreas,
      hoverTile: hover,
      selectedAreaId: encounterSelection.selectedAreaId,
      selectedManualSpawnId: encounterSelection.selectedManualSpawnId,
      selectedRuleId: encounterSelection.selectedRuleId,
    });
  }

  private setWalkabilityBrush(walkable: boolean): void {
    this.selectedWalkable = walkable;
    this.updateInfoText();
    this.setStatus(walkable ? 'Painting walkable tiles.' : 'Painting blocked tiles.');
  }

  private setTestSpawnMode(mode: EditorTestSpawnMode): void {
    this.testSpawnMode = mode;
    this.updateInfoText();
    this.setStatus(mode === 'hover'
      ? 'Test spawn follows the hovered tile.'
      : 'Test spawn uses the loaded window center.');
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
      this.lastSaveSnapshot = null;
      this.history.clear();
    await this.applyMapCustomDefinitions();
    await this.restoreLoadedWorldWindowContextFromDraft();
    const restoredWindow = this.loadedChunkWindow as LoadedChunkWindowContext | null;
    if (restoredWindow?.sourceType === 'world') {
      this.dirtyChunks.markAllChunksDirty(this.map.width, this.map.height);
    }
    return true;
  }

  private async restoreLoadedWorldWindowContextFromDraft(): Promise<void> {
    const match = /^(.+)_window_(-?\d+)_(-?\d+)_(-?\d+)_(-?\d+)$/.exec(this.map.id);

    if (!match) {
      return;
    }

    const [, worldId, startChunkX, startChunkY, endChunkX, endChunkY] = match;

    try {
      const manifest = await loadWorldManifestFromProject(worldId);
      const originChunkX = Number.parseInt(startChunkX, 10);
      const originChunkY = Number.parseInt(startChunkY, 10);
      const lastChunkX = Number.parseInt(endChunkX, 10);
      const lastChunkY = Number.parseInt(endChunkY, 10);
      this.worldId = manifest.worldId;
      this.regionId = manifest.defaultRegionId;
      this.loadedChunkWindow = {
        chunkSize: manifest.chunkSize,
        loadedChunks: createChunkKeySet(originChunkX, originChunkY, lastChunkX, lastChunkY),
        occupiedChunks: new Set(manifest.authoredChunks.map((chunk) => `${chunk.chunkX},${chunk.chunkY}`)),
        originChunkX,
        originChunkY,
        regionId: manifest.defaultRegionId,
        sourceDisplayName: manifest.displayName,
        sourceMapId: manifest.worldId,
        sourceRecordId: `world:${manifest.worldId}`,
        sourceType: 'world',
        worldId: manifest.worldId,
      };
    } catch {
      this.loadedChunkWindow = null;
    }
  }

  private persistWorkingDraft(): void {
    try {
      saveEditorWorkingDraft(this.map);
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : 'Editor draft save failed.');
    }
  }

  private async saveDirtyChunksToLibrary(): Promise<boolean> {
    try {
      const dirtyChunks = this.dirtyChunks.getDirtyChunks();

      if (dirtyChunks.length === 0) {
        this.setStatus('No dirty chunks to save.');
        return true;
      }

      const bundle = createDirtyChunkBundle(this.getSerializableMap(), dirtyChunks, {
        chunkSize: EDITOR_CHUNK_SIZE,
        originChunkX: this.loadedChunkWindow?.originChunkX ?? 0,
        originChunkY: this.loadedChunkWindow?.originChunkY ?? 0,
        regionId: this.loadedChunkWindow?.regionId ?? this.regionId,
        sourceMapId: this.loadedChunkWindow?.sourceMapId,
        worldId: this.loadedChunkWindow?.worldId ?? this.worldId,
      });

      if (this.loadedChunkWindow?.sourceType === 'world') {
        const result = await saveWorldChunksToProject(bundle);
        if (result.verifiedChunkCount !== result.savedChunkCount) {
          throw new Error(`Saved ${result.savedChunkCount} chunk(s), but only ${result.verifiedChunkCount} verified on disk.`);
        }
        this.loadedChunkWindow.occupiedChunks = new Set([
          ...this.loadedChunkWindow.occupiedChunks,
          ...bundle.chunks.map((chunk) => `${chunk.chunkX},${chunk.chunkY}`),
        ]);
        this.lastSaveSnapshot = {
          savedAt: new Date(),
          savedChunkCount: result.savedChunkCount,
          target: 'project-world',
          worldId: result.worldId,
        };
        this.dirtyChunks.clear();
        this.updateInfoText();
        this.setStatus(`Saved and verified ${result.savedChunkCount} chunk(s) to ${result.worldId}.`);
        return true;
      }

      const record = await saveDirtyChunkBundleToProjectLibrary(bundle);
      this.lastSaveSnapshot = {
        savedAt: new Date(),
        savedChunkCount: record.chunkCount,
        target: 'chunk-library',
        worldId: bundle.worldId,
      };
      this.dirtyChunks.clear();
      this.updateInfoText();
      this.setStatus(withCacheMessage(`Saved ${record.chunkCount} dirty chunk(s) to project chunk library.`));
      return true;
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : 'Dirty chunk save failed.');
      return false;
    }
  }

  private async openChunkLibrary(): Promise<void> {
    this.libraryPanel.showChunks(await listSavedChunkBundlesFromProjectLibrary(), {
      onDelete: (recordId) => {
        deleteSavedChunkBundle(recordId);
        void this.openChunkLibrary();
      },
      onLoad: (recordId) => this.loadChunksFromLibrary(recordId),
    });
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
      this.libraryPanel.close();
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

    const worlds = await listProjectWorlds();

    select.innerHTML = '';
    for (const world of worlds) {
      const option = document.createElement('option');
      option.value = `world:${world.worldId}`;
      option.textContent = `${world.displayName} (${world.authoredChunkCount} authored)`;
      select.appendChild(option);
    }

    if (select.options.length === 0) {
      const option = document.createElement('option');
      option.value = 'world:the_wake';
      option.textContent = 'The Wake world chunks';
      select.appendChild(option);
    }

    select.value = this.loadedChunkWindow?.sourceType === 'world'
      ? this.loadedChunkWindow.sourceRecordId
      : `world:${this.worldId}`;
    chunkX.value = String(this.loadedChunkWindow?.originChunkX ?? 0);
    chunkY.value = String(this.loadedChunkWindow?.originChunkY ?? 0);
    radius.value = '0';
    if (worldIdInput) worldIdInput.value = this.worldId;
    if (regionIdInput) regionIdInput.value = this.regionId;
    panel.classList.remove('editor-hidden');
  }

  private hideChunkWindowPanel(): void {
    document.getElementById('ed-chunk-window')?.classList.add('editor-hidden');
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

      const worldId = recordId.startsWith('world:') ? recordId.slice('world:'.length) : this.worldId;
      void this.loadWorldChunkWindowFromProject(worldId || this.worldId, centerChunkX, centerChunkY, radius);
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : 'Chunk window load failed.');
    }
  }

  private async loadWorldChunkWindowFromProject(
    worldId: string,
    centerChunkX: number,
    centerChunkY: number,
    radius: number,
  ): Promise<boolean> {
    try {
      const result = await loadEditorWorldChunkWindow({
        centerChunkX,
        centerChunkY,
        fallbackPaint: this.terrainTool.getSelectedPaint(),
        radius,
        worldId,
      });

      if (result.manifest.chunkSize !== EDITOR_CHUNK_SIZE) {
        throw new Error(
          `World "${worldId}" uses chunk size ${result.manifest.chunkSize}, but the editor expects ${EDITOR_CHUNK_SIZE}.`,
        );
      }

      this.map = result.map;
      this.worldId = result.manifest.worldId;
      this.regionId = result.regionId;
      this.lastSaveSnapshot = null;
      this.loadedChunkWindow = {
        chunkSize: result.manifest.chunkSize,
        loadedChunks: result.loadedChunkKeys,
        occupiedChunks: result.authoredChunkKeys,
        originChunkX: result.originChunkX,
        originChunkY: result.originChunkY,
        regionId: result.regionId,
        sourceDisplayName: result.manifest.displayName,
        sourceMapId: result.manifest.worldId,
        sourceRecordId: `world:${result.manifest.worldId}`,
        sourceType: 'world',
        worldId: result.manifest.worldId,
      };
      this.history.clear();
      this.dirtyChunks.clear();
      this.hoverTile = null;
      this.persistWorkingDraft();
      this.centerCameraOnMap();
      await this.applyMapCustomDefinitions();
      this.palette?.refresh(
        this.terrainTool.getSelectedBrush(),
        this.objectTool.getSelectedDefinition().id,
      );
      this.redrawTerrain();
      this.redrawObjects();
      this.redrawOverlay();
      this.updateInfoText();
      this.hideChunkWindowPanel();
      const endChunkX = result.originChunkX + Math.ceil(result.map.width / result.manifest.chunkSize) - 1;
      const endChunkY = result.originChunkY + Math.ceil(result.map.height / result.manifest.chunkSize) - 1;
      this.setStatus(
        `Loaded ${result.manifest.displayName} chunks ` +
        `${result.originChunkX},${result.originChunkY}-${endChunkX},${endChunkY}.`,
      );
      return true;
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : 'World chunk window load failed.');
      return false;
    }
  }

  private async openWorldPanel(): Promise<void> {
    const panel = document.getElementById('ed-world-panel');
    const select = document.getElementById('ed-world-select') as HTMLSelectElement | null;
    const centerX = document.getElementById('ed-world-open-chunk-x') as HTMLInputElement | null;
    const centerY = document.getElementById('ed-world-open-chunk-y') as HTMLInputElement | null;
    const radius = document.getElementById('ed-world-open-radius') as HTMLInputElement | null;

    if (!panel || !select || !centerX || !centerY || !radius) {
      return;
    }

    const worlds = await listProjectWorlds();
    select.innerHTML = '';
    for (const world of worlds) {
      const option = document.createElement('option');
      option.value = world.worldId;
      option.textContent = `${world.displayName} (${world.worldId})`;
      select.appendChild(option);
    }

    select.value = worlds.some((world) => world.worldId === this.worldId)
      ? this.worldId
      : worlds[0]?.worldId ?? 'the_wake';
    centerX.value = String(this.loadedChunkWindow?.originChunkX ?? 0);
    centerY.value = String(this.loadedChunkWindow?.originChunkY ?? 0);
    radius.value = '0';
    setInputValue('ed-world-create-name', 'New Dungeon');
    this.updateGeneratedWorldCreateFields();
    panel.classList.remove('editor-hidden');
  }

  private hideWorldPanel(): void {
    document.getElementById('ed-world-panel')?.classList.add('editor-hidden');
  }

  private openWorldFromPanel(): void {
    const select = document.getElementById('ed-world-select') as HTMLSelectElement | null;
    const centerX = document.getElementById('ed-world-open-chunk-x') as HTMLInputElement | null;
    const centerY = document.getElementById('ed-world-open-chunk-y') as HTMLInputElement | null;
    const radius = document.getElementById('ed-world-open-radius') as HTMLInputElement | null;

    if (!select || !centerX || !centerY || !radius) {
      return;
    }

    void this.loadWorldChunkWindowFromProject(
      select.value || this.worldId,
      parseIntegerInput(centerX.value, 0),
      parseIntegerInput(centerY.value, 0),
      Math.max(0, parseIntegerInput(radius.value, 0)),
    ).then((loaded) => {
      if (loaded) this.hideWorldPanel();
    });
  }

  private async createWorldFromPanel(): Promise<void> {
    try {
      this.updateGeneratedWorldCreateFields();
      const displayName = getInputValue('ed-world-create-name', 'New Dungeon');
      const worldId = slugifyMapId(displayName);
      const regionId = createDefaultRegionId(worldId);
      const regionName = createDefaultRegionName(displayName);
      const defaultTerrain = getSelectValue('ed-world-create-terrain', 'grass') as TerrainFamily;
      const widthChunks = Math.max(1, parseIntegerInput(getInputValue('ed-world-create-width', '1'), 1));
      const heightChunks = Math.max(1, parseIntegerInput(getInputValue('ed-world-create-height', '1'), 1));
      const spawnChunkX = parseIntegerInput(getInputValue('ed-world-create-spawn-chunk-x', '0'), 0);
      const spawnChunkY = parseIntegerInput(getInputValue('ed-world-create-spawn-chunk-y', '0'), 0);
      const spawnTileX = parseIntegerInput(getInputValue('ed-world-create-spawn-tile-x', '16'), 16);
      const spawnTileY = parseIntegerInput(getInputValue('ed-world-create-spawn-tile-y', '16'), 16);

      await createWorldManifestInProject({
        bounds: {
          minChunkX: 0,
          minChunkY: 0,
          maxChunkX: widthChunks - 1,
          maxChunkY: heightChunks - 1,
        },
        chunkSize: EDITOR_CHUNK_SIZE,
        defaultTerrain,
        defaultWalkable: defaultTerrain !== 'water',
        displayName,
        regionId,
        regionName,
        spawnChunkX,
        spawnChunkY,
        spawnTileX,
        spawnTileY,
        worldId,
      });
      this.setStatus(`Created ${displayName}. Opening chunk ${spawnChunkX},${spawnChunkY}.`);
      const loaded = await this.loadWorldChunkWindowFromProject(worldId, spawnChunkX, spawnChunkY, 0);
      if (loaded) this.hideWorldPanel();
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : 'World creation failed.');
    }
  }

  private bindWorldCreateNameGenerator(): void {
    const displayNameInput = document.getElementById('ed-world-create-name') as HTMLInputElement | null;
    displayNameInput?.addEventListener('input', () => this.updateGeneratedWorldCreateFields());
  }

  private updateGeneratedWorldCreateFields(): void {
    const displayName = getInputValue('ed-world-create-name', 'New Dungeon');
    const worldId = slugifyMapId(displayName);
    setInputValue('ed-world-create-id', worldId);
    setInputValue('ed-world-create-region-id', createDefaultRegionId(worldId));
    setInputValue('ed-world-create-region-name', createDefaultRegionName(displayName));
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
    panel.classList.remove('editor-hidden');
    widthInput.focus();
    widthInput.select();
  }

  private hideResizePanel(): void {
    document.getElementById('ed-resize')?.classList.add('editor-hidden');
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

  private async testMapInGame(): Promise<void> {
    try {
      if (this.loadedChunkWindow?.sourceType === 'world') {
        const saved = await this.saveDirtyChunksToLibrary();
        if (!saved) {
          this.setStatus('Test blocked: save the current world chunks successfully first.');
          return;
        }
        const testSpawn = this.getWorldTestSpawn();
        const manifestUrl = `/data/worlds/${this.loadedChunkWindow.worldId}/world.manifest.json`;
        const query = new URLSearchParams({
          worldManifest: manifestUrl,
          spawnId: testSpawn.spawnId,
        });
        window.open(`/index.html?${query.toString()}`, '_blank', 'noopener,noreferrer');
        this.setStatus(`Testing ${this.loadedChunkWindow.sourceDisplayName} at ${testSpawn.label}.`);
        return;
      }

      await this.mapIo.publishToGame(this.getSerializableMap());
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

  private getWorldTestSpawn(): ReturnType<typeof resolveEditorWorldTestSpawn> {
    return resolveEditorWorldTestSpawn(this.testSpawnMode, {
      chunkSize: this.loadedChunkWindow?.chunkSize ?? EDITOR_CHUNK_SIZE,
      hoverTile: this.hoverTile,
      mapHeight: this.map.height,
      mapWidth: this.map.width,
      originChunkX: this.loadedChunkWindow?.originChunkX ?? 0,
      originChunkY: this.loadedChunkWindow?.originChunkY ?? 0,
    });
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
    panel.classList.remove('editor-hidden');
    input.focus();
    input.select();
  }

  private hideChunkNamePanel(): void {
    document.getElementById('ed-chunk-name-panel')?.classList.add('editor-hidden');
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


function formatToolModeStatus(mode: EditorToolMode): string {
  switch (mode) {
    case 'elevation':
      return 'Height paint mode.';
    case 'object':
      return 'Object mode.';
    case 'walkability':
      return 'Walkability paint mode.';
    case 'zone':
      return 'Zone paint mode. Left-click to paint, select tag in sidebar.';
    case 'encounter':
      return 'Encounter mode. Left-click an area to select it, then edit spawns in the sidebar.';
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

function createDefaultRegionId(worldId: string): string {
  return `${worldId}_region`;
}

function createDefaultRegionName(displayName: string): string {
  return displayName.trim() || 'New Dungeon';
}

function parseIntegerInput(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseTileKey(key: string): [number, number] {
  const [tileX, tileY] = key.split(',').map((part) => Number.parseInt(part, 10));
  return [Number.isFinite(tileX) ? tileX : -1, Number.isFinite(tileY) ? tileY : -1];
}

function getInputValue(id: string, fallback: string): string {
  const input = document.getElementById(id) as HTMLInputElement | null;
  const value = input?.value.trim();
  return value || fallback;
}

function setInputValue(id: string, value: string): void {
  const input = document.getElementById(id) as HTMLInputElement | null;
  if (input) input.value = value;
}

function getSelectValue(id: string, fallback: string): string {
  const select = document.getElementById(id) as HTMLSelectElement | null;
  return select?.value || fallback;
}

function getFootprintWidth(footprint: ReadonlyArray<{ x: number; y: number }>): number {
  return Math.max(1, ...footprint.map((tile) => tile.x + 1));
}

function getFootprintHeight(footprint: ReadonlyArray<{ x: number; y: number }>): number {
  return Math.max(1, ...footprint.map((tile) => tile.y + 1));
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

function withCacheMessage(message: string): string {
  const cacheMessage = consumeEditorLibraryCacheMessage();
  return cacheMessage ? `${message} ${cacheMessage}` : message;
}
