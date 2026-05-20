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
import { validateWorldChunkDefinition } from '../../shared/world/ChunkValidation';
import type { WorldChunkDefinition } from '../../shared/world/ChunkTypes';

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

  async exportWorldChunk(
    map: EditorMapDefinition,
    options: WorldChunkExportOptions,
  ): Promise<'clipboard' | 'console'> {
    return this.writeExport(serializeEditorMapAsWorldChunk(map, options));
  }

  importFromPrompt(): EditorMapDefinition | null {
    const json = window.prompt('Paste map JSON');

    if (!json) {
      return null;
    }

    return this.parseEditorImport(json);
  }

  resizeFromPrompt(
    map: EditorMapDefinition,
    fill: EditorTerrainTilePaint,
  ): EditorMapDefinition | null {
    const value = window.prompt('New map size as width,height', `${map.width},${map.height}`);

    if (!value) {
      return null;
    }

    const [widthValue, heightValue] = value
      .split(',')
      .map((part) => Number.parseInt(part.trim(), 10));

    return resizeEditorMap(map, widthValue, heightValue, fill);
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
