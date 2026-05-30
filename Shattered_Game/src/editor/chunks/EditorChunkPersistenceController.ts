import type { EditorMapDefinition } from '../../shared/editor/EditorMapModel';
import type { ChunkCoordinate } from '../../shared/world/ChunkKey';
import { createDirtyChunkBundle } from './EditorDirtyChunkBundle';
import {
  applySavedChunkBundle,
  consumeEditorLibraryCacheMessage,
  deleteSavedChunkBundle,
  listSavedChunkBundlesFromProjectLibrary,
  saveDirtyChunkBundleToProjectLibrary,
} from '../io/EditorLocalLibrary';
import { saveWorldChunksToProject } from '../io/EditorWorldLibrary';
import type { EditorLibraryPanelController } from '../ui/EditorLibraryPanelController';
import type { EditorSaveSnapshot } from '../workflow/EditorSaveConfidence';

type LoadedChunkWindowSaveContext = {
  chunkSize: number;
  occupiedChunks: Set<string>;
  originChunkX: number;
  originChunkY: number;
  regionId: string;
  sourceMapId: string;
  sourceType: 'map' | 'world';
  worldId: string;
};

type EditorChunkPersistenceCallbacks = {
  chunkSize: number;
  applyMapCustomDefinitions: () => Promise<void>;
  clearDirtyChunks: () => void;
  getDirtyChunks: () => ChunkCoordinate[];
  getLoadedChunkWindow: () => LoadedChunkWindowSaveContext | null;
  getMap: () => EditorMapDefinition;
  getRegionId: () => string;
  getSerializableMap: () => EditorMapDefinition;
  getWorldId: () => string;
  persistWorkingDraft: () => void;
  redrawObjects: () => void;
  redrawOverlay: () => void;
  redrawTerrain: () => void;
  setMap: (map: EditorMapDefinition) => void;
  setStatus: (message: string) => void;
  snapshot: (map: EditorMapDefinition) => void;
  updateInfoText: () => void;
};

export class EditorChunkPersistenceController {
  private lastSaveSnapshot: EditorSaveSnapshot | null = null;

  constructor(
    private readonly libraryPanel: EditorLibraryPanelController,
    private readonly callbacks: EditorChunkPersistenceCallbacks,
  ) {}

  getLastSaveSnapshot(): EditorSaveSnapshot | null {
    return this.lastSaveSnapshot;
  }

  clearLastSaveSnapshot(): void {
    this.lastSaveSnapshot = null;
  }

  async saveDirtyChunksToLibrary(): Promise<boolean> {
    try {
      const dirtyChunks = this.callbacks.getDirtyChunks();

      if (dirtyChunks.length === 0) {
        this.callbacks.setStatus('No dirty chunks to save.');
        return true;
      }

      const loadedWindow = this.callbacks.getLoadedChunkWindow();
      const bundle = createDirtyChunkBundle(this.callbacks.getSerializableMap(), dirtyChunks, {
        chunkSize: this.callbacks.chunkSize,
        originChunkX: loadedWindow?.originChunkX ?? 0,
        originChunkY: loadedWindow?.originChunkY ?? 0,
        regionId: loadedWindow?.regionId ?? this.callbacks.getRegionId(),
        sourceMapId: loadedWindow?.sourceMapId,
        worldId: loadedWindow?.worldId ?? this.callbacks.getWorldId(),
      });

      if (loadedWindow?.sourceType === 'world') {
        const result = await saveWorldChunksToProject(bundle);
        if (result.verifiedChunkCount !== result.savedChunkCount) {
          throw new Error(`Saved ${result.savedChunkCount} chunk(s), but only ${result.verifiedChunkCount} verified on disk.`);
        }
        loadedWindow.occupiedChunks = new Set([
          ...loadedWindow.occupiedChunks,
          ...bundle.chunks.map((chunk) => `${chunk.chunkX},${chunk.chunkY}`),
        ]);
        this.lastSaveSnapshot = {
          savedAt: new Date(),
          savedChunkCount: result.savedChunkCount,
          target: 'project-world',
          worldId: result.worldId,
        };
        this.callbacks.clearDirtyChunks();
        this.callbacks.updateInfoText();
        this.callbacks.setStatus(`Saved and verified ${result.savedChunkCount} chunk(s) to ${result.worldId}.`);
        return true;
      }

      const record = await saveDirtyChunkBundleToProjectLibrary(bundle);
      this.lastSaveSnapshot = {
        savedAt: new Date(),
        savedChunkCount: record.chunkCount,
        target: 'chunk-library',
        worldId: bundle.worldId,
      };
      this.callbacks.clearDirtyChunks();
      this.callbacks.updateInfoText();
      this.callbacks.setStatus(withCacheMessage(`Saved ${record.chunkCount} dirty chunk(s) to project chunk library.`));
      return true;
    } catch (error) {
      this.callbacks.setStatus(error instanceof Error ? error.message : 'Dirty chunk save failed.');
      return false;
    }
  }

  async openChunkLibrary(): Promise<void> {
    this.libraryPanel.showChunks(await listSavedChunkBundlesFromProjectLibrary(), {
      onDelete: (recordId) => {
        deleteSavedChunkBundle(recordId);
        void this.openChunkLibrary();
      },
      onLoad: (recordId) => this.loadChunksFromLibrary(recordId),
    });
  }

  loadChunksFromLibrary(recordId: string): void {
    try {
      const map = this.callbacks.getMap();
      const loadedWindow = this.callbacks.getLoadedChunkWindow();
      this.callbacks.snapshot(map);
      this.callbacks.setMap(applySavedChunkBundle(
        map,
        recordId,
        loadedWindow?.originChunkX ?? 0,
        loadedWindow?.originChunkY ?? 0,
      ));
      this.callbacks.clearDirtyChunks();
      this.callbacks.persistWorkingDraft();
      void this.callbacks.applyMapCustomDefinitions().then(() => {
        this.callbacks.redrawTerrain();
        this.callbacks.redrawObjects();
        this.callbacks.redrawOverlay();
        this.callbacks.updateInfoText();
      });
      this.libraryPanel.close();
      this.callbacks.setStatus('Chunk bundle loaded from editor library.');
    } catch (error) {
      this.callbacks.setStatus(error instanceof Error ? error.message : 'Chunk library load failed.');
    }
  }
}

function withCacheMessage(message: string): string {
  const cacheMessage = consumeEditorLibraryCacheMessage();
  return cacheMessage ? `${message} ${cacheMessage}` : message;
}
