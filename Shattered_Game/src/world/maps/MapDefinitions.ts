import { OBJECT_DEFINITIONS } from '../../objects/ObjectDefinitions';
import type { MapDefinition } from './MapTypes';
import { validateMapDefinitions } from './MapDefinitionValidator';
import { TEST_MAPS } from './TestMaps';

export const MAP_DEFINITIONS: MapDefinition[] = TEST_MAPS;

validateMapDefinitions(MAP_DEFINITIONS, OBJECT_DEFINITIONS);

const MAP_DEFINITIONS_BY_ID = new Map(
  MAP_DEFINITIONS.map((definition) => [definition.id, definition] as const),
);

export function getMapDefinition(mapId: string): MapDefinition {
  const definition = MAP_DEFINITIONS_BY_ID.get(mapId);

  if (!definition) {
    throw new Error(`MapDefinitions: unknown map "${mapId}"`);
  }

  return definition;
}
