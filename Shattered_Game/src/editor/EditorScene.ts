import Phaser from 'phaser';
import {
  addEditorPlacedObject,
  createSampleEditorMap,
  getEditorTerrainAt,
  paintTerrainTile,
  removeEditorPlacedObjectsAtTile,
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
  createEditorTerrainCatalog,
  getBrushAtOffset,
  getDefaultBrushForFamily,
  withBrushFlip,
  type EditorTerrainBrush,
} from './terrain/EditorTerrainCatalog';
import {
  EditorTerrainChunkRenderer,
  toPaint,
} from './terrain/EditorTerrainChunkRenderer';
import { EditorHudController } from './ui/EditorHudController';
import {
  createEditorObjectCatalog,
  getObjectAtOffset,
} from './objects/EditorObjectCatalog';
import { EditorObjectLayerRenderer } from './objects/EditorObjectLayerRenderer';
import { EditorMapIoController } from './io/EditorMapIoController';
import { EditorViewportController } from './viewport/EditorViewportController';

const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;
const MAP_ORIGIN_X = 760;
const MAP_ORIGIN_Y = 80;
const CAMERA_PAN_SPEED = 620;
const MIN_CAMERA_ZOOM = 0.45;
const MAX_CAMERA_ZOOM = 2.2;
const ZOOM_STEP = 0.12;

const BRUSH_KEYS: Record<string, TerrainFamily> = {
  Digit1: 'grass',
  Digit2: 'dirt',
  Digit3: 'stone',
  Digit4: 'water',
  Digit5: 'sand',
};

type EditorToolMode = 'terrain' | 'object';

export class EditorScene extends Phaser.Scene {
  private readonly terrainCatalog = createEditorTerrainCatalog();
  private readonly objectCatalog = createEditorObjectCatalog();
  private readonly mapIo = new EditorMapIoController();
  private selectedBrush: EditorTerrainBrush = getDefaultBrushForFamily(this.terrainCatalog, 'grass');
  private selectedObjectDefinition = this.objectCatalog.all[0];
  private map: EditorMapDefinition = createSampleEditorMap(toPaint(this.selectedBrush));
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
  private lastPaintedTileKey?: string;

  preload(): void {
    preloadTerrainAssets(this);
    preloadObjectAssets(this);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#07111f');
    this.input.mouse?.disableContextMenu();
    createTerrainRenderTextures(this);

    this.terrainRenderer = new EditorTerrainChunkRenderer(this, this.transform, this.terrainCatalog);
    this.objectRenderer = new EditorObjectLayerRenderer(this, this.transform, this.objectCatalog);
    this.overlayGraphics = this.add.graphics();
    this.chunkOverlayGraphics = this.add.graphics();
    this.hud = new EditorHudController(this);
    this.hud.create(this.selectedBrush);
    this.viewport = new EditorViewportController(this, {
      maxZoom: MAX_CAMERA_ZOOM,
      minZoom: MIN_CAMERA_ZOOM,
      panSpeed: CAMERA_PAN_SPEED,
      transform: this.transform,
      zoomStep: ZOOM_STEP,
      onZoomChanged: () => this.updateInfoText(),
    });

    this.createUiCamera();
    this.registerInput();
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

  private registerInput(): void {
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.viewport?.updatePointerPan(pointer);
      this.hoverTile = this.getTileFromPointer(pointer);

      if (pointer.leftButtonDown() && !this.viewport?.isPanning()) {
        this.applyHoveredPrimaryAction(pointer);
      }

      this.redrawOverlay();
      this.updateInfoText();
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.lastPaintedTileKey = undefined;

      if (pointer.rightButtonDown() || pointer.middleButtonDown()) {
        this.viewport?.startPointerPan(pointer);
        return;
      }

      if (pointer.leftButtonDown()) {
        this.applyHoveredPrimaryAction(pointer);
      }
    });

    this.input.on('pointerup', () => {
      this.viewport?.stopPointerPan();
      this.lastPaintedTileKey = undefined;
    });

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objects: unknown[], _deltaX: number, deltaY: number) => {
      this.viewport?.adjustZoom(deltaY > 0 ? 'out' : 'in');
    });

    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      const brushFamily = BRUSH_KEYS[event.code];

      if (brushFamily && this.toolMode === 'terrain') {
        this.selectBrushForFamily(brushFamily);
        return;
      }

      if (event.code === 'KeyT') {
        this.toolMode = 'terrain';
        this.updateInfoText();
        this.setStatus('Terrain mode.');
        return;
      }

      if (event.code === 'KeyO') {
        this.toolMode = 'object';
        this.updateInfoText();
        this.setStatus('Object mode.');
        return;
      }

      if (event.code === 'KeyQ' || event.code === 'BracketLeft') {
        this.cycleSelection(-1);
        return;
      }

      if (event.code === 'KeyE' || event.code === 'BracketRight') {
        this.cycleSelection(1);
        return;
      }

      if (event.code === 'KeyF' && this.toolMode === 'terrain') {
        this.flipSelectedBrush('x');
        return;
      }

      if (event.code === 'KeyV' && this.toolMode === 'terrain') {
        this.flipSelectedBrush('y');
        return;
      }

      if (event.code === 'Backspace' || event.code === 'Delete' || event.code === 'KeyD') {
        this.removeHoveredObject();
        return;
      }

      if (event.code === 'KeyX') {
        void this.exportMap();
        return;
      }

      if (event.code === 'KeyY') {
        void this.exportWorldChunk();
        return;
      }

      if (event.code === 'KeyI') {
        this.importMap();
        return;
      }

      if (event.code === 'KeyR') {
        this.promptResizeMap();
        return;
      }

      if (event.code === 'KeyC') {
        this.centerCameraOnMap();
        return;
      }

      if (event.code === 'Equal' || event.code === 'NumpadAdd') {
        this.viewport?.adjustZoom('in');
        return;
      }

      if (event.code === 'Minus' || event.code === 'NumpadSubtract') {
        this.viewport?.adjustZoom('out');
      }
    });
  }

  private selectBrushForFamily(family: TerrainFamily): void {
    this.selectedBrush = getDefaultBrushForFamily(this.terrainCatalog, family);
    this.updateInfoText();
    this.setStatus(`Selected ${this.selectedBrush.label}. Use Q/E or [/] to choose a specific tile.`);
  }

  private cycleSelection(offset: number): void {
    if (this.toolMode === 'object') {
      this.selectedObjectDefinition = getObjectAtOffset(
        this.objectCatalog,
        this.selectedObjectDefinition.id,
        offset,
      );
      this.updateInfoText();
      this.setStatus(`Selected object ${this.selectedObjectDefinition.displayName}.`);
      return;
    }

    this.cycleSelectedBrush(offset);
  }

  private cycleSelectedBrush(offset: number): void {
    this.selectedBrush = getBrushAtOffset(this.terrainCatalog, this.selectedBrush, offset);
    this.updateInfoText();
    this.setStatus(`Selected tile ${this.selectedBrush.label}.`);
  }

  private flipSelectedBrush(axis: 'x' | 'y'): void {
    this.selectedBrush = withBrushFlip(this.selectedBrush, axis);
    this.updateInfoText();
    this.setStatus(axis === 'x' ? 'Selected brush flipped left/right.' : 'Selected brush flipped up/down.');
  }

  private applyHoveredPrimaryAction(pointer: Phaser.Input.Pointer): void {
    if (this.toolMode === 'object') {
      if (this.isDeletePointerAction(pointer)) {
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
    const key = tileKey(tileX, tileY);

    if (this.lastPaintedTileKey === key) {
      return;
    }

    if (!paintTerrainTile(this.map, tileX, tileY, toPaint(this.selectedBrush))) {
      return;
    }

    this.lastPaintedTileKey = key;
    this.terrainRenderer?.renderChunksAroundTile(this.map, tileX, tileY);
    this.redrawObjects();
    this.redrawOverlay();
    this.updateInfoText();
  }

  private placeHoveredObject(): void {
    if (!this.hoverTile) {
      return;
    }

    const objectId = `editor_object_${Date.now()}_${this.map.objects.length}`;
    this.map = removeEditorPlacedObjectsAtTile(this.map, this.hoverTile.x, this.hoverTile.y);
    this.map = addEditorPlacedObject(this.map, {
      id: objectId,
      definitionId: this.selectedObjectDefinition.id,
      tileX: this.hoverTile.x,
      tileY: this.hoverTile.y,
    });
    this.redrawObjects();
    this.updateInfoText();
  }

  private removeHoveredObject(): void {
    if (!this.hoverTile) {
      return;
    }

    const previousObjectCount = this.map.objects.length;
    this.map = removeEditorPlacedObjectsAtTile(this.map, this.hoverTile.x, this.hoverTile.y);
    this.redrawObjects();
    this.updateInfoText();
    this.setStatus(
      this.map.objects.length < previousObjectCount
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
    const selectedIndex = this.getSelectedBrushIndexLabel();

    this.hud.update({
      hover: {
        family: hoverFamily,
        objectDefinitionId: hoverObject?.definitionId ?? null,
        paint: hoverPaint,
        tile: hover,
      },
      map: this.map,
      selectedBrush: this.selectedBrush,
      selectedBrushIndexLabel: selectedIndex,
      selectedObjectDisplayName: this.selectedObjectDefinition.displayName,
      toolMode: this.toolMode,
    });
  }

  private getSelectedBrushIndexLabel(): string {
    const familyBrushes = this.terrainCatalog.byFamily[this.selectedBrush.family];
    const index = familyBrushes.findIndex((brush) => brush.id === this.selectedBrush.id);
    return index >= 0 ? `(${index + 1}/${familyBrushes.length})` : '';
  }

  private async exportMap(): Promise<void> {
    const result = await this.mapIo.exportMap(this.map);
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
      const resizedMap = this.mapIo.resizeFromPrompt(this.map, toPaint(this.selectedBrush));

      if (!resizedMap) {
        return;
      }

      this.map = resizedMap;
      this.hoverTile = null;
      this.redrawTerrain();
      this.redrawObjects();
      this.redrawOverlay();
      this.updateInfoText();
      this.setStatus(`Map resized to ${this.map.width}x${this.map.height}. New tiles filled with ${this.selectedBrush.label}.`);
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

  private isDeletePointerAction(pointer: Phaser.Input.Pointer): boolean {
    return (
      this.toolMode === 'object' &&
      pointer.leftButtonDown() &&
      'shiftKey' in pointer.event &&
      pointer.event.shiftKey
    );
  }
}

function tileKey(tileX: number, tileY: number): string {
  return `${tileX},${tileY}`;
}
