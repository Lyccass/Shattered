import {
  resizeEditorMap,
  type EditorMapDefinition,
  type EditorTerrainTilePaint,
} from '../../shared/editor/EditorMapModel';

type TileCoord = { x: number; y: number };

type LoadedChunkWindowResizeContext = {
  chunkSize: number;
  loadedChunks: Set<string>;
  occupiedChunks: Set<string>;
  originChunkX: number;
  originChunkY: number;
  sourceDisplayName: string;
};

type EditorMapStructurePanelCallbacks = {
  chunkSize: number;
  clearHoverTile: () => void;
  getHoverTile: () => TileCoord | null;
  getLoadedChunkWindow: () => LoadedChunkWindowResizeContext | null;
  getMap: () => EditorMapDefinition;
  getSelectedTerrainPaint: () => EditorTerrainTilePaint;
  markAllChunksDirty: (width: number, height: number) => void;
  markChunkDirty: (chunkX: number, chunkY: number) => void;
  persistWorkingDraft: () => void;
  redrawObjects: () => void;
  redrawOverlay: () => void;
  redrawTerrain: () => void;
  setChunkName: (chunkX: number, chunkY: number, chunkNames: Record<string, string>) => void;
  setMap: (map: EditorMapDefinition) => void;
  setStatus: (message: string) => void;
  snapshot: (map: EditorMapDefinition) => void;
  updateInfoText: () => void;
};

export class EditorMapStructurePanelController {
  private pendingChunkRename: { chunkX: number; chunkY: number } | null = null;

  constructor(private readonly callbacks: EditorMapStructurePanelCallbacks) {}

  bindEvents(): void {
    document.getElementById('ed-resize-close')?.addEventListener('click', () => this.hideResizePanel());
    document.getElementById('ed-resize-cancel')?.addEventListener('click', () => this.hideResizePanel());
    document.getElementById('ed-resize-apply')?.addEventListener('click', () => this.applyResizeFromPanel());
    document.getElementById('ed-chunk-name-close')?.addEventListener('click', () => this.hideChunkNamePanel());
    document.getElementById('ed-chunk-name-cancel')?.addEventListener('click', () => this.hideChunkNamePanel());
    document.getElementById('ed-chunk-name-apply')?.addEventListener('click', () => this.applyChunkNameFromPanel());
  }

  openResizePanel(): void {
    const panel = document.getElementById('ed-resize');
    const widthInput = document.getElementById('ed-resize-width') as HTMLInputElement | null;
    const heightInput = document.getElementById('ed-resize-height') as HTMLInputElement | null;

    if (!panel || !widthInput || !heightInput) {
      return;
    }

    const map = this.callbacks.getMap();
    widthInput.value = String(Math.ceil(map.width / this.callbacks.chunkSize));
    heightInput.value = String(Math.ceil(map.height / this.callbacks.chunkSize));
    panel.classList.remove('editor-hidden');
    widthInput.focus();
    widthInput.select();
  }

  renameHoveredChunk(): void {
    const hoverTile = this.callbacks.getHoverTile();

    if (!hoverTile) {
      this.callbacks.setStatus('Hover a chunk before renaming it.');
      return;
    }

    const chunk = this.getChunkInfo(hoverTile.x, hoverTile.y);
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

      const map = this.callbacks.getMap();
      const widthChunks = parseIntegerInput(widthInput.value, Math.ceil(map.width / this.callbacks.chunkSize));
      const heightChunks = parseIntegerInput(heightInput.value, Math.ceil(map.height / this.callbacks.chunkSize));
      const width = widthChunks * this.callbacks.chunkSize;
      const height = heightChunks * this.callbacks.chunkSize;
      const guardrailError = this.getResizeGuardrailError(width, height);

      if (guardrailError) {
        this.callbacks.setStatus(guardrailError);
        return;
      }

      this.callbacks.snapshot(map);
      const resizedMap = resizeEditorMap(map, width, height, this.callbacks.getSelectedTerrainPaint());
      this.callbacks.setMap(resizedMap);
      this.refreshLoadedChunkWindowAfterResize(width, height);
      this.callbacks.clearHoverTile();
      this.callbacks.markAllChunksDirty(resizedMap.width, resizedMap.height);
      this.callbacks.redrawTerrain();
      this.callbacks.redrawObjects();
      this.callbacks.redrawOverlay();
      this.callbacks.updateInfoText();
      this.callbacks.persistWorkingDraft();
      this.hideResizePanel();
      this.callbacks.setStatus(`Map resized to ${widthChunks}x${heightChunks} chunks (${resizedMap.width}x${resizedMap.height} tiles).`);
    } catch (error) {
      this.callbacks.setStatus(error instanceof Error ? error.message : 'Resize failed.');
    }
  }

  private getResizeGuardrailError(width: number, height: number): string | null {
    if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
      return 'Width and height must be positive chunk counts.';
    }

    const loadedWindow = this.callbacks.getLoadedChunkWindow();

    if (!loadedWindow) {
      return null;
    }

    const nextChunks = createLocalWindowChunkKeys(
      loadedWindow.originChunkX,
      loadedWindow.originChunkY,
      width,
      height,
      loadedWindow.chunkSize,
    );
    const map = this.callbacks.getMap();
    const curEndChunkX = loadedWindow.originChunkX + Math.ceil(map.width / loadedWindow.chunkSize) - 1;
    const curEndChunkY = loadedWindow.originChunkY + Math.ceil(map.height / loadedWindow.chunkSize) - 1;

    for (const key of nextChunks) {
      if (loadedWindow.occupiedChunks.has(key) && !loadedWindow.loadedChunks.has(key)) {
        return (
          `Blocked: chunk ${key} of "${loadedWindow.sourceDisplayName}" is outside this window. ` +
          `Current window: chunks ${loadedWindow.originChunkX},${loadedWindow.originChunkY}-${curEndChunkX},${curEndChunkY} ` +
          `(tiles 0,0-${map.width - 1},${map.height - 1}). ` +
          `Reload with a larger radius to include chunk ${key}.`
        );
      }
    }

    return null;
  }

  private refreshLoadedChunkWindowAfterResize(width: number, height: number): void {
    const loadedWindow = this.callbacks.getLoadedChunkWindow();

    if (!loadedWindow) {
      return;
    }

    loadedWindow.loadedChunks = createLocalWindowChunkKeys(
      loadedWindow.originChunkX,
      loadedWindow.originChunkY,
      width,
      height,
      loadedWindow.chunkSize,
    );
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
    const map = this.callbacks.getMap();
    this.callbacks.snapshot(map);
    const key = `${chunkX},${chunkY}`;
    const chunkNames = { ...(map.chunkNames ?? {}) };
    const trimmed = input.value.trim();

    if (trimmed) {
      chunkNames[key] = trimmed;
    } else {
      delete chunkNames[key];
    }

    this.callbacks.setMap({
      ...map,
      chunkNames,
    });
    this.callbacks.setChunkName(chunkX, chunkY, chunkNames);
    this.callbacks.markChunkDirty(chunkX, chunkY);
    this.callbacks.updateInfoText();
    this.callbacks.persistWorkingDraft();
    this.hideChunkNamePanel();
    this.callbacks.setStatus(trimmed ? `Chunk ${key} named "${trimmed}".` : `Chunk ${key} name cleared.`);
  }

  private getChunkInfo(tileX: number, tileY: number): { chunkName: string; chunkX: number; chunkY: number } {
    const chunkX = Math.floor(tileX / this.callbacks.chunkSize);
    const chunkY = Math.floor(tileY / this.callbacks.chunkSize);
    const chunkName = this.callbacks.getMap().chunkNames?.[`${chunkX},${chunkY}`] ?? '';
    return { chunkName, chunkX, chunkY };
  }
}

function parseIntegerInput(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
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
