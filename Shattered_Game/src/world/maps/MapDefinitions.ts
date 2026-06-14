import { OBJECT_DEFINITIONS } from '../../objects/ObjectDefinitions';
import {
  loadPublishedEditorMapDefinition,
  parseEditorObjectDefinitions,
} from '../../shared/editor/EditorMapModel';
import type { MapDefinition } from './MapTypes';
import { validateMapDefinition } from './MapDefinitionValidator';
import { MapRegistry } from './MapRegistry';

const MAP_REGISTRY = new MapRegistry();

export function hasMapDefinition(mapId: string): boolean {
  return MAP_REGISTRY.hasMap(mapId) || (
    shouldUsePublishedEditorMap() &&
    loadPublishedEditorMapDefinition()?.id === mapId
  );
}

export function listMapIds(): string[] {
  const ids = MAP_REGISTRY.listMapIds();

  if (!shouldUsePublishedEditorMap()) {
    return ids;
  }

  const publishedMap = loadPublishedEditorMapDefinition();
  return publishedMap && !ids.includes(publishedMap.id) ? [...ids, publishedMap.id] : ids;
}

export function getMapDisplayName(mapId: string): string {
  const publishedMap = shouldUsePublishedEditorMap()
    ? loadPublishedEditorMapDefinition()
    : null;

  if (publishedMap?.id === mapId) {
    return publishedMap.displayName;
  }

  return MAP_REGISTRY.getDisplayName(mapId);
}

export function getMapDefinition(mapId: string): MapDefinition {
  const publishedMap = shouldUsePublishedEditorMap()
    ? loadPublishedEditorMapDefinition()
    : null;

  if (publishedMap?.id === mapId) {
    return publishedMap;
  }

  return MAP_REGISTRY.getMapDefinition(mapId);
}

export function validateRegisteredMap(mapId: string): MapDefinition {
  const definition = getMapDefinition(mapId);
  validateMapDefinition(definition, [
    ...OBJECT_DEFINITIONS,
    ...parseEditorObjectDefinitions(definition.metadata?.editorObjectDefinitions),
  ]);
  return definition;
}

export function getPublishedEditorMapId(): string | null {
  if (!shouldUsePublishedEditorMap()) {
    return null;
  }

  return loadPublishedEditorMapDefinition()?.id ?? null;
}

function shouldUsePublishedEditorMap(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return new URLSearchParams(window.location.search).get('editorMap') === '1';
}

export function validateAllRegisteredMaps(): MapDefinition[] {
  return listMapIds().map((mapId) => validateRegisteredMap(mapId));
}
