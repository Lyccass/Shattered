import Phaser from 'phaser';
import type { EditorMapDefinition } from '../../shared/editor/EditorMapModel';
import { worldToTile, type IsoTransformConfig } from '../../shared/iso/IsoCoordinates';
import type { EditorToolMode } from '../input/EditorInputController';
import type { EditorChunkNameRenderer } from '../chunks/EditorChunkNameRenderer';
import type { EditorEncounterToolController } from '../encounters/EditorEncounterToolController';
import type { EditorObjectLayerRenderer } from '../objects/EditorObjectLayerRenderer';
import { drawEditorOverlay } from '../overlays/EditorOverlayRenderer';
import type { EditorTerrainChunkRenderer } from '../terrain/EditorTerrainChunkRenderer';
import type { EditorTerrainToolController } from '../terrain/EditorTerrainToolController';
import type { EditorViewportController } from '../viewport/EditorViewportController';

type EditorSceneRenderCallbacks = {
  getChunkOverlayGraphics: () => Phaser.GameObjects.Graphics | undefined;
  getHoverTile: () => { x: number; y: number } | null;
  getMap: () => EditorMapDefinition;
  getObjectRenderer: () => EditorObjectLayerRenderer | undefined;
  getOverlayGraphics: () => Phaser.GameObjects.Graphics | undefined;
  getTerrainRenderer: () => EditorTerrainChunkRenderer | undefined;
  getToolMode: () => EditorToolMode;
  getUiCamera: () => Phaser.Cameras.Scene2D.Camera | undefined;
  getViewport: () => EditorViewportController | undefined;
  isTileInBounds: (tileX: number, tileY: number) => boolean;
  setStatus: (message: string) => void;
};

export class EditorSceneRenderController {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly transform: IsoTransformConfig,
    private readonly terrainTool: EditorTerrainToolController,
    private readonly encounterTool: EditorEncounterToolController,
    private readonly chunkNameRenderer: () => EditorChunkNameRenderer | undefined,
    private readonly callbacks: EditorSceneRenderCallbacks,
  ) {}

  redrawTerrain(): void {
    const map = this.callbacks.getMap();
    this.callbacks.getTerrainRenderer()?.renderAll(map);
    this.chunkNameRenderer()?.setMapContext(map);
    this.redrawChunkOverlay();
  }

  redrawObjects(): void {
    this.callbacks.getObjectRenderer()?.renderAll(this.callbacks.getMap());
  }

  redrawChunkOverlay(): void {
    const graphics = this.callbacks.getChunkOverlayGraphics();

    if (!graphics) {
      return;
    }

    this.callbacks.getTerrainRenderer()?.drawChunkOverlay(this.callbacks.getMap(), graphics);
  }

  redrawOverlay(): void {
    const graphics = this.callbacks.getOverlayGraphics();

    if (!graphics) {
      return;
    }

    const hoverTile = this.callbacks.getHoverTile();
    const toolMode = this.callbacks.getToolMode();
    const hoverFootprint = hoverTile && toolMode === 'terrain'
      ? this.terrainTool.getBrushFootprint(hoverTile.x, hoverTile.y)
      : hoverTile
        ? [hoverTile]
        : [];

    drawEditorOverlay({
      dragStart: this.encounterTool.getDragStart(),
      encounterSelection: this.encounterTool.getSelection(),
      graphics,
      hoverFootprint,
      hoverTile,
      isTileInBounds: (tileX, tileY) => this.callbacks.isTileInBounds(tileX, tileY),
      map: this.callbacks.getMap(),
      toolMode,
      transform: this.transform,
    });
  }

  getTileFromPointer(pointer: Phaser.Input.Pointer): { x: number; y: number } | null {
    const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const tile = worldToTile(this.transform, worldPoint.x, worldPoint.y);

    if (!this.callbacks.isTileInBounds(tile.x, tile.y)) {
      return null;
    }

    return tile;
  }

  centerCameraOnMap(): void {
    const map = this.callbacks.getMap();
    this.callbacks.getViewport()?.centerOnMap(map.width, map.height);
    this.callbacks.setStatus('Camera centered on map.');
  }

  ignoreWorldObjectsForUiCamera(): void {
    const worldObjects: Phaser.GameObjects.GameObject[] = [];
    const overlayGraphics = this.callbacks.getOverlayGraphics();
    const chunkOverlayGraphics = this.callbacks.getChunkOverlayGraphics();
    if (overlayGraphics) worldObjects.push(overlayGraphics);
    if (chunkOverlayGraphics) worldObjects.push(chunkOverlayGraphics);
    this.callbacks.getUiCamera()?.ignore(worldObjects);
  }
}
