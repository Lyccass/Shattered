import { OBJECT_DEFINITIONS } from '../../objects/ObjectDefinitions';
import type { ObjectDefinition } from '../../objects/ObjectTypes';

export type EditorObjectCatalog = {
  all: ObjectDefinition[];
  byId: Map<string, ObjectDefinition>;
};

export function createEditorObjectCatalog(): EditorObjectCatalog {
  return {
    all: OBJECT_DEFINITIONS,
    byId: new Map(OBJECT_DEFINITIONS.map((definition) => [definition.id, definition])),
  };
}

export function getObjectAtOffset(
  catalog: EditorObjectCatalog,
  currentDefinitionId: string,
  offset: number,
): ObjectDefinition {
  const index = catalog.all.findIndex((definition) => definition.id === currentDefinitionId);
  const currentIndex = index >= 0 ? index : 0;
  const nextIndex = wrapIndex(currentIndex + offset, catalog.all.length);
  return catalog.all[nextIndex];
}

function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}
