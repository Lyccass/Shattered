import Phaser from 'phaser';
import {
  createSampleEditorMap,
  getEditorTerrainAt,
  type EditorMapDefinition,
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
import { EditorMapIoController } from './io/EditorMapIoController';
import { EditorInputController, type EditorToolMode } from './input/EditorInputController';
import { EditorViewportController } from './viewport/EditorViewportController';
import { EditorChunkNameRenderer } from './chunks/EditorChunkNameRenderer';
import { EditorTilePaletteController } from './ui/EditorTilePaletteController';

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
  private readonly mapIo = new EditorMapIoController();
  private map: EditorMapDefinition = createSampleEditorMap(this.terrainTool.getSelectedPaint());
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
  private toolMode: EditorToolMode = 'terrain';

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
    this.hud = new EditorHudController(this, {
      onAdjustBrushSize: (delta) => this.adjustBrushSize(delta),
      onOpenPalette: () => this.togglePalette(),
      onSetMode: (mode) => this.setToolMode(mode as EditorToolMode),
    });
    this.hud.create(this.terrainTool.getSelectedBrush());
    this.palette = new EditorTilePaletteController(
      this,
      this.terrainTool.getCatalog(),
      { onSelectBrush: (brush) => this.selectBrushById(brush.id) },
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
    this.redrawTerrain();
    this.redrawObjects();
    this.centerCameraOnMap();
    this.updateInfoText();
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
      centerCameraOnMap: () => this.centerCameraOnMap(),
      cycleSelection: (offset) => this.cycleSelection(offset),
      exportDirtyChunks: () => { void this.exportDirtyChunks(); },
      exportMap: () => { void this.exportMap(); },
      exportWorldChunk: () => { void this.exportWorldChunk(); },
      flipSelectedBrush: (axis) => this.flipSelectedBrush(axis),
      getToolMode: () => this.toolMode,
      importDirtyChunks: () => this.importDirtyChunks(),
      importMap: () => this.importMap(),
      isPaletteOpen: () => this.palette?.isVisible() ?? false,
      isPointerPanning: () => this.viewport?.isPanning() ?? false,
      openMapFromFile: () => { void this.openMapFromFile(); },
      redrawPointerState: () => this.redrawPointerState(),
      removeHoveredObject: () => this.removeHoveredObject(),
      renameHoveredChunk: () => this.renameHoveredChunk(),
      resetTerrainStroke: () => this.terrainTool.resetStroke(),
      resizeMap: () => this.promptResizeMap(),
      saveMapToFile: () => { void this.saveMapToFile(); },
      selectBrushForFamily: (family) => this.selectBrushForFamily(family),
      setToolMode: (mode) => this.setToolMode(mode),
      startPointerPan: (pointer) => this.viewport?.startPointerPan(pointer),
      stopPointerPan: () => this.viewport?.stopPointerPan(),
      togglePalette: () => this.togglePalette(),
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
    this.setStatus(mode === 'terrain' ? 'Terrain mode.' : 'Object mode.');
  }

  private selectBrushForFamily(family: TerrainFamily): void {
    const selectedBrush = this.terrainTool.selectFamily(family);
    this.palette?.updateSelection(selectedBrush);
    this.updateInfoText();
    this.setStatus(`Selected ${selectedBrush.label}. Use Q/E or [/] to choose a specific tile.`);
  }

  private selectBrushById(brushId: string): void {
    const selectedBrush = this.terrainTool.selectById(brushId);
    this.palette?.updateSelection(selectedBrush);
    this.updateInfoText();
    this.setStatus(`Selected tile ${selectedBrush.label}.`);
  }

  private cycleSelection(offset: number): void {
    if (this.toolMode === 'object') {
      const selectedObjectDefinition = this.objectTool.cycle(offset);
      this.updateInfoText();
      this.setStatus(`Selected object ${selectedObjectDefinition.displayName}.`);
      return;
    }

    this.cycleSelectedBrush(offset);
  }

  private cycleSelectedBrush(offset: number): void {
    const selectedBrush = this.terrainTool.cycle(offset);
    this.palette?.updateSelection(selectedBrush);
    this.updateInfoText();
    this.setStatus(`Selected tile ${selectedBrush.label}.`);
  }

  private flipSelectedBrush(axis: 'x' | 'y'): void {
    const selectedBrush = this.terrainTool.flip(axis);
    this.palette?.updateSelection(selectedBrush);
    this.updateInfoText();
    this.setStatus(axis === 'x' ? 'Selected brush flipped left/right.' : 'Selected brush flipped up/down.');
  }

  private togglePalette(): void {
    this.palette?.toggle(this.terrainTool.getSelectedBrush());
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
  }

  private placeHoveredObject(): void {
    if (!this.hoverTile) {
      return;
    }

    this.map = this.objectTool.placeObject(this.map, this.hoverTile.x, this.hoverTile.y);
    this.dirtyChunks.markTileDirty(this.hoverTile.x, this.hoverTile.y);
    this.redrawObjects();
    this.updateInfoText();
  }

  private removeHoveredObject(): void {
    if (!this.hoverTile) {
      return;
    }

    const result = this.objectTool.removeObject(this.map, this.hoverTile.x, this.hoverTile.y);
    this.map = result.map;

    if (result.removed) {
      this.dirtyChunks.markTileDirty(this.hoverTile.x, this.hoverTile.y);
    }

    this.redrawObjects();
    this.updateInfoText();
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

    if (!this.hoverTile || !this.isTileInBounds(this.hoverTile.x, this.hoverTile.y)) {
      return;
    }

    graphics.setDepth(9_000);

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
        family: hoverFamily,
        objectDefinitionId: hoverObject?.definitionId ?? null,
        paint: hoverPaint,
        tile: hover,
      },
      dirtyChunks: this.dirtyChunks.getSummary(),
      map: this.map,
      objectPreviewColor: this.objectTool.getPreviewColor(),
      objectPreviewTextureKey: this.objectTool.getPreviewTextureKey(),
      selectedBrush,
      selectedBrushIndexLabel: this.terrainTool.getSelectedBrushIndexLabel(),
      selectedObjectDisplayName: selectedObjectDefinition.displayName,
      toolMode: this.toolMode,
    });
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
      worldId: 'the_wake',
      regionId: 'editor_region',
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

  private async exportDirtyChunks(): Promise<void> {
    const dirtyChunks = this.dirtyChunks.getDirtyChunks();

    if (dirtyChunks.length === 0) {
      this.setStatus('No dirty chunks to export.');
      return;
    }

    const result = await this.mapIo.exportDirtyChunks(this.map, dirtyChunks, {
      chunkSize: EDITOR_CHUNK_SIZE,
      regionId: 'editor_region',
      worldId: 'the_wake',
    });
    this.dirtyChunks.clear();
    this.updateInfoText();
    this.setStatus(
      result === 'clipboard'
        ? `Dirty chunk bundle copied to clipboard (${dirtyChunks.length} chunks).`
        : `Dirty chunk bundle printed to console (${dirtyChunks.length} chunks).`,
    );
  }

  private importMap(): void {
    try {
      const importedMap = this.mapIo.importFromPrompt();

      if (!importedMap) {
        return;
      }

      this.map = importedMap;
      this.dirtyChunks.clear();
      this.centerCameraOnMap();
      this.redrawTerrain();
      this.redrawObjects();
      this.redrawOverlay();
      this.updateInfoText();
      this.setStatus('Map loaded.');
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : 'Map import failed.');
    }
  }

  private importDirtyChunks(): void {
    try {
      const result = this.mapIo.importDirtyChunksFromPrompt(this.map);

      if (!result) {
        return;
      }

      this.map = result.map;
      this.dirtyChunks.clear();
      this.redrawTerrain();
      this.redrawObjects();
      this.redrawOverlay();
      this.updateInfoText();
      this.setStatus(`Dirty chunk bundle imported (${result.bundle.chunks.length} chunks).`);
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : 'Dirty chunk import failed.');
    }
  }

  private async saveMapToFile(): Promise<void> {
    try {
      const result = await this.mapIo.quickSaveToFile(this.map);

      if (result === 'cancelled') {
        return;
      }

      this.dirtyChunks.clear();
      this.updateInfoText();
      this.setStatus(
        result === 'no-file-api'
          ? 'Map export copied/printed because file save is unavailable.'
          : 'Map saved.',
      );
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : 'Map save failed.');
    }
  }

  private async openMapFromFile(): Promise<void> {
    try {
      const importedMap = await this.mapIo.openFromFile();

      if (!importedMap) {
        return;
      }

      this.map = importedMap;
      this.dirtyChunks.clear();
      this.centerCameraOnMap();
      this.redrawTerrain();
      this.redrawObjects();
      this.redrawOverlay();
      this.updateInfoText();
      this.setStatus('Map loaded from file.');
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : 'Map file open failed.');
    }
  }

  private promptResizeMap(): void {
    try {
      const resizedMap = this.mapIo.resizeFromPrompt(this.map, this.terrainTool.getSelectedPaint());

      if (!resizedMap) {
        return;
      }

      this.map = resizedMap;
      this.hoverTile = null;
      this.dirtyChunks.markAllChunksDirty(this.map.width, this.map.height);
      this.redrawTerrain();
      this.redrawObjects();
      this.redrawOverlay();
      this.updateInfoText();
      this.setStatus(`Map resized to ${this.map.width}x${this.map.height}. New tiles filled with ${this.terrainTool.getSelectedBrush().label}.`);
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : 'Resize failed.');
    }
  }

  private renameHoveredChunk(): void {
    if (!this.hoverTile) {
      this.setStatus('Hover a chunk before renaming it.');
      return;
    }

    const chunk = this.getChunkInfo(this.hoverTile.x, this.hoverTile.y);
    const nextName = window.prompt(
      `Name chunk ${chunk.chunkX},${chunk.chunkY}`,
      chunk.chunkName,
    );

    if (nextName === null) {
      return;
    }

    const key = `${chunk.chunkX},${chunk.chunkY}`;
    const chunkNames = { ...(this.map.chunkNames ?? {}) };
    const trimmed = nextName.trim();

    if (trimmed) {
      chunkNames[key] = trimmed;
    } else {
      delete chunkNames[key];
    }

    this.map = {
      ...this.map,
      chunkNames,
    };
    this.chunkNameRenderer?.setChunkName(chunk.chunkX, chunk.chunkY, chunkNames);
    this.dirtyChunks.markChunkDirty({ chunkX: chunk.chunkX, chunkY: chunk.chunkY });
    this.updateInfoText();
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
