import Phaser from 'phaser';
import type {
  EditorMapDefinition,
  EditorTerrainTilePaint,
  EditorWorldZoneTag,
} from '../../shared/editor/EditorMapModel';
import { EDITOR_WORLD_ZONE_TAGS } from '../../shared/editor/EditorMapModel';
import type { TerrainFamily } from '../../shared/map/TerrainTypes';
import type { EditorToolMode } from '../input/EditorInputController';
import type { EditorTerrainBrush } from '../terrain/EditorTerrainCatalog';
import { requireById } from '../../ui/domUtils';

type EditorHudHoverState = {
  family: TerrainFamily | null;
  objectDefinitionId: string | null;
  paint: EditorTerrainTilePaint | null;
  walkable: boolean | null;
  elevation: number | null;
  zone: EditorWorldZoneTag | null;
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
  selectedElevation: number;
  selectedWalkable: boolean;
  selectedZoneTag: EditorWorldZoneTag | null;
  selectedObjectDisplayName: string;
  toolMode: EditorToolMode;
};

type EditorHudCallbacks = {
  onSetMode: (mode: EditorToolMode) => void;
  onSetZoneTag: (tag: EditorWorldZoneTag | null) => void;
  onAdjustBrushSize: (delta: number) => void;
  onAdjustElevation: (delta: number) => void;
  onClearGameMap: () => void;
  onCreateCustomObject: () => void;
  onCreateCustomTile: () => void;
  onDeleteAllInstances: () => void;
  onDeleteCustomObject: () => void;
  onDeleteCustomTile: () => void;
  onExportDirtyChunks: () => void;
  onExportMap: () => void;
  onExportWorldChunk: () => void;
  onImportDirtyChunks: () => void;
  onImportMap: () => void;
  onOpenChunkWindow: () => void;
  onOpenPalette: () => void;
  onOpenMap: () => void;
  onRedo: () => void;
  onRenameMap: (displayName: string) => void;
  onSetWalkabilityBrush: (walkable: boolean) => void;
  onTestInGame: () => void;
  onSaveMap: () => void;
  onResizeMap: () => void;
  onUndo: () => void;
};

const MAX_BRUSH_SIZE = 4;

export class EditorHudController {
  private readonly els: {
    mapName: HTMLElement | null;
    mapNameInput: HTMLInputElement;
    mapSize: HTMLElement;
    dirty: HTMLElement;
    menuDirty: HTMLElement | null;
    modeTerrainBtn: HTMLButtonElement;
    modeObjectBtn: HTMLButtonElement;
    modeWalkabilityBtn: HTMLButtonElement;
    modeElevationBtn: HTMLButtonElement;
    modeZoneBtn: HTMLButtonElement;
    brushSection: HTMLElement;
    objectSection: HTMLElement;
    tileMetaSection: HTMLElement;
    zoneSection: HTMLElement;
    zoneTagLabel: HTMLElement;
    zoneTagBtns: Record<string, HTMLButtonElement>;
    walkableOnBtn: HTMLButtonElement;
    walkableOffBtn: HTMLButtonElement;
    walkabilityLabel: HTMLElement;
    elevationInc: HTMLButtonElement;
    elevationDec: HTMLButtonElement;
    elevationValue: HTMLElement;
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
    hoverWalkability: HTMLElement;
    hoverElevation: HTMLElement;
    hoverZone: HTMLElement;
    hoverObject: HTMLElement;
    hoverChunk: HTMLElement;
    status: HTMLElement;
  };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly callbacks: EditorHudCallbacks,
  ) {
    this.els = {
      mapName:        document.getElementById('ed-map-name'),
      mapNameInput:   requireById<HTMLInputElement>('ed-map-name-input'),
      mapSize:        requireById('ed-map-size'),
      dirty:          requireById('ed-dirty'),
      menuDirty:      document.getElementById('ed-menu-dirty'),
      modeTerrainBtn: requireById<HTMLButtonElement>('ed-mode-terrain'),
      modeObjectBtn:  requireById<HTMLButtonElement>('ed-mode-object'),
      modeWalkabilityBtn: requireById<HTMLButtonElement>('ed-mode-walkability'),
      modeElevationBtn: requireById<HTMLButtonElement>('ed-mode-elevation'),
      modeZoneBtn:    requireById<HTMLButtonElement>('ed-mode-zone'),
      brushSection:   requireById('ed-brush-section'),
      objectSection:  requireById('ed-object-section'),
      tileMetaSection: requireById('ed-tile-meta-section'),
      zoneSection:    requireById('ed-zone-section'),
      zoneTagLabel:   requireById('ed-zone-tag-label'),
      zoneTagBtns:    Object.fromEntries(
        EDITOR_WORLD_ZONE_TAGS.map((tag) => [tag, requireById<HTMLButtonElement>(`ed-zone-tag-${tag}`)]),
      ),
      walkableOnBtn:  requireById<HTMLButtonElement>('ed-walkable-on'),
      walkableOffBtn: requireById<HTMLButtonElement>('ed-walkable-off'),
      walkabilityLabel: requireById('ed-walkability-label'),
      elevationInc:   requireById<HTMLButtonElement>('ed-elevation-inc'),
      elevationDec:   requireById<HTMLButtonElement>('ed-elevation-dec'),
      elevationValue: requireById('ed-elevation-value'),
      previewSelected: requireById<HTMLImageElement>('ed-preview-selected'),
      brushLabel:     requireById('ed-brush-label'),
      brushIdx:       requireById('ed-brush-idx'),
      brushFlip:      requireById('ed-brush-flip'),
      sizeInc:        requireById<HTMLButtonElement>('ed-size-inc'),
      sizeDec:        requireById<HTMLButtonElement>('ed-size-dec'),
      sizePips:       [1, 2, 3, 4].map((i) => requireById(`ed-pip-${i}`)),
      previewObject:  requireById<HTMLImageElement>('ed-preview-object'),
      objColorSwatch: requireById<HTMLCanvasElement>('ed-obj-color-swatch'),
      objectName:     requireById('ed-object-name'),
      hoverTile:      requireById('ed-hover-tile'),
      hoverTerrain:   requireById('ed-hover-terrain'),
      hoverArt:       requireById('ed-hover-art'),
      hoverWalkability: requireById('ed-hover-walkability'),
      hoverElevation: requireById('ed-hover-elevation'),
      hoverZone:      requireById('ed-hover-zone'),
      hoverObject:    requireById('ed-hover-object'),
      hoverChunk:     requireById('ed-hover-chunk'),
      status:         requireById('ed-status'),
    };

    this.els.modeTerrainBtn.addEventListener('click', () => this.callbacks.onSetMode('terrain'));
    this.els.modeObjectBtn.addEventListener('click',  () => this.callbacks.onSetMode('object'));
    this.els.modeWalkabilityBtn.addEventListener('click',  () => this.callbacks.onSetMode('walkability'));
    this.els.modeElevationBtn.addEventListener('click',  () => this.callbacks.onSetMode('elevation'));
    this.els.modeZoneBtn.addEventListener('click', () => this.callbacks.onSetMode('zone'));

    for (const tag of EDITOR_WORLD_ZONE_TAGS) {
      this.els.zoneTagBtns[tag]?.addEventListener('click', () => this.callbacks.onSetZoneTag(tag));
    }
    requireById('ed-zone-tag-erase').addEventListener('click', () => this.callbacks.onSetZoneTag(null));
    this.els.sizeInc.addEventListener('click', () => this.callbacks.onAdjustBrushSize(1));
    this.els.sizeDec.addEventListener('click', () => this.callbacks.onAdjustBrushSize(-1));
    this.els.walkableOnBtn.addEventListener('click', () => this.callbacks.onSetWalkabilityBrush(true));
    this.els.walkableOffBtn.addEventListener('click', () => this.callbacks.onSetWalkabilityBrush(false));
    this.els.elevationInc.addEventListener('click', () => this.callbacks.onAdjustElevation(1));
    this.els.elevationDec.addEventListener('click', () => this.callbacks.onAdjustElevation(-1));
    this.els.mapNameInput.addEventListener('change', () => this.callbacks.onRenameMap(this.els.mapNameInput.value));
    this.els.mapNameInput.addEventListener('blur', () => this.callbacks.onRenameMap(this.els.mapNameInput.value));
    document.getElementById('ed-undo')?.addEventListener('click', () => this.callbacks.onUndo());
    document.getElementById('ed-redo')?.addEventListener('click', () => this.callbacks.onRedo());
    document.getElementById('ed-palette-open')?.addEventListener('click', () => this.callbacks.onOpenPalette());
    document.getElementById('ed-obj-palette-open')?.addEventListener('click', () => this.callbacks.onOpenPalette());
    document.getElementById('ed-save-map')?.addEventListener('click', () => this.callbacks.onSaveMap());
    document.getElementById('ed-open-map')?.addEventListener('click', () => this.callbacks.onOpenMap());
    document.getElementById('ed-load-window')?.addEventListener('click', () => this.callbacks.onOpenChunkWindow());
    document.getElementById('ed-test-game')?.addEventListener('click', () => this.callbacks.onTestInGame());
    document.getElementById('ed-clear-game-map')?.addEventListener('click', () => this.callbacks.onClearGameMap());
    document.getElementById('ed-export-map')?.addEventListener('click', () => this.callbacks.onExportMap());
    document.getElementById('ed-export-chunk')?.addEventListener('click', () => this.callbacks.onExportWorldChunk());
    document.getElementById('ed-export-dirty')?.addEventListener('click', () => this.callbacks.onExportDirtyChunks());
    document.getElementById('ed-import-map')?.addEventListener('click', () => this.callbacks.onImportMap());
    document.getElementById('ed-import-dirty')?.addEventListener('click', () => this.callbacks.onImportDirtyChunks());
    document.getElementById('ed-resize-map')?.addEventListener('click', () => this.callbacks.onResizeMap());
    document.getElementById('ed-create-custom-tile')?.addEventListener('click', () => this.callbacks.onCreateCustomTile());
    document.getElementById('ed-create-custom-object')?.addEventListener('click', () => this.callbacks.onCreateCustomObject());
    document.getElementById('ed-delete-all-instances')?.addEventListener('click', () => this.callbacks.onDeleteAllInstances());
    document.getElementById('ed-delete-custom-tile')?.addEventListener('click', () => this.callbacks.onDeleteCustomTile());
    document.getElementById('ed-delete-custom-object')?.addEventListener('click', () => this.callbacks.onDeleteCustomObject());
    document.getElementById('ed-help-toggle')?.addEventListener('click', () => {
      const panel = document.getElementById('ed-help-panel');
      const btn   = document.getElementById('ed-help-toggle');
      const open  = panel?.classList.toggle('is-visible') ?? false;
      btn?.classList.toggle('is-active', open);
    });
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
    if (this.els.mapName) this.els.mapName.textContent = state.map.displayName;
    if (document.activeElement !== this.els.mapNameInput) {
      this.els.mapNameInput.value = state.map.displayName;
    }
    this.els.mapSize.textContent = `${state.map.width} × ${state.map.height}`;
    const dirtyText = formatDirtyChunks(state.dirtyChunks);
    this.els.dirty.textContent = dirtyText;
    this.els.dirty.classList.toggle('is-dirty', state.dirtyChunks.count > 0);
    if (this.els.menuDirty) {
      this.els.menuDirty.textContent = state.dirtyChunks.count > 0 ? `${state.dirtyChunks.count} dirty` : '';
      this.els.menuDirty.classList.toggle('is-dirty', state.dirtyChunks.count > 0);
    }

    // Tool mode
    const isTerrain = state.toolMode === 'terrain';
    const isObject = state.toolMode === 'object';
    const isWalkability = state.toolMode === 'walkability';
    const isElevation = state.toolMode === 'elevation';
    const isZone = state.toolMode === 'zone';
    this.els.modeTerrainBtn.classList.toggle('is-active', isTerrain);
    this.els.modeObjectBtn.classList.toggle('is-active', isObject);
    this.els.modeWalkabilityBtn.classList.toggle('is-active', isWalkability);
    this.els.modeElevationBtn.classList.toggle('is-active', isElevation);
    this.els.modeZoneBtn.classList.toggle('is-active', isZone);
    this.els.brushSection.classList.toggle('editor-hidden', !isTerrain);
    this.els.objectSection.classList.toggle('editor-hidden', !isObject);
    this.els.tileMetaSection.classList.toggle('editor-hidden', !(isWalkability || isElevation));
    this.els.zoneSection.classList.toggle('editor-hidden', !isZone);

    // Zone tag selector
    const zoneLabel = state.selectedZoneTag ?? 'erase';
    this.els.zoneTagLabel.textContent = zoneLabel;
    for (const tag of EDITOR_WORLD_ZONE_TAGS) {
      this.els.zoneTagBtns[tag]?.classList.toggle('is-active', state.selectedZoneTag === tag);
    }
    document.getElementById('ed-zone-tag-erase')?.classList.toggle('is-active', state.selectedZoneTag === null);

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

    this.els.walkabilityLabel.textContent = state.selectedWalkable ? 'walkable' : 'blocked';
    this.els.walkableOnBtn.classList.toggle('is-active', state.selectedWalkable);
    this.els.walkableOffBtn.classList.toggle('is-active', !state.selectedWalkable);
    this.els.elevationValue.textContent = String(state.selectedElevation);
    this.els.elevationDec.disabled = state.selectedElevation <= 0;

    // Object preview (object mode)
    this.els.objectName.textContent = state.selectedObjectDisplayName;
    this.updateObjectPreview(state.objectPreviewTextureKey, state.objectPreviewColor);

    // Hover
    this.els.hoverTile.textContent    = state.hover.tile ? `${state.hover.tile.x}, ${state.hover.tile.y}` : '–';
    this.els.hoverTerrain.textContent = state.hover.family ?? '–';
    this.els.hoverArt.textContent     = state.hover.paint?.id ?? '–';
    this.els.hoverWalkability.textContent = state.hover.walkable === null
      ? '–'
      : state.hover.walkable ? 'walkable' : 'blocked';
    this.els.hoverElevation.textContent = state.hover.elevation === null ? '–' : String(state.hover.elevation);
    this.els.hoverZone.textContent    = state.hover.zone ?? '–';
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
      el.classList.add('editor-hidden');
      return;
    }

    el.classList.remove('editor-hidden');

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
      this.els.previewObject.classList.remove('editor-hidden');
      this.els.objColorSwatch.classList.add('editor-hidden');
      return;
    }

    // Fallback: render a coloured diamond on the canvas swatch
    this.els.previewObject.classList.add('editor-hidden');
    this.els.objColorSwatch.classList.remove('editor-hidden');
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
