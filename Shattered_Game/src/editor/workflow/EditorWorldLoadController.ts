import {
  loadEditorWorkingDraft,
  saveEditorWorkingDraft,
} from '../io/EditorLocalLibrary';
import {
  loadEditorWorldChunkWindow,
  loadWorldManifestFromProject,
} from '../io/EditorWorldLibrary';
import type {
  EditorMapDefinition,
  EditorTerrainTilePaint,
} from '../../shared/editor/EditorMapModel';
import type { EditorTerrainBrush } from '../terrain/EditorTerrainCatalog';

export type LoadedChunkWindowContext = {
  chunkSize: number;
  loadedChunks: Set<string>;
  occupiedChunks: Set<string>;
  originChunkX: number;
  originChunkY: number;
  regionId: string;
  sourceDisplayName: string;
  sourceMapId: string;
  sourceRecordId: string;
  sourceType: 'map' | 'world';
  worldId: string;
};

type EditorWorldLoadCallbacks = {
  applyMapCustomDefinitions: () => Promise<void>;
  centerCameraOnMap: () => void;
  chunkSize: number;
  clearDirtyChunks: () => void;
  clearHoverTile: () => void;
  clearHistory: () => void;
  clearSaveSnapshot: () => void;
  getFallbackPaint: () => EditorTerrainTilePaint;
  getMap: () => EditorMapDefinition;
  getSelectedObjectDefinitionId: () => string;
  getSelectedTerrainBrush: () => EditorTerrainBrush;
  hideChunkWindowPanel: () => void;
  markAllChunksDirty: (width: number, height: number) => void;
  redrawObjects: () => void;
  redrawOverlay: () => void;
  redrawTerrain: () => void;
  refreshPalette: (terrainBrush: EditorTerrainBrush, objectDefinitionId: string) => void;
  setLoadedChunkWindow: (window: LoadedChunkWindowContext | null) => void;
  setMap: (map: EditorMapDefinition) => void;
  setRegionId: (regionId: string) => void;
  setStatus: (message: string) => void;
  setWorldId: (worldId: string) => void;
  updateInfoText: () => void;
};

export class EditorWorldLoadController {
  constructor(private readonly callbacks: EditorWorldLoadCallbacks) {}

  async restoreWorkingDraft(): Promise<boolean> {
    const draft = loadEditorWorkingDraft();

    if (!draft) {
      return false;
    }

    this.callbacks.setMap(draft);
    this.callbacks.setLoadedChunkWindow(null);
    this.callbacks.clearSaveSnapshot();
    this.callbacks.clearHistory();
    await this.callbacks.applyMapCustomDefinitions();
    const restoredWindow = await this.restoreLoadedWorldWindowContextFromDraft(draft.id);
    if (restoredWindow?.sourceType === 'world') {
      this.callbacks.markAllChunksDirty(draft.width, draft.height);
    }
    return true;
  }

  persistWorkingDraft(): void {
    try {
      saveEditorWorkingDraft(this.callbacks.getMap());
    } catch (error) {
      this.callbacks.setStatus(error instanceof Error ? error.message : 'Editor draft save failed.');
    }
  }

  async loadWorldChunkWindowFromProject(
    worldId: string,
    centerChunkX: number,
    centerChunkY: number,
    radius: number,
  ): Promise<boolean> {
    try {
      const result = await loadEditorWorldChunkWindow({
        centerChunkX,
        centerChunkY,
        fallbackPaint: this.callbacks.getFallbackPaint(),
        radius,
        worldId,
      });

      if (result.manifest.chunkSize !== this.callbacks.chunkSize) {
        throw new Error(
          `World "${worldId}" uses chunk size ${result.manifest.chunkSize}, but the editor expects ${this.callbacks.chunkSize}.`,
        );
      }

      this.callbacks.setMap(result.map);
      this.callbacks.setWorldId(result.manifest.worldId);
      this.callbacks.setRegionId(result.regionId);
      this.callbacks.clearSaveSnapshot();
      this.callbacks.setLoadedChunkWindow({
        chunkSize: result.manifest.chunkSize,
        loadedChunks: result.loadedChunkKeys,
        occupiedChunks: result.authoredChunkKeys,
        originChunkX: result.originChunkX,
        originChunkY: result.originChunkY,
        regionId: result.regionId,
        sourceDisplayName: result.manifest.displayName,
        sourceMapId: result.manifest.worldId,
        sourceRecordId: `world:${result.manifest.worldId}`,
        sourceType: 'world',
        worldId: result.manifest.worldId,
      });
      this.callbacks.clearHistory();
      this.callbacks.clearDirtyChunks();
      this.callbacks.clearHoverTile();
      this.persistWorkingDraft();
      this.callbacks.centerCameraOnMap();
      await this.callbacks.applyMapCustomDefinitions();
      this.callbacks.refreshPalette(
        this.callbacks.getSelectedTerrainBrush(),
        this.callbacks.getSelectedObjectDefinitionId(),
      );
      this.callbacks.redrawTerrain();
      this.callbacks.redrawObjects();
      this.callbacks.redrawOverlay();
      this.callbacks.updateInfoText();
      this.callbacks.hideChunkWindowPanel();
      const endChunkX = result.originChunkX + Math.ceil(result.map.width / result.manifest.chunkSize) - 1;
      const endChunkY = result.originChunkY + Math.ceil(result.map.height / result.manifest.chunkSize) - 1;
      this.callbacks.setStatus(
        `Loaded ${result.manifest.displayName} chunks ` +
        `${result.originChunkX},${result.originChunkY}-${endChunkX},${endChunkY}.`,
      );
      return true;
    } catch (error) {
      this.callbacks.setStatus(error instanceof Error ? error.message : 'World chunk window load failed.');
      return false;
    }
  }

  private async restoreLoadedWorldWindowContextFromDraft(mapId: string): Promise<LoadedChunkWindowContext | null> {
    const match = /^(.+)_window_(-?\d+)_(-?\d+)_(-?\d+)_(-?\d+)$/.exec(mapId);

    if (!match) {
      return null;
    }

    const [, worldId, startChunkX, startChunkY, endChunkX, endChunkY] = match;

    try {
      const manifest = await loadWorldManifestFromProject(worldId);
      const originChunkX = Number.parseInt(startChunkX, 10);
      const originChunkY = Number.parseInt(startChunkY, 10);
      const lastChunkX = Number.parseInt(endChunkX, 10);
      const lastChunkY = Number.parseInt(endChunkY, 10);
      const restoredWindow: LoadedChunkWindowContext = {
        chunkSize: manifest.chunkSize,
        loadedChunks: createChunkKeySet(originChunkX, originChunkY, lastChunkX, lastChunkY),
        occupiedChunks: new Set(manifest.authoredChunks.map((chunk) => `${chunk.chunkX},${chunk.chunkY}`)),
        originChunkX,
        originChunkY,
        regionId: manifest.defaultRegionId,
        sourceDisplayName: manifest.displayName,
        sourceMapId: manifest.worldId,
        sourceRecordId: `world:${manifest.worldId}`,
        sourceType: 'world',
        worldId: manifest.worldId,
      };
      this.callbacks.setWorldId(manifest.worldId);
      this.callbacks.setRegionId(manifest.defaultRegionId);
      this.callbacks.setLoadedChunkWindow(restoredWindow);
      return restoredWindow;
    } catch {
      this.callbacks.setLoadedChunkWindow(null);
      return null;
    }
  }
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
