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

export function addCustomObjectDefinitions(
  catalog: EditorObjectCatalog,
  definitions: ObjectDefinition[],
): void {
  for (const definition of definitions) {
    const existing = catalog.byId.get(definition.id);

    if (existing) {
      Object.assign(existing, definition);
      continue;
    }

    catalog.all.push(definition);
    catalog.byId.set(definition.id, definition);
  }
}

export function removeCustomObjectDefinition(
  catalog: EditorObjectCatalog,
  definitionId: string,
): boolean {
  const definition = catalog.byId.get(definitionId);

  if (!definition || !definition.id.startsWith('custom_')) {
    return false;
  }

  catalog.byId.delete(definitionId);
  catalog.all = catalog.all.filter((candidate) => candidate.id !== definitionId);
  return true;
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
