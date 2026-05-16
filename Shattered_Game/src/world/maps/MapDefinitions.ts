import { OBJECT_DEFINITIONS } from '../../objects/ObjectDefinitions';
import type { MapDefinition } from './MapTypes';
import { validateMapDefinition } from './MapDefinitionValidator';
import { MapRegistry } from './MapRegistry';
import { TEST_MAPS } from './TestMaps';

const MAP_REGISTRY = new MapRegistry();

TEST_MAPS.forEach((registration) => {
  MAP_REGISTRY.registerMapFactory(registration);
});

export function hasMapDefinition(mapId: string): boolean {
  return MAP_REGISTRY.hasMap(mapId);
}

export function listMapIds(): string[] {
  return MAP_REGISTRY.listMapIds();
}

export function getMapDisplayName(mapId: string): string {
  return MAP_REGISTRY.getDisplayName(mapId);
}

export function getMapDefinition(mapId: string): MapDefinition {
  return MAP_REGISTRY.getMapDefinition(mapId);
}

export function validateRegisteredMap(mapId: string): MapDefinition {
  const definition = getMapDefinition(mapId);
  validateMapDefinition(definition, OBJECT_DEFINITIONS);
  return definition;
}

export function validateAllRegisteredMaps(): MapDefinition[] {
  return listMapIds().map((mapId) => validateRegisteredMap(mapId));
}
