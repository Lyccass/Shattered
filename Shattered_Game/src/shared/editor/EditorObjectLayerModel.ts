import type { EditorMapDefinition, EditorPlacedObject } from './EditorMapTypes';

export function addEditorPlacedObject(
  map: EditorMapDefinition,
  object: EditorPlacedObject,
): EditorMapDefinition {
  return {
    ...map,
    objects: [...map.objects, object],
  };
}

export function removeEditorPlacedObjectsAtTile(
  map: EditorMapDefinition,
  tileX: number,
  tileY: number,
): EditorMapDefinition {
  return {
    ...map,
    objects: map.objects.filter((object) => object.tileX !== tileX || object.tileY !== tileY),
  };
}
