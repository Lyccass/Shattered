import {
  createEditorMapFromMapDefinition,
  createEditorMapFromWorldChunkDefinition,
  parseEditorMapJson,
  resizeEditorMap,
  serializeEditorMap,
  serializeEditorMapAsWorldChunk,
  type EditorMapDefinition,
  type EditorTerrainTilePaint,
} from '../../shared/editor/EditorMapModel';
import { EDITOR_CHUNK_SIZE } from '../terrain/EditorTerrainChunkRenderer';
import type { ChunkCoordinate } from '../../shared/world/ChunkKey';
import { validateWorldChunkDefinition } from '../../shared/world/ChunkValidation';
import type { WorldChunkDefinition } from '../../shared/world/ChunkTypes';
import {
  applyDirtyChunkBundle,
  createDirtyChunkBundle,
  parseDirtyChunkBundleJson,
  type DirtyChunkExportOptions,
  type EditorDirtyChunkBundleV1,
} from '../chunks/EditorDirtyChunkBundle';

type FilePickerAccept = Record<string, string[]>;
type FilePickerType = { description?: string; accept: FilePickerAccept };

declare function showSaveFilePicker(options?: {
  suggestedName?: string;
  types?: FilePickerType[];
}): Promise<FileSystemFileHandle>;

declare function showOpenFilePicker(options?: {
  types?: FilePickerType[];
  multiple?: boolean;
}): Promise<FileSystemFileHandle[]>;

type WorldChunkExportOptions = {
  chunkX: number;
  chunkY: number;
  regionId: string;
  worldId: string;
};

export class EditorMapIoController {
  private fileHandle: FileSystemFileHandle | null = null;

  async saveToFile(map: EditorMapDefinition): Promise<'saved' | 'cancelled'> {
    const json = serializeEditorMap(map);
    const name = `${map.displayName.toLowerCase().replace(/\s+/g, '-')}.json`;

    if (!('showSaveFilePicker' in window)) {
      await this.writeExport(json);
      return 'saved';
    }

    try {
      const handle = await showSaveFilePicker({
        suggestedName: this.fileHandle?.name ?? name,
        types: [{ description: 'Map JSON', accept: { 'application/json': ['.json'] } }],
      });
      this.fileHandle = handle;
      await this.writeToHandle(handle, json);
      return 'saved';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return 'cancelled';
      }
      throw err;
    }
  }

  async quickSaveToFile(map: EditorMapDefinition): Promise<'saved' | 'cancelled' | 'no-file-api'> {
    if (!('showSaveFilePicker' in window)) {
      await this.writeExport(serializeEditorMap(map));
      return 'no-file-api';
    }

    if (!this.fileHandle) {
      return this.saveToFile(map) as Promise<'saved' | 'cancelled'>;
    }

    await this.writeToHandle(this.fileHandle, serializeEditorMap(map));
    return 'saved';
  }

  async openFromFile(): Promise<EditorMapDefinition | null> {
    if (!('showOpenFilePicker' in window)) {
      return this.importFromPrompt();
    }

    try {
      const [handle] = await showOpenFilePicker({
        types: [{ description: 'Map JSON', accept: { 'application/json': ['.json'] } }],
      });
      const file = await handle.getFile();
      const json = await file.text();
      const map = this.parseEditorImport(json);
      this.fileHandle = handle;
      return map;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return null;
      }
      throw err;
    }
  }

  getFileHandle(): FileSystemFileHandle | null {
    return this.fileHandle;
  }

  async exportMap(map: EditorMapDefinition): Promise<'clipboard' | 'console'> {
    return this.writeExport(serializeEditorMap(map));
  }

  async exportWorldChunk(
    map: EditorMapDefinition,
    options: WorldChunkExportOptions,
  ): Promise<'clipboard' | 'console'> {
    return this.writeExport(serializeEditorMapAsWorldChunk(map, options));
  }

  async exportDirtyChunks(
    map: EditorMapDefinition,
    dirtyChunks: ChunkCoordinate[],
    options: DirtyChunkExportOptions,
  ): Promise<'clipboard' | 'console'> {
    const bundle = createDirtyChunkBundle(map, dirtyChunks, options);
    return this.writeExport(JSON.stringify(bundle, null, 2));
  }

  importFromPrompt(): EditorMapDefinition | null {
    const json = window.prompt('Paste map JSON');

    if (!json) {
      return null;
    }

    return this.parseEditorImport(json);
  }

  importDirtyChunksFromPrompt(map: EditorMapDefinition): {
    bundle: EditorDirtyChunkBundleV1;
    map: EditorMapDefinition;
  } | null {
    const json = window.prompt('Paste dirty chunk bundle JSON');

    if (!json) {
      return null;
    }

    const bundle = parseDirtyChunkBundleJson(json);
    return {
      bundle,
      map: applyDirtyChunkBundle(map, bundle),
    };
  }

  resizeFromPrompt(
    map: EditorMapDefinition,
    fill: EditorTerrainTilePaint,
  ): EditorMapDefinition | null {
    const value = window.prompt('New map size as width,height', `${map.width},${map.height}`);

    if (!value) {
      return null;
    }

    const [rawW, rawH] = value
      .split(',')
      .map((part) => Number.parseInt(part.trim(), 10));

    const snapToChunk = (n: number) => Math.max(EDITOR_CHUNK_SIZE, Math.ceil(n / EDITOR_CHUNK_SIZE) * EDITOR_CHUNK_SIZE);

    return resizeEditorMap(map, snapToChunk(rawW), snapToChunk(rawH), fill);
  }

  private async writeToHandle(handle: FileSystemFileHandle, json: string): Promise<void> {
    const writable = await handle.createWritable();
    await writable.write(json);
    await writable.close();
  }

  private async writeExport(json: string): Promise<'clipboard' | 'console'> {
    console.log(json);

    if (!navigator.clipboard) {
      return 'console';
    }

    try {
      await navigator.clipboard.writeText(json);
      return 'clipboard';
    } catch {
      return 'console';
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
