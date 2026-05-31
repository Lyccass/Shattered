import Phaser from 'phaser';
import {
  createSampleEditorMap,
  type EditorMapDefinition,
} from '../shared/editor/EditorMapModel';
import type { IsoTransformConfig } from '../shared/iso/IsoCoordinates';
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
import { EditorAssetTextureWorkflowController } from './assets/EditorAssetTextureWorkflowController';
import { EditorCustomDefinitionWorkflowController } from './assets/EditorCustomDefinitionWorkflowController';
import { EditorDefinitionPanelController } from './ui/EditorDefinitionPanelController';
import { EditorHudStateController } from './ui/EditorHudStateController';
import { EditorLibraryPanelController } from './ui/EditorLibraryPanelController';
import { EditorEncounterPanelController } from './ui/EditorEncounterPanelController';
import { EditorConnectionPanelController } from './ui/EditorConnectionPanelController';
import { EditorMapStructurePanelController } from './ui/EditorMapStructurePanelController';
import { EditorWorldPanelController } from './ui/EditorWorldPanelController';
import { EditorEncounterToolController } from './encounters/EditorEncounterToolController';
import { EditorNpcToolController } from './npcs/EditorNpcToolController';
import { EditorSceneRenderController } from './rendering/EditorSceneRenderController';
import { EditorMapEditWorkflowController } from './workflow/EditorMapEditWorkflowController';
import { EditorMapDocumentController } from './workflow/EditorMapDocumentController';
import { EditorSelectionWorkflowController } from './workflow/EditorSelectionWorkflowController';
import { EditorTestLaunchController } from './workflow/EditorTestLaunchController';
import { EditorUndoRedoController } from './workflow/EditorUndoRedoController';
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
  private readonly selection = new EditorSelectionWorkflowController(
    this.terrainTool,
    this.objectTool,
    {
      getPalette: () => this.palette,
      redrawOverlay: () => this.redrawOverlay(),
      setStatus: (message) => this.setStatus(message),
      updateInfoText: () => this.updateInfoText(),
    },
  );
  private readonly mapIo = new EditorMapIoController();
  private readonly history = new EditorHistoryStack();
  private readonly assetLibrary = new EditorAssetLibraryController(this, this.terrainTool, this.objectTool);
  private readonly mapDocument = new EditorMapDocumentController(
    this.mapIo,
    this.assetLibrary,
    this.dirtyChunks,
    {
      getMap: () => this.map,
      getRegionId: () => this.regionId,
      getWorldId: () => this.worldId,
      persistWorkingDraft: () => this.persistWorkingDraft(),
      setMap: (map) => { this.map = map; },
      setStatus: (message) => this.setStatus(message),
      updateInfoText: () => this.updateInfoText(),
    },
  );
  private readonly undoRedo = new EditorUndoRedoController(this.history, this.dirtyChunks, {
    getMap: () => this.map,
    persistWorkingDraft: () => this.persistWorkingDraft(),
    redrawObjects: () => this.redrawObjects(),
    redrawOverlay: () => this.redrawOverlay(),
    redrawTerrain: () => this.redrawTerrain(),
    setMap: (map) => { this.map = map; },
    setStatus: (message) => this.setStatus(message),
    updateInfoText: () => this.updateInfoText(),
  });
  private readonly assetTextures = new EditorAssetTextureWorkflowController(
    this,
    this.assetLibrary,
    this.terrainTool,
    TILE_WIDTH,
    TILE_HEIGHT,
    {
      getMap: () => this.map,
      persistWorkingDraft: () => this.persistWorkingDraft(),
      redrawTerrain: () => this.redrawTerrain(),
      setMap: (map) => { this.map = map; },
      updateInfoText: () => this.updateInfoText(),
    },
  );
  private readonly testLaunch = new EditorTestLaunchController(this.mapIo, {
    chunkSize: EDITOR_CHUNK_SIZE,
    getHoverTile: () => this.hoverTile,
    getLoadedChunkWindow: () => this.loadedChunkWindow,
    getMap: () => this.map,
    getSerializableMap: () => this.mapDocument.getSerializableMap(),
    saveDirtyChunks: () => this.chunkPersistence.saveDirtyChunksToLibrary(),
    setStatus: (message) => this.setStatus(message),
  });
  private readonly definitionPanel = new EditorDefinitionPanelController({
    loadTexture: (textureKey, dataUrl) => this.assetTextures.loadDroppedTexture(textureKey, dataUrl),
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
      getTexturePreviewDataUrl: (textureKey) => this.assetTextures.getTexturePreviewDataUrl(textureKey),
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
    getSerializableMap: () => this.mapDocument.getSerializableMap(),
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
  private readonly hudState = new EditorHudStateController(
    this.terrainTool,
    this.objectTool,
    this.npcTool,
    this.encounterTool,
    this.dirtyChunks,
    this.chunkPersistence,
    this.mapEdit,
    this.selection,
    this.testLaunch,
    {
      chunkSize: EDITOR_CHUNK_SIZE,
      getEncounterPanel: () => this.encounterPanel,
      getHoverTile: () => this.hoverTile,
      getHud: () => this.hud,
      getMap: () => this.map,
      getObjectAtTile: (map, tileX, tileY) => this.objectRenderer?.getObjectAtTile(map, tileX, tileY) ?? null,
      getSaveConfidenceTarget: () =>
        this.loadedChunkWindow?.sourceType === 'world' ? 'project-world' : 'chunk-library',
      getTilePaint: (map, tileX, tileY) => this.terrainRenderer?.getTilePaint(map, tileX, tileY) ?? null,
      isTileInBounds: (tileX, tileY) => this.isTileInBounds(tileX, tileY),
    },
  );
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
  private readonly renderBridge = new EditorSceneRenderController(
    this,
    this.transform,
    this.terrainTool,
    this.encounterTool,
    () => this.chunkNameRenderer,
    {
      getChunkOverlayGraphics: () => this.chunkOverlayGraphics,
      getHoverTile: () => this.hoverTile,
      getMap: () => this.map,
      getObjectRenderer: () => this.objectRenderer,
      getOverlayGraphics: () => this.overlayGraphics,
      getTerrainRenderer: () => this.terrainRenderer,
      getToolMode: () => this.selection.getToolMode(),
      getUiCamera: () => this.uiCamera,
      getViewport: () => this.viewport,
      isTileInBounds: (tileX, tileY) => this.isTileInBounds(tileX, tileY),
      setStatus: (message) => this.setStatus(message),
    },
  );

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
      onAdjustBrushSize: (delta) => this.selection.adjustBrushSize(delta),
      onAdjustElevation: (delta) => this.mapEdit.adjustElevation(delta),
      onClearGameMap: () => this.testLaunch.clearPublishedGameMap(),
      onCreateCustomObject: () => this.customDefinitions.createCustomObjectDefinition(),
      onCreateCustomTile: () => this.customDefinitions.createCustomTerrainBrush(),
      onDeleteAllInstances: () => this.customDefinitions.deleteAllInstancesOfSelectedObject(),
      onDeleteCustomObject: () => this.customDefinitions.deleteSelectedCustomObjectDefinition(),
      onDeleteCustomTile: () => this.customDefinitions.deleteSelectedCustomTerrainBrush(),
      onExportDirtyChunks: () => this.chunkPersistence.saveDirtyChunksToLibrary(),
      onExportWorldChunk: () => { void this.mapDocument.exportWorldChunk(); },
      onImportDirtyChunks: () => this.chunkPersistence.openChunkLibrary(),
      onOpenChunkWindow: () => { void this.worldPanel.openChunkWindowPanel(); },
      onOpenConnections: () => { void this.connectionPanel.open(); },
      onOpenPalette: () => this.selection.togglePalette(),
      onOpenWorldPanel: () => { void this.worldPanel.openWorldPanel(); },
      onRedo: () => this.undoRedo.applyRedo(),
      onRenameMap: (displayName) => this.mapDocument.renameMap(displayName),
      onSetTestSpawnMode: (mode) => {
        this.testLaunch.setTestSpawnMode(mode);
        this.updateInfoText();
      },
      onSetWalkabilityBrush: (walkable) => this.mapEdit.setWalkabilityBrush(walkable),
      onSetMode: (mode) => this.selection.setToolMode(mode as EditorToolMode),
      onSetZoneTag: (tag) => this.mapEdit.setZoneTag(tag),
      onSetNpcDefinitionId: (id) => this.npcTool.setSelectedDefinitionId(id),
      onPlaceNpcAtHover: () => this.npcTool.placeAtHover(),
      onRemoveNpcAtHover: () => this.npcTool.removeAtHover(),
      onTestInGame: () => this.testLaunch.testMapInGame(),
      onResizeMap: () => this.mapStructurePanel.openResizePanel(),
      onUndo: () => this.undoRedo.applyUndo(),
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
        onSelectBrush: (brush) => this.selection.selectBrushById(brush.id),
        onSelectObject: (def) => this.selection.selectObjectById(def.id),
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
    this.renderBridge.ignoreWorldObjectsForUiCamera();
    this.terrainRenderer?.setUiCamera(this.uiCamera);
    this.objectRenderer?.setUiCamera(this.uiCamera);
    this.chunkNameRenderer?.setUiCamera(this.uiCamera);

    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.uiCamera?.setSize(gameSize.width, gameSize.height);
    });
  }

  private registerInputController(): void {
    const inputController = new EditorInputController(this, {
      applyPrimaryAction: (pointer) => this.mapEdit.applyHoveredPrimaryAction(pointer, this.selection.getToolMode()),
      adjustBrushSize: (delta) => this.selection.adjustBrushSize(delta),
      beginStroke: () => {
        if (this.selection.getToolMode() === 'encounter') {
          this.encounterTool.beginStroke();
        }
        this.history.beginStroke(this.map);
      },
      centerCameraOnMap: () => this.centerCameraOnMap(),
      cycleSelection: (offset) => this.selection.cycleSelection(offset),
      endStroke: () => {
        if (this.selection.getToolMode() === 'encounter') {
          this.encounterTool.endStroke();
        }
        this.history.endStroke();
      },
      exportDirtyChunks: () => this.chunkPersistence.saveDirtyChunksToLibrary(),
      exportWorldChunk: () => { void this.mapDocument.exportWorldChunk(); },
      flipSelectedBrush: (axis) => this.selection.flipSelectedBrush(axis),
      getToolMode: () => this.selection.getToolMode(),
      importDirtyChunks: () => this.chunkPersistence.openChunkLibrary(),
      isPaletteOpen: () => this.palette?.isVisible() ?? false,
      isPointerPanning: () => this.viewport?.isPanning() ?? false,
      openChunkWindow: () => { void this.worldPanel.openChunkWindowPanel(); },
      redo: () => this.undoRedo.applyRedo(),
      redrawPointerState: () => this.redrawPointerState(),
      removeHoveredObject: () => this.mapEdit.removeHoveredObject(this.selection.getToolMode()),
      renameHoveredChunk: () => this.mapStructurePanel.renameHoveredChunk(),
      resetTerrainStroke: () => this.terrainTool.resetStroke(),
      resizeMap: () => this.mapStructurePanel.openResizePanel(),
      selectBrushForFamily: (family) => this.selection.selectBrushForFamily(family),
      setToolMode: (mode) => this.selection.setToolMode(mode),
      startPointerPan: (pointer) => this.viewport?.startPointerPan(pointer),
      stopPointerPan: () => this.viewport?.stopPointerPan(),
      togglePalette: () => this.selection.togglePalette(),
      undo: () => this.undoRedo.applyUndo(),
      updateHoverFromPointer: (pointer) => {
        this.hoverTile = this.renderBridge.getTileFromPointer(pointer);
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

  private commitEditorToolChange(): void {
    this.redrawOverlay();
    this.updateInfoText();
    this.persistWorkingDraft();
  }

  private redrawTerrain(): void {
    this.renderBridge.redrawTerrain();
  }

  private redrawObjects(): void {
    this.renderBridge.redrawObjects();
  }

  private redrawOverlay(): void {
    this.renderBridge.redrawOverlay();
  }

  private updateInfoText(): void {
    this.hudState.updateInfoText();
  }

  private persistWorkingDraft(): void {
    this.worldLoad.persistWorkingDraft();
  }

  private async applyMapCustomDefinitions(): Promise<void> {
    await this.assetTextures.applyMapCustomDefinitions();
  }

  private centerCameraOnMap(): void {
    this.renderBridge.centerCameraOnMap();
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

}
