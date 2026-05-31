import {
  mapDefinitionToSingleWorldChunk,
  worldChunkDefinitionToMapDefinition,
  type MapToChunkOptions,
} from '../world/ChunkAdapters';
import type { WorldChunkDefinition } from '../world/ChunkTypes';
import type { EditorMapDefinition, EditorMapExportOptions } from './EditorMapTypes';
import {
  exportEditorMapToMapDefinition,
  createEditorMapFromMapDefinition,
} from './EditorMapSerializer';

export function exportEditorMapToWorldChunkDefinition(
  map: EditorMapDefinition,
  options: MapToChunkOptions & EditorMapExportOptions,
): WorldChunkDefinition {
  return mapDefinitionToSingleWorldChunk(exportEditorMapToMapDefinition(map, options), options);
}

export function createEditorMapFromWorldChunkDefinition(chunk: WorldChunkDefinition): EditorMapDefinition {
  return createEditorMapFromMapDefinition(worldChunkDefinitionToMapDefinition(chunk));
}

export function serializeEditorMapAsWorldChunk(
  map: EditorMapDefinition,
  options: MapToChunkOptions,
): string {
  return JSON.stringify(exportEditorMapToWorldChunkDefinition(map, options), null, 2);
}
