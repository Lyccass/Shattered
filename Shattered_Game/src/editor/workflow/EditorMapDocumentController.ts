import type { EditorMapDefinition } from '../../shared/editor/EditorMapModel';
import type { EditorAssetLibraryController } from '../assets/EditorAssetLibraryController';
import type { EditorDirtyChunkTracker } from '../chunks/EditorDirtyChunkTracker';
import type { EditorMapIoController } from '../io/EditorMapIoController';

type EditorMapDocumentCallbacks = {
  getMap: () => EditorMapDefinition;
  getRegionId: () => string;
  getWorldId: () => string;
  persistWorkingDraft: () => void;
  setMap: (map: EditorMapDefinition) => void;
  setStatus: (message: string) => void;
  updateInfoText: () => void;
};

export class EditorMapDocumentController {
  constructor(
    private readonly mapIo: EditorMapIoController,
    private readonly assetLibrary: EditorAssetLibraryController,
    private readonly dirtyChunks: EditorDirtyChunkTracker,
    private readonly callbacks: EditorMapDocumentCallbacks,
  ) {}

  renameMap(displayName: string): void {
    const trimmed = displayName.trim();
    const map = this.callbacks.getMap();

    if (!trimmed || trimmed === map.displayName) {
      this.callbacks.updateInfoText();
      return;
    }

    this.callbacks.setMap({
      ...map,
      displayName: trimmed,
      id: slugifyMapId(trimmed),
    });
    this.callbacks.updateInfoText();
    this.callbacks.persistWorkingDraft();
    this.callbacks.setStatus(`Map renamed to ${trimmed}.`);
  }

  async exportWorldChunk(): Promise<void> {
    const result = await this.mapIo.exportWorldChunk(this.getSerializableMap(), {
      worldId: this.callbacks.getWorldId(),
      regionId: this.callbacks.getRegionId(),
      chunkX: 0,
      chunkY: 0,
    });
    this.dirtyChunks.clear();
    this.callbacks.updateInfoText();
    this.callbacks.setStatus(
      result === 'clipboard'
        ? 'WorldChunkDefinition export copied to clipboard.'
        : 'WorldChunkDefinition export printed to console.',
    );
  }

  getSerializableMap(): EditorMapDefinition {
    return this.assetLibrary.hydrateMapForSerialization(this.callbacks.getMap());
  }
}

function slugifyMapId(displayName: string): string {
  const slug = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return slug || 'editor_map';
}
