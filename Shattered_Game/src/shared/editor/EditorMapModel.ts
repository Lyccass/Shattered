export type {
  EditorWorldZoneTag,
  EditorTerrainTilePaint,
  EditorPlacedObject,
  EditorEnemySpawn,
  EditorNpcAnchor,
  EditorMapDefinition,
  EditorMapExportOptions,
} from './EditorMapTypes';
export {
  EDITOR_WORLD_ZONE_TAGS,
  EDITOR_ZONE_COLORS,
  EDITOR_GAME_MAP_STORAGE_KEY,
  createEditorMap,
  createSampleEditorMap,
} from './EditorMapTypes';

export {
  paintTerrainTile,
  paintTerrain,
  paintTerrainWalkability,
  paintTerrainElevation,
  paintTerrainZone,
  getEditorTerrainZoneAt,
  getEditorTerrainAt,
  getEditorTerrainTilePaint,
  getEditorTerrainWalkabilityAt,
  getEditorTerrainElevationAt,
} from './EditorTerrainLayerModel';

export {
  addEditorPlacedObject,
  removeEditorPlacedObjectsAtTile,
} from './EditorObjectLayerModel';

export { resizeEditorMap } from './EditorMapResize';

export {
  exportEditorMapToMapDefinition,
  createEditorMapFromMapDefinition,
  serializeEditorMap,
  serializeEditorMapForProjectLibrary,
  parseEditorMapJson,
  parseEditorTerrainTiles,
  parseEditorTerrainBrushes,
  parseEditorTerrainWalkability,
  parseEditorTerrainElevation,
  parseEditorObjectDefinitions,
} from './EditorMapSerializer';

export {
  exportEditorMapToWorldChunkDefinition,
  createEditorMapFromWorldChunkDefinition,
  serializeEditorMapAsWorldChunk,
} from './EditorChunkAdapter';

export {
  publishEditorMapForGame,
  clearPublishedEditorMapForGame,
  loadPublishedEditorMapDefinition,
} from './EditorProjectLibraryApi';
