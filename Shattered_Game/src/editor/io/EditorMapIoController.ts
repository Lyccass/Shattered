import {
  clearPublishedEditorMapForGame,
  publishEditorMapForGame,
  serializeEditorMap,
  serializeEditorMapAsWorldChunk,
  type EditorMapDefinition,
} from '../../shared/editor/EditorMapModel';
import type { ChunkCoordinate } from '../../shared/world/ChunkKey';
import {
  createDirtyChunkBundle,
  type DirtyChunkExportOptions,
} from '../chunks/EditorDirtyChunkBundle';

type WorldChunkExportOptions = {
  chunkX: number;
  chunkY: number;
  regionId: string;
  worldId: string;
};

export class EditorMapIoController {
  async exportMap(map: EditorMapDefinition): Promise<'clipboard' | 'console'> {
    return this.writeExport(serializeEditorMap(map));
  }

  publishToGame(map: EditorMapDefinition): void {
    publishEditorMapForGame(map);
  }

  clearPublishedGameMap(): void {
    clearPublishedEditorMapForGame();
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
}
