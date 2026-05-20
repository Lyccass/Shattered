import Phaser from 'phaser';
import type {
  EditorMapDefinition,
  EditorTerrainTilePaint,
} from '../../shared/editor/EditorMapModel';
import type { TerrainFamily } from '../../shared/map/TerrainTypes';
import type { EditorTerrainBrush } from '../terrain/EditorTerrainCatalog';

type EditorHudHoverState = {
  family: TerrainFamily | null;
  objectDefinitionId: string | null;
  paint: EditorTerrainTilePaint | null;
  tile: { x: number; y: number } | null;
  chunkX: number | null;
  chunkY: number | null;
  chunkName: string | null;
};

export type EditorHudState = {
  brushSize: number;
  dirtyChunks: { count: number; keys: string[] };
  hover: EditorHudHoverState;
  map: EditorMapDefinition;
  objectPreviewTextureKey: string | null;
  objectPreviewColor: number | null;
  selectedBrush: EditorTerrainBrush;
  selectedBrushIndexLabel: string;
  selectedObjectDisplayName: string;
  toolMode: string;
};

type EditorHudCallbacks = {
  onSetMode: (mode: string) => void;
  onAdjustBrushSize: (delta: number) => void;
  onOpenPalette: () => void;
};

const MAX_BRUSH_SIZE = 4;

export class EditorHudController {
  private readonly els: {
    mapName: HTMLElement;
    mapSize: HTMLElement;
    dirty: HTMLElement;
    modeTerrainBtn: HTMLButtonElement;
    modeObjectBtn: HTMLButtonElement;
    brushSection: HTMLElement;
    objectSection: HTMLElement;
    previewSelected: HTMLImageElement;
    brushLabel: HTMLElement;
    brushIdx: HTMLElement;
    brushFlip: HTMLElement;
    sizeInc: HTMLButtonElement;
    sizeDec: HTMLButtonElement;
    sizePips: HTMLElement[];
    previewObject: HTMLImageElement;
    objColorSwatch: HTMLCanvasElement;
    objectName: HTMLElement;
    hoverTile: HTMLElement;
    hoverTerrain: HTMLElement;
    hoverArt: HTMLElement;
    hoverObject: HTMLElement;
    hoverChunk: HTMLElement;
    status: HTMLElement;
  };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly callbacks: EditorHudCallbacks,
  ) {
    this.els = {
      mapName:        document.getElementById('ed-map-name')!,
      mapSize:        document.getElementById('ed-map-size')!,
      dirty:          document.getElementById('ed-dirty')!,
      modeTerrainBtn: document.getElementById('ed-mode-terrain') as HTMLButtonElement,
      modeObjectBtn:  document.getElementById('ed-mode-object')  as HTMLButtonElement,
      brushSection:   document.getElementById('ed-brush-section')!,
      objectSection:  document.getElementById('ed-object-section')!,
      previewSelected: document.getElementById('ed-preview-selected') as HTMLImageElement,
      brushLabel:     document.getElementById('ed-brush-label')!,
      brushIdx:       document.getElementById('ed-brush-idx')!,
      brushFlip:      document.getElementById('ed-brush-flip')!,
      sizeInc:        document.getElementById('ed-size-inc') as HTMLButtonElement,
      sizeDec:        document.getElementById('ed-size-dec') as HTMLButtonElement,
      sizePips:       [1, 2, 3, 4].map((i) => document.getElementById(`ed-pip-${i}`)!),
      previewObject:  document.getElementById('ed-preview-object') as HTMLImageElement,
      objColorSwatch: document.getElementById('ed-obj-color-swatch') as HTMLCanvasElement,
      objectName:     document.getElementById('ed-object-name')!,
      hoverTile:      document.getElementById('ed-hover-tile')!,
      hoverTerrain:   document.getElementById('ed-hover-terrain')!,
      hoverArt:       document.getElementById('ed-hover-art')!,
      hoverObject:    document.getElementById('ed-hover-object')!,
      hoverChunk:     document.getElementById('ed-hover-chunk')!,
      status:         document.getElementById('ed-status')!,
    };

    this.els.modeTerrainBtn.addEventListener('click', () => this.callbacks.onSetMode('terrain'));
    this.els.modeObjectBtn.addEventListener('click',  () => this.callbacks.onSetMode('object'));
    this.els.sizeInc.addEventListener('click', () => this.callbacks.onAdjustBrushSize(1));
    this.els.sizeDec.addEventListener('click', () => this.callbacks.onAdjustBrushSize(-1));
    document.getElementById('ed-palette-open')?.addEventListener('click', () => this.callbacks.onOpenPalette());
  }

  // No Phaser display objects — HUD is pure HTML.
  create(_selectedBrush: EditorTerrainBrush): void {}

  getObjects(): Phaser.GameObjects.GameObject[] {
    return [];
  }

  setStatus(message: string): void {
    this.els.status.textContent = message;
  }

  update(state: EditorHudState): void {
    // Map info
    this.els.mapName.textContent = state.map.displayName;
    this.els.mapSize.textContent = `${state.map.width} × ${state.map.height}`;
    const dirtyText = formatDirtyChunks(state.dirtyChunks);
    this.els.dirty.textContent = dirtyText;
    this.els.dirty.classList.toggle('is-dirty', state.dirtyChunks.count > 0);

    // Tool mode
    const isObject = state.toolMode === 'object';
    this.els.modeTerrainBtn.classList.toggle('is-active', !isObject);
    this.els.modeObjectBtn.classList.toggle('is-active', isObject);
    this.els.brushSection.style.display  = isObject ? 'none' : '';
    this.els.objectSection.style.display = isObject ? '' : 'none';

    // Brush (terrain mode)
    this.els.brushLabel.textContent = state.selectedBrush.label;
    this.els.brushIdx.textContent   = state.selectedBrushIndexLabel;
    this.els.brushFlip.textContent  = `Flip: ${formatFlip(state.selectedBrush)}`;
    this.updatePreviewImg(this.els.previewSelected, state.selectedBrush);

    // Brush size pips
    for (let i = 0; i < MAX_BRUSH_SIZE; i++) {
      this.els.sizePips[i]?.classList.toggle('is-active', i < state.brushSize);
    }

    this.els.sizeDec.disabled = state.brushSize <= 1;
    this.els.sizeInc.disabled = state.brushSize >= MAX_BRUSH_SIZE;

    // Object preview (object mode)
    this.els.objectName.textContent = state.selectedObjectDisplayName;
    this.updateObjectPreview(state.objectPreviewTextureKey, state.objectPreviewColor);

    // Hover
    this.els.hoverTile.textContent    = state.hover.tile ? `${state.hover.tile.x}, ${state.hover.tile.y}` : '–';
    this.els.hoverTerrain.textContent = state.hover.family ?? '–';
    this.els.hoverArt.textContent     = state.hover.paint?.id ?? '–';
    this.els.hoverObject.textContent  = state.hover.objectDefinitionId ?? '–';

    if (state.hover.chunkX !== null && state.hover.chunkY !== null) {
      const name = state.hover.chunkName ? ` "${state.hover.chunkName}"` : '';
      this.els.hoverChunk.textContent = `${state.hover.chunkX},${state.hover.chunkY}${name}`;
    } else {
      this.els.hoverChunk.textContent = '–';
    }
  }

  private updatePreviewImg(el: HTMLImageElement, brush: EditorTerrainBrush): void {
    const { textureKey, flipX, flipY } = brush;

    if (!this.scene.textures.exists(textureKey)) {
      el.style.display = 'none';
      return;
    }

    el.style.display = '';

    if (el.dataset['texture'] !== textureKey) {
      el.src = this.scene.textures.getBase64(textureKey);
      el.dataset['texture'] = textureKey;
    }

    const sx = flipX ? -1 : 1;
    const sy = flipY ? -1 : 1;
    el.style.transform = (sx !== 1 || sy !== 1) ? `scale(${sx}, ${sy})` : '';
  }

  private updateObjectPreview(textureKey: string | null, color: number | null): void {
    if (textureKey && this.scene.textures.exists(textureKey)) {
      // Show sprite preview
      if (this.els.previewObject.dataset['texture'] !== textureKey) {
        this.els.previewObject.src = this.scene.textures.getBase64(textureKey);
        this.els.previewObject.dataset['texture'] = textureKey;
      }
      this.els.previewObject.style.display   = '';
      this.els.objColorSwatch.style.display  = 'none';
      return;
    }

    // Fallback: render a coloured diamond on the canvas swatch
    this.els.previewObject.style.display  = 'none';
    this.els.objColorSwatch.style.display = '';
    const ctx = this.els.objColorSwatch.getContext('2d');

    if (ctx && color !== null) {
      const hex = `#${color.toString(16).padStart(6, '0')}`;
      const w = this.els.objColorSwatch.width;
      const h = this.els.objColorSwatch.height;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = hex;
      ctx.beginPath();
      ctx.moveTo(w / 2, 4);
      ctx.lineTo(w - 4, h / 2);
      ctx.lineTo(w / 2, h - 4);
      ctx.lineTo(4, h / 2);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function formatFlip(brush: { flipX: boolean; flipY: boolean }): string {
  return `${brush.flipX ? 'X' : '–'} ${brush.flipY ? 'Y' : '–'}`;
}

function formatDirtyChunks(summary: { count: number; keys: string[] }): string {
  if (summary.count === 0) {
    return 'clean';
  }

  const preview = summary.keys.slice(0, 3).join(' ');
  const suffix  = summary.count > 3 ? ` +${summary.count - 3}` : '';
  return `${summary.count} (${preview}${suffix})`;
}
