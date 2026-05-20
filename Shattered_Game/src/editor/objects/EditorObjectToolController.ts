import Phaser from 'phaser';
import {
  addEditorPlacedObject,
  removeEditorPlacedObjectsAtTile,
  type EditorMapDefinition,
} from '../../shared/editor/EditorMapModel';
import type { ObjectDefinition, SpriteVisualPart } from '../../objects/ObjectTypes';
import {
  createEditorObjectCatalog,
  getObjectAtOffset,
  type EditorObjectCatalog,
} from './EditorObjectCatalog';

export type EditorObjectRemoveResult = {
  map: EditorMapDefinition;
  removed: boolean;
};

export class EditorObjectToolController {
  private readonly catalog = createEditorObjectCatalog();
  private selectedObjectDefinition: ObjectDefinition = this.catalog.all[0];

  getCatalog(): EditorObjectCatalog {
    return this.catalog;
  }

  getSelectedDefinition(): ObjectDefinition {
    return this.selectedObjectDefinition;
  }

  /** Returns the textureKey of the first sprite part, or null for geometry-only objects. */
  getPreviewTextureKey(): string | null {
    const spritePart = this.selectedObjectDefinition.visual.parts
      .find((p): p is SpriteVisualPart => p.shape === 'sprite');
    return spritePart?.textureKey ?? null;
  }

  /** Fallback colour for geometry-only objects (from their debug colour). */
  getPreviewColor(): number {
    return this.selectedObjectDefinition.debug?.color ?? 0x888888;
  }

  selectById(id: string): ObjectDefinition {
    const def = this.catalog.byId.get(id);
    if (def) {
      this.selectedObjectDefinition = def;
    }
    return this.selectedObjectDefinition;
  }

  cycle(offset: number): ObjectDefinition {
    this.selectedObjectDefinition = getObjectAtOffset(
      this.catalog,
      this.selectedObjectDefinition.id,
      offset,
    );
    return this.selectedObjectDefinition;
  }

  placeObject(map: EditorMapDefinition, tileX: number, tileY: number): EditorMapDefinition {
    const objectId = `editor_object_${Date.now()}_${map.objects.length}`;
    const mapWithoutExistingObject = removeEditorPlacedObjectsAtTile(map, tileX, tileY);

    return addEditorPlacedObject(mapWithoutExistingObject, {
      id: objectId,
      definitionId: this.selectedObjectDefinition.id,
      tileX,
      tileY,
    });
  }

  removeObject(map: EditorMapDefinition, tileX: number, tileY: number): EditorObjectRemoveResult {
    const previousObjectCount = map.objects.length;
    const nextMap = removeEditorPlacedObjectsAtTile(map, tileX, tileY);

    return {
      map: nextMap,
      removed: nextMap.objects.length < previousObjectCount,
    };
  }

  shouldDeleteWithPointer(pointer: Phaser.Input.Pointer): boolean {
    return (
      pointer.leftButtonDown() &&
      'shiftKey' in pointer.event &&
      pointer.event.shiftKey
    );
  }
}
