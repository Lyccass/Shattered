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
    this.overlayGraphics = this.add.graphics();
    this.chunkOverlayGraphics = this.add.graphics();
    this.hud = new EditorHudController(this);
    this.hud.create(this.terrainTool.getSelectedBrush());
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
    const uiObjects = this.hud?.getObjects() ?? [];

    this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height)
      .setScroll(0, 0)
      .setZoom(1);
    this.cameras.main.ignore(uiObjects);
    this.ignoreWorldObjectsForUiCamera();
    this.terrainRenderer?.setUiCamera(this.uiCamera);
    this.objectRenderer?.setUiCamera(this.uiCamera);

    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.uiCamera?.setSize(gameSize.width, gameSize.height);
    });
  }

  private registerInputController(): void {
    const inputController = new EditorInputController(this, {
      applyPrimaryAction: (pointer) => this.applyHoveredPrimaryAction(pointer),
      centerCameraOnMap: () => this.centerCameraOnMap(),
      cycleSelection: (offset) => this.cycleSelection(offset),
      exportMap: () => { void this.exportMap(); },
      exportWorldChunk: () => { void this.exportWorldChunk(); },
      flipSelectedBrush: (axis) => this.flipSelectedBrush(axis),
      getToolMode: () => this.toolMode,
      importMap: () => this.importMap(),
      isPointerPanning: () => this.viewport?.isPanning() ?? false,
      redrawPointerState: () => this.redrawPointerState(),
      removeHoveredObject: () => this.removeHoveredObject(),
      resetTerrainStroke: () => this.terrainTool.resetStroke(),
      resizeMap: () => this.promptResizeMap(),
      selectBrushForFamily: (family) => this.selectBrushForFamily(family),
      setToolMode: (mode) => this.setToolMode(mode),
      startPointerPan: (pointer) => this.viewport?.startPointerPan(pointer),
      stopPointerPan: () => this.viewport?.stopPointerPan(),
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
    this.updateInfoText();
    this.setStatus(`Selected ${selectedBrush.label}. Use Q/E or [/] to choose a specific tile.`);
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
    this.updateInfoText();
    this.setStatus(`Selected tile ${selectedBrush.label}.`);
  }

  private flipSelectedBrush(axis: 'x' | 'y'): void {
    this.terrainTool.flip(axis);
    this.updateInfoText();
    this.setStatus(axis === 'x' ? 'Selected brush flipped left/right.' : 'Selected brush flipped up/down.');
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
    if (!this.terrainTool.paintTile(this.map, tileX, tileY)) {
      return;
    }

    this.terrainRenderer?.renderChunksAroundTile(this.map, tileX, tileY);
    this.dirtyChunks.markTileDirty(tileX, tileY);
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

    const points = getTileDiamondPoints(this.transform, this.hoverTile.x, this.hoverTile.y)
      .map((point) => new Phaser.Geom.Point(point.x, point.y));

    graphics.setDepth(9_000);
    graphics.fillStyle(0xfacc15, 0.22);
    graphics.fillPoints(points, true);
    graphics.lineStyle(2, 0xf8fafc, 0.95);
    graphics.strokePoints(points, true);
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
    const selectedBrush = this.terrainTool.getSelectedBrush();
    const selectedObjectDefinition = this.objectTool.getSelectedDefinition();

    this.hud.update({
      hover: {
        family: hoverFamily,
        objectDefinitionId: hoverObject?.definitionId ?? null,
        paint: hoverPaint,
        tile: hover,
      },
      dirtyChunks: this.dirtyChunks.getSummary(),
      map: this.map,
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

  private centerCameraOnMap(): void {
    this.viewport?.centerOnMap(this.map.width, this.map.height);
    this.setStatus('Camera centered on map.');
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
