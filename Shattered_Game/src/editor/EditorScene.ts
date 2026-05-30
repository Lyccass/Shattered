import Phaser from 'phaser';
import {
  createSampleEditorMap,
  getEditorTerrainElevationAt,
  getEditorTerrainAt,
  getEditorTerrainZoneAt,
  type EditorMapDefinition,
  getEditorTerrainWalkabilityAt,
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
import { EditorChunkPersistenceController } from './chunks/EditorChunkPersistenceController';
import { EditorMapIoController } from './io/EditorMapIoController';
import { EditorInputController, type EditorToolMode } from './input/EditorInputController';
import { EditorViewportController } from './viewport/EditorViewportController';
import { EditorChunkNameRenderer } from './chunks/EditorChunkNameRenderer';
import { EditorTilePaletteController } from './ui/EditorTilePaletteController';
import { EditorHistoryStack } from './EditorHistoryStack';
import { EditorAssetLibraryController } from './assets/EditorAssetLibraryController';
import { EditorCustomDefinitionWorkflowController } from './assets/EditorCustomDefinitionWorkflowController';
import { loadImageFromDataUrl } from './assets/EditorDefinitionImage';
import { EditorDefinitionPanelController } from './ui/EditorDefinitionPanelController';
import { EditorLibraryPanelController } from './ui/EditorLibraryPanelController';
import { EditorEncounterPanelController } from './ui/EditorEncounterPanelController';
import { EditorConnectionPanelController } from './ui/EditorConnectionPanelController';
import { EditorMapStructurePanelController } from './ui/EditorMapStructurePanelController';
import { EditorWorldPanelController } from './ui/EditorWorldPanelController';
import { EditorEncounterToolController } from './encounters/EditorEncounterToolController';
import { EditorNpcToolController } from './npcs/EditorNpcToolController';
import { drawEditorOverlay } from './overlays/EditorOverlayRenderer';
import { EditorMapEditWorkflowController } from './workflow/EditorMapEditWorkflowController';
import { createSaveConfidenceState } from './workflow/EditorSaveConfidence';
import { EditorTestLaunchController } from './workflow/EditorTestLaunchController';
import {
  EditorWorldLoadController,
  type LoadedChunkWindowContext,
} from './workflow/EditorWorldLoadController';

const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;
const MAP_ORIGIN_X = 760;
const MAP_ORIGIN_Y = 80;
const CAMERA_PAN_SPEED = 620;
const MIN_CAMERA_ZOOM = 0.45;
const MAX_CAMERA_ZOOM = 2.2;
const ZOOM_STEP = 0.12;

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
  private readonly mapEdit = new EditorMapEditWorkflowController(
    this.terrainTool,
    this.objectTool,
    {
      getHoverTile: () => this.hoverTile,
      getMap: () => this.map,
      markTileDirty: (tileX, tileY) => this.dirtyChunks.markTileDirty(tileX, tileY),
      persistWorkingDraft: () => this.persistWorkingDraft(),
      placeNpcAtHover: () => this.npcTool.placeAtHover(),
      redrawObjects: () => this.redrawObjects(),
      redrawOverlay: () => this.redrawOverlay(),
      removeNpcAtHover: () => this.npcTool.removeAtHover(),
      renderChunksAroundTile: (map, tileX, tileY) => this.terrainRenderer?.renderChunksAroundTile(map, tileX, tileY),
      setMap: (map) => { this.map = map; },
      setStatus: (message) => this.setStatus(message),
      snapshot: (map) => this.history.snapshot(map),
      updateInfoText: () => this.updateInfoText(),
    },
  );
  private readonly mapIo = new EditorMapIoController();
  private readonly history = new EditorHistoryStack();
  private readonly assetLibrary = new EditorAssetLibraryController(this, this.terrainTool, this.objectTool);
  private readonly testLaunch = new EditorTestLaunchController(this.mapIo, {
    chunkSize: EDITOR_CHUNK_SIZE,
    getHoverTile: () => this.hoverTile,
    getLoadedChunkWindow: () => this.loadedChunkWindow,
    getMap: () => this.map,
    getSerializableMap: () => this.getSerializableMap(),
    saveDirtyChunks: () => this.chunkPersistence.saveDirtyChunksToLibrary(),
    setStatus: (message) => this.setStatus(message),
  });
  private readonly definitionPanel = new EditorDefinitionPanelController({
    loadTexture: (textureKey, dataUrl) => this.loadDroppedTexture(textureKey, dataUrl),
    setStatus: (message) => this.setStatus(message),
  });
  private readonly customDefinitions = new EditorCustomDefinitionWorkflowController(
    this.terrainTool,
    this.objectTool,
    this.assetLibrary,
    this.definitionPanel,
    () => this.palette,
    {
      getMap: () => this.map,
      getTexturePreviewDataUrl: (textureKey) => this.getTexturePreviewDataUrl(textureKey),
      markAllChunksDirty: (width, height) => this.dirtyChunks.markAllChunksDirty(width, height),
      persistWorkingDraft: () => this.persistWorkingDraft(),
      redrawObjects: () => this.redrawObjects(),
      redrawOverlay: () => this.redrawOverlay(),
      redrawTerrain: () => this.redrawTerrain(),
      setMap: (map) => { this.map = map; },
      setStatus: (message) => this.setStatus(message),
      snapshot: (map) => this.history.snapshot(map),
      updateInfoText: () => this.updateInfoText(),
    },
  );
  private readonly libraryPanel = new EditorLibraryPanelController();
  private readonly chunkPersistence = new EditorChunkPersistenceController(this.libraryPanel, {
    chunkSize: EDITOR_CHUNK_SIZE,
    applyMapCustomDefinitions: () => this.applyMapCustomDefinitions(),
    clearDirtyChunks: () => this.dirtyChunks.clear(),
    getDirtyChunks: () => this.dirtyChunks.getDirtyChunks(),
    getLoadedChunkWindow: () => this.loadedChunkWindow,
    getMap: () => this.map,
    getRegionId: () => this.regionId,
    getSerializableMap: () => this.getSerializableMap(),
    getWorldId: () => this.worldId,
    persistWorkingDraft: () => this.persistWorkingDraft(),
    redrawObjects: () => this.redrawObjects(),
    redrawOverlay: () => this.redrawOverlay(),
    redrawTerrain: () => this.redrawTerrain(),
    setMap: (map) => { this.map = map; },
    setStatus: (message) => this.setStatus(message),
    snapshot: (map) => this.history.snapshot(map),
    updateInfoText: () => this.updateInfoText(),
  });
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
  private readonly mapStructurePanel = new EditorMapStructurePanelController({
    chunkSize: EDITOR_CHUNK_SIZE,
    clearHoverTile: () => { this.hoverTile = null; },
    getHoverTile: () => this.hoverTile,
    getLoadedChunkWindow: () => this.loadedChunkWindow,
    getMap: () => this.map,
    getSelectedTerrainPaint: () => this.terrainTool.getSelectedPaint(),
    markAllChunksDirty: (width, height) => this.dirtyChunks.markAllChunksDirty(width, height),
    markChunkDirty: (chunkX, chunkY) => this.dirtyChunks.markChunkDirty({ chunkX, chunkY }),
    persistWorkingDraft: () => this.persistWorkingDraft(),
    redrawObjects: () => this.redrawObjects(),
    redrawOverlay: () => this.redrawOverlay(),
    redrawTerrain: () => this.redrawTerrain(),
    setChunkName: (chunkX, chunkY, chunkNames) => this.chunkNameRenderer?.setChunkName(chunkX, chunkY, chunkNames),
    setMap: (map) => { this.map = map; },
    setStatus: (message) => this.setStatus(message),
    snapshot: (map) => this.history.snapshot(map),
    updateInfoText: () => this.updateInfoText(),
  });
  private readonly worldLoad = new EditorWorldLoadController({
    applyMapCustomDefinitions: () => this.applyMapCustomDefinitions(),
    centerCameraOnMap: () => this.centerCameraOnMap(),
    chunkSize: EDITOR_CHUNK_SIZE,
    clearDirtyChunks: () => this.dirtyChunks.clear(),
    clearHoverTile: () => { this.hoverTile = null; },
    clearHistory: () => this.history.clear(),
    clearSaveSnapshot: () => this.chunkPersistence.clearLastSaveSnapshot(),
    getFallbackPaint: () => this.terrainTool.getSelectedPaint(),
    getMap: () => this.map,
    getSelectedObjectDefinitionId: () => this.objectTool.getSelectedDefinition().id,
    getSelectedTerrainBrush: () => this.terrainTool.getSelectedBrush(),
    hideChunkWindowPanel: () => this.worldPanel.hideChunkWindowPanel(),
    markAllChunksDirty: (width, height) => this.dirtyChunks.markAllChunksDirty(width, height),
    redrawObjects: () => this.redrawObjects(),
    redrawOverlay: () => this.redrawOverlay(),
    redrawTerrain: () => this.redrawTerrain(),
    refreshPalette: (terrainBrush, objectDefinitionId) => this.palette?.refresh(terrainBrush, objectDefinitionId),
    setLoadedChunkWindow: (window) => { this.loadedChunkWindow = window; },
    setMap: (map) => { this.map = map; },
    setRegionId: (regionId) => { this.regionId = regionId; },
    setStatus: (message) => this.setStatus(message),
    setWorldId: (worldId) => { this.worldId = worldId; },
    updateInfoText: () => this.updateInfoText(),
  });
  private readonly worldPanel = new EditorWorldPanelController({
    chunkSize: EDITOR_CHUNK_SIZE,
    getLoadedChunkWindow: () => this.loadedChunkWindow,
    getRegionId: () => this.regionId,
    getWorldId: () => this.worldId,
    loadWorldChunkWindow: (worldId, centerChunkX, centerChunkY, radius) =>
      this.worldLoad.loadWorldChunkWindowFromProject(worldId, centerChunkX, centerChunkY, radius),
    setRegionId: (regionId) => { this.regionId = regionId; },
    setStatus: (message) => this.setStatus(message),
    setWorldId: (worldId) => { this.worldId = worldId; },
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
  private toolMode: EditorToolMode = 'terrain';
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
      .then(() => this.worldLoad.restoreWorkingDraft());
    this.hud = new EditorHudController(this, {
      onAdjustBrushSize: (delta) => this.adjustBrushSize(delta),
      onAdjustElevation: (delta) => this.mapEdit.adjustElevation(delta),
      onClearGameMap: () => this.testLaunch.clearPublishedGameMap(),
      onCreateCustomObject: () => this.customDefinitions.createCustomObjectDefinition(),
      onCreateCustomTile: () => this.customDefinitions.createCustomTerrainBrush(),
      onDeleteAllInstances: () => this.customDefinitions.deleteAllInstancesOfSelectedObject(),
      onDeleteCustomObject: () => this.customDefinitions.deleteSelectedCustomObjectDefinition(),
      onDeleteCustomTile: () => this.customDefinitions.deleteSelectedCustomTerrainBrush(),
      onExportDirtyChunks: () => this.chunkPersistence.saveDirtyChunksToLibrary(),
      onExportWorldChunk: () => { void this.exportWorldChunk(); },
      onImportDirtyChunks: () => this.chunkPersistence.openChunkLibrary(),
      onOpenChunkWindow: () => { void this.worldPanel.openChunkWindowPanel(); },
      onOpenConnections: () => { void this.connectionPanel.open(); },
      onOpenPalette: () => this.togglePalette(),
      onOpenWorldPanel: () => { void this.worldPanel.openWorldPanel(); },
      onRedo: () => this.applyRedo(),
      onRenameMap: (displayName) => this.renameMap(displayName),
      onSetTestSpawnMode: (mode) => {
        this.testLaunch.setTestSpawnMode(mode);
        this.updateInfoText();
      },
      onSetWalkabilityBrush: (walkable) => this.mapEdit.setWalkabilityBrush(walkable),
      onSetMode: (mode) => this.setToolMode(mode as EditorToolMode),
      onSetZoneTag: (tag) => this.mapEdit.setZoneTag(tag),
      onSetNpcDefinitionId: (id) => this.npcTool.setSelectedDefinitionId(id),
      onPlaceNpcAtHover: () => this.npcTool.placeAtHover(),
      onRemoveNpcAtHover: () => this.npcTool.removeAtHover(),
      onTestInGame: () => this.testLaunch.testMapInGame(),
      onResizeMap: () => this.mapStructurePanel.openResizePanel(),
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
    this.connectionPanel.bindEvents();
    this.mapStructurePanel.bindEvents();
    this.worldPanel.bindEvents();
    void draftRestorePromise.then(async (restored) => {
      if (!restored && await this.worldLoad.loadWorldChunkWindowFromProject('the_wake', 0, 0, 0)) {
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
      applyPrimaryAction: (pointer) => this.mapEdit.applyHoveredPrimaryAction(pointer, this.toolMode),
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
      exportDirtyChunks: () => this.chunkPersistence.saveDirtyChunksToLibrary(),
      exportWorldChunk: () => { void this.exportWorldChunk(); },
      flipSelectedBrush: (axis) => this.flipSelectedBrush(axis),
      getToolMode: () => this.toolMode,
      importDirtyChunks: () => this.chunkPersistence.openChunkLibrary(),
      isPaletteOpen: () => this.palette?.isVisible() ?? false,
      isPointerPanning: () => this.viewport?.isPanning() ?? false,
      openChunkWindow: () => { void this.worldPanel.openChunkWindowPanel(); },
      redo: () => this.applyRedo(),
      redrawPointerState: () => this.redrawPointerState(),
      removeHoveredObject: () => this.mapEdit.removeHoveredObject(this.toolMode),
      renameHoveredChunk: () => this.mapStructurePanel.renameHoveredChunk(),
      resetTerrainStroke: () => this.terrainTool.resetStroke(),
      resizeMap: () => this.mapStructurePanel.openResizePanel(),
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

  private commitEditorToolChange(): void {
    this.redrawOverlay();
    this.updateInfoText();
    this.persistWorkingDraft();
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
      selectedElevation: this.mapEdit.getSelectedElevation(),
      selectedWalkable: this.mapEdit.getSelectedWalkable(),
      selectedZoneTag: this.mapEdit.getSelectedZoneTag(),
      selectedObjectDisplayName: selectedObjectDefinition.displayName,
      saveConfidence: createSaveConfidenceState(
        this.dirtyChunks.getDirtyChunks(),
        this.chunkPersistence.getLastSaveSnapshot(),
        this.loadedChunkWindow?.sourceType === 'world' ? 'project-world' : 'chunk-library',
      ),
      testSpawnLabel: this.testLaunch.getWorldTestSpawn().label,
      testSpawnMode: this.testLaunch.getTestSpawnMode(),
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

  private persistWorkingDraft(): void {
    this.worldLoad.persistWorkingDraft();
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
