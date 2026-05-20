import Phaser from 'phaser';
import {
  addEditorPlacedObject,
  createEditorMapFromWorldChunkDefinition,
  createEditorMapFromMapDefinition,
  createSampleEditorMap,
  getEditorTerrainAt,
  paintTerrainTile,
  parseEditorMapJson,
  removeEditorPlacedObjectsAtTile,
  resizeEditorMap,
  serializeEditorMapAsWorldChunk,
  serializeEditorMap,
  type EditorMapDefinition,
} from '../shared/editor/EditorMapModel';
import {
  getTileCenterWorld,
  getTileDiamondPoints,
  worldToTile,
  type IsoTransformConfig,
} from '../shared/iso/IsoCoordinates';
import type { TerrainFamily } from '../shared/map/TerrainTypes';
import { validateWorldChunkDefinition } from '../shared/world/ChunkValidation';
import type { WorldChunkDefinition } from '../shared/world/ChunkTypes';
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
import {
  createEditorObjectCatalog,
  getObjectAtOffset,
} from './objects/EditorObjectCatalog';
import { EditorObjectLayerRenderer } from './objects/EditorObjectLayerRenderer';

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

type PanKeys = {
  w: Phaser.Input.Keyboard.Key;
  a: Phaser.Input.Keyboard.Key;
  s: Phaser.Input.Keyboard.Key;
  d: Phaser.Input.Keyboard.Key;
  up: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
};

type EditorToolMode = 'terrain' | 'object';

export class EditorScene extends Phaser.Scene {
  private readonly terrainCatalog = createEditorTerrainCatalog();
  private readonly objectCatalog = createEditorObjectCatalog();
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
  private infoText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private selectedPreviewImage?: Phaser.GameObjects.Image;
  private hoveredPreviewImage?: Phaser.GameObjects.Image;
  private uiCamera?: Phaser.Cameras.Scene2D.Camera;
  private terrainRenderer?: EditorTerrainChunkRenderer;
  private objectRenderer?: EditorObjectLayerRenderer;
  private toolMode: EditorToolMode = 'terrain';
  private panKeys?: PanKeys;
  private isPointerPanning = false;
  private lastPanPointer?: { x: number; y: number };
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
    this.infoText = this.add.text(16, 16, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#dbeafe',
      backgroundColor: '#0f172acc',
      padding: { x: 8, y: 6 },
    }).setScrollFactor(0).setDepth(10_000);
    this.statusText = this.add.text(16, 198, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#bfdbfe',
      backgroundColor: '#0f172acc',
      padding: { x: 8, y: 6 },
    }).setScrollFactor(0).setDepth(10_000);
    this.selectedPreviewImage = this.add.image(48, 306, this.selectedBrush.textureKey)
      .setOrigin(0.5, 0)
      .setDepth(10_000)
      .setScrollFactor(0)
      .setScale(1.5);
    this.hoveredPreviewImage = this.add.image(128, 306, this.selectedBrush.textureKey)
      .setOrigin(0.5, 0)
      .setDepth(10_000)
      .setScrollFactor(0)
      .setScale(1.5);

    this.createUiCamera();
    this.panKeys = this.input.keyboard?.addKeys({
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
    }) as PanKeys | undefined;

    this.registerInput();
    this.redrawTerrain();
    this.redrawObjects();
    this.centerCameraOnMap();
    this.updateInfoText();
  }

  update(_time: number, deltaMs: number): void {
    this.updateKeyboardPanning(deltaMs);
  }

  private createUiCamera(): void {
    const uiObjects: Phaser.GameObjects.GameObject[] = [];

    if (this.infoText) uiObjects.push(this.infoText);
    if (this.statusText) uiObjects.push(this.statusText);
    if (this.selectedPreviewImage) uiObjects.push(this.selectedPreviewImage);
    if (this.hoveredPreviewImage) uiObjects.push(this.hoveredPreviewImage);

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
      this.updatePointerPan(pointer);
      this.hoverTile = this.getTileFromPointer(pointer);

      if (pointer.leftButtonDown() && !this.isPointerPanning) {
        this.applyHoveredPrimaryAction(pointer);
      }

      this.redrawOverlay();
      this.updateInfoText();
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.lastPaintedTileKey = undefined;

      if (pointer.rightButtonDown() || pointer.middleButtonDown()) {
        this.startPointerPan(pointer);
        return;
      }

      if (pointer.leftButtonDown()) {
        this.applyHoveredPrimaryAction(pointer);
      }
    });

    this.input.on('pointerup', () => {
      this.stopPointerPan();
      this.lastPaintedTileKey = undefined;
    });

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objects: unknown[], _deltaX: number, deltaY: number) => {
      this.adjustZoom(deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP);
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
        this.adjustZoom(ZOOM_STEP);
        return;
      }

      if (event.code === 'Minus' || event.code === 'NumpadSubtract') {
        this.adjustZoom(-ZOOM_STEP);
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
    if (!this.infoText) {
      return;
    }

    const hover = this.hoverTile && this.isTileInBounds(this.hoverTile.x, this.hoverTile.y)
      ? this.hoverTile
      : null;
    const hoverFamily = hover ? getEditorTerrainAt(this.map, hover.x, hover.y) : null;
    const hoverPaint = hover ? this.terrainRenderer?.getTilePaint(this.map, hover.x, hover.y) ?? null : null;
    const hoverObject = hover ? this.objectRenderer?.getObjectAtTile(this.map, hover.x, hover.y) ?? null : null;
    const selectedIndex = this.getSelectedBrushIndexLabel();

    this.updatePreviewImages(hoverPaint);
    this.infoText.setText([
      `Map: ${this.map.displayName} (${this.map.width}x${this.map.height})`,
      `Mode: ${this.toolMode}`,
      `Selected: ${this.selectedBrush.label} ${selectedIndex}`,
      `Selected object: ${this.selectedObjectDefinition.displayName}`,
      `Selected art: ${this.selectedBrush.textureKey}`,
      `Selected flip: ${formatFlip(this.selectedBrush)}`,
      `Hover tile: ${hover ? `${hover.x},${hover.y}` : '-'}`,
      `Hover terrain: ${hoverFamily ?? '-'}`,
      `Hover art: ${hoverPaint?.id ?? '-'}`,
      `Hover object: ${hoverObject?.definitionId ?? '-'}`,
      `Camera: WASD/arrows, right/middle drag, wheel zoom`,
      `Mode: T terrain, O object`,
      `Terrain: 1-5 family, Q/E or [/] exact tile, F/V flip brush`,
      `Object: Q/E or [/] object, left click place, Shift+click/D/Del remove`,
      `Map: R resize, C center, X map export, Y chunk export, I import`,
    ]);
  }

  private updatePreviewImages(hoverPaint: ReturnType<EditorTerrainChunkRenderer['getTilePaint']>): void {
    this.updatePreviewImage(this.selectedPreviewImage, this.selectedBrush);
    this.updatePreviewImage(this.hoveredPreviewImage, hoverPaint);
  }

  private updatePreviewImage(
    image: Phaser.GameObjects.Image | undefined,
    paint: { textureKey: string; flipX: boolean; flipY: boolean } | null,
  ): void {
    if (!image) {
      return;
    }

    if (!paint || !this.textures.exists(paint.textureKey)) {
      image.setVisible(false);
      return;
    }

    image
      .setVisible(true)
      .setTexture(paint.textureKey)
      .setFlip(paint.flipX, paint.flipY);
  }

  private getSelectedBrushIndexLabel(): string {
    const familyBrushes = this.terrainCatalog.byFamily[this.selectedBrush.family];
    const index = familyBrushes.findIndex((brush) => brush.id === this.selectedBrush.id);
    return index >= 0 ? `(${index + 1}/${familyBrushes.length})` : '';
  }

  private async exportMap(): Promise<void> {
    const json = serializeEditorMap(this.map);
    await this.writeExport(json, 'MapDefinition export');
  }

  private async exportWorldChunk(): Promise<void> {
    const json = serializeEditorMapAsWorldChunk(this.map, {
      worldId: 'the_wake',
      regionId: 'editor_region',
      chunkX: 0,
      chunkY: 0,
    });
    await this.writeExport(json, 'WorldChunkDefinition export');
  }

  private async writeExport(json: string, label: string): Promise<void> {
    console.log(json);

    if (!navigator.clipboard) {
      this.setStatus(`${label} printed to console.`);
      return;
    }

    try {
      await navigator.clipboard.writeText(json);
      this.setStatus(`${label} copied to clipboard.`);
    } catch {
      this.setStatus(`Clipboard blocked. ${label} printed to console.`);
    }
  }

  private importMap(): void {
    const json = window.prompt('Paste map JSON');

    if (!json) {
      return;
    }

    try {
      this.map = this.parseEditorImport(json);
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

  private parseEditorImport(json: string): EditorMapDefinition {
    const parsed: unknown = JSON.parse(json);

    if (isWorldChunkDefinitionLike(parsed)) {
      const validation = validateWorldChunkDefinition(parsed);

      if (!validation.ok) {
        throw new Error(validation.errors.join('\n'));
      }

      return createEditorMapFromWorldChunkDefinition(parsed);
    }

    return createEditorMapFromMapDefinition(parseEditorMapJson(json));
  }

  private promptResizeMap(): void {
    const value = window.prompt('New map size as width,height', `${this.map.width},${this.map.height}`);

    if (!value) {
      return;
    }

    const [widthValue, heightValue] = value.split(',').map((part) => Number.parseInt(part.trim(), 10));

    try {
      this.map = resizeEditorMap(this.map, widthValue, heightValue, toPaint(this.selectedBrush));
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
    const center = getTileCenterWorld(
      this.transform,
      Math.floor(this.map.width / 2),
      Math.floor(this.map.height / 2),
    );
    this.cameras.main.centerOn(center.x, center.y);
    this.setStatus('Camera centered on map.');
  }

  private updateKeyboardPanning(deltaMs: number): void {
    if (!this.panKeys) {
      return;
    }

    const moveLeft = this.panKeys.a.isDown || this.panKeys.left.isDown;
    const moveRight = this.panKeys.d.isDown || this.panKeys.right.isDown;
    const moveUp = this.panKeys.w.isDown || this.panKeys.up.isDown;
    const moveDown = this.panKeys.s.isDown || this.panKeys.down.isDown;
    const x = Number(moveRight) - Number(moveLeft);
    const y = Number(moveDown) - Number(moveUp);

    if (x === 0 && y === 0) {
      return;
    }

    const camera = this.cameras.main;
    const length = Math.hypot(x, y) || 1;
    const distance = (CAMERA_PAN_SPEED * deltaMs) / 1000 / camera.zoom;
    camera.scrollX += (x / length) * distance;
    camera.scrollY += (y / length) * distance;
  }

  private startPointerPan(pointer: Phaser.Input.Pointer): void {
    this.isPointerPanning = true;
    this.lastPanPointer = { x: pointer.x, y: pointer.y };
  }

  private updatePointerPan(pointer: Phaser.Input.Pointer): void {
    if (!this.isPointerPanning || !this.lastPanPointer) {
      return;
    }

    const isStillPanning = pointer.rightButtonDown() || pointer.middleButtonDown();

    if (!isStillPanning) {
      this.stopPointerPan();
      return;
    }

    const camera = this.cameras.main;
    const deltaX = pointer.x - this.lastPanPointer.x;
    const deltaY = pointer.y - this.lastPanPointer.y;
    camera.scrollX -= deltaX / camera.zoom;
    camera.scrollY -= deltaY / camera.zoom;
    this.lastPanPointer = { x: pointer.x, y: pointer.y };
  }

  private stopPointerPan(): void {
    this.isPointerPanning = false;
    this.lastPanPointer = undefined;
  }

  private adjustZoom(delta: number): void {
    const camera = this.cameras.main;
    camera.setZoom(Phaser.Math.Clamp(camera.zoom + delta, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM));
    this.updateInfoText();
  }

  private setStatus(message: string): void {
    this.statusText?.setText(message);
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

function formatFlip(paint: { flipX: boolean; flipY: boolean }): string {
  return `${paint.flipX ? 'X' : '-'} ${paint.flipY ? 'Y' : '-'}`;
}

function isWorldChunkDefinitionLike(value: unknown): value is WorldChunkDefinition {
  return (
    typeof value === 'object' &&
    value !== null &&
    'worldId' in value &&
    'regionId' in value &&
    'objectLayer' in value &&
    'resourceLayer' in value &&
    'habitatLayer' in value
  );
}
