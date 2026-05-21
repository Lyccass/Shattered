import Phaser from 'phaser';
import { PROTOTYPE_SCALE } from '../../config/prototypeScale';
import {
  addEditorPlacedObject,
  removeEditorPlacedObjectsAtTile,
  type EditorMapDefinition,
} from '../../shared/editor/EditorMapModel';
import type { ObjectDefinition, SpriteVisualPart } from '../../objects/ObjectTypes';
import {
  addCustomObjectDefinitions,
  createEditorObjectCatalog,
  getObjectAtOffset,
  removeCustomObjectDefinition,
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

  addCustomDefinitions(definitions: ObjectDefinition[]): void {
    addCustomObjectDefinitions(this.catalog, definitions);
  }

  createCustomDefinitionFromSelected(
    id: string,
    displayName: string,
    blocksMovement: boolean,
    textureKey?: string,
    textureDataUrl?: string,
    category = this.selectedObjectDefinition.category,
    footprintWidth = getFootprintWidth(this.selectedObjectDefinition.collisionFootprint),
    footprintHeight = getFootprintHeight(this.selectedObjectDefinition.collisionFootprint),
    textureWidth?: number,
    textureHeight?: number,
  ): ObjectDefinition {
    const definition: ObjectDefinition = {
      ...structuredCloneObjectDefinition(this.selectedObjectDefinition),
      id,
      category,
      collisionFootprint: createRectFootprint(footprintWidth, footprintHeight),
      displayName,
      blocksMovement,
      debug: {
        ...this.selectedObjectDefinition.debug,
        color: blocksMovement ? 0xef4444 : 0x3b82f6,
        label: displayName,
      },
    };

    if (textureKey) {
      const fitScale = getFootprintFitScale(textureWidth, textureHeight, footprintWidth, footprintHeight);
      definition.visual = {
        parts: replaceFirstSpritePart(
          definition.visual.parts,
          textureKey,
          textureDataUrl,
          footprintWidth,
          footprintHeight,
          fitScale,
          fitScale !== undefined ? 'ground' : 'preserve',
        ),
      };
    } else {
      definition.visual = {
        parts: centreSpritePartsForFootprint(definition.visual.parts, footprintWidth, footprintHeight),
      };
    }

    addCustomObjectDefinitions(this.catalog, [definition]);
    this.selectedObjectDefinition = definition;
    return definition;
  }

  deleteCustomDefinition(id: string): boolean {
    const deleted = removeCustomObjectDefinition(this.catalog, id);

    if (deleted && this.selectedObjectDefinition.id === id) {
      this.selectedObjectDefinition = this.catalog.all[0];
    }

    return deleted;
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

function structuredCloneObjectDefinition(definition: ObjectDefinition): ObjectDefinition {
  return JSON.parse(JSON.stringify(definition)) as ObjectDefinition;
}

function createRectFootprint(width: number, height: number): ObjectDefinition['collisionFootprint'] {
  const safeWidth = Math.max(1, Math.min(8, Math.trunc(width)));
  const safeHeight = Math.max(1, Math.min(8, Math.trunc(height)));
  const footprint: Array<{ x: number; y: number }> = [];

  for (let y = 0; y < safeHeight; y += 1) {
    for (let x = 0; x < safeWidth; x += 1) {
      footprint.push({ x, y });
    }
  }

  return footprint;
}

function getFootprintWidth(footprint: ObjectDefinition['collisionFootprint']): number {
  return Math.max(1, ...footprint.map((tile) => tile.x + 1));
}

function getFootprintHeight(footprint: ObjectDefinition['collisionFootprint']): number {
  return Math.max(1, ...footprint.map((tile) => tile.y + 1));
}

function replaceFirstSpritePart(
  parts: ObjectDefinition['visual']['parts'],
  textureKey: string,
  textureDataUrl?: string,
  footprintWidth = 1,
  footprintHeight = 1,
  fitScale?: number,
  anchorMode: 'ground' | 'preserve' = 'preserve',
): ObjectDefinition['visual']['parts'] {
  const nextParts = centreSpritePartsForFootprint(parts, footprintWidth, footprintHeight);
  const spritePart = nextParts.find((part): part is SpriteVisualPart => part.shape === 'sprite');
  const center = getFootprintCenterOffset(footprintWidth, footprintHeight);

  if (spritePart) {
    spritePart.textureKey = textureKey;
    spritePart.editorTextureDataUrl = textureDataUrl;
    spritePart.localOffsetX = center.x;
    spritePart.localOffsetY = center.y;
    if (fitScale !== undefined) {
      spritePart.scale = fitScale;
    }
    if (anchorMode === 'ground') {
      spritePart.originX = 0.5;
      spritePart.originY = 0.5;
    }
    return nextParts;
  }

  return [
    {
      shape: 'sprite',
      textureKey,
      editorTextureDataUrl: textureDataUrl,
      scale: fitScale ?? 1,
      originX: 0.5,
      originY: anchorMode === 'ground' ? 0.5 : 1,
      localOffsetX: center.x,
      localOffsetY: center.y,
    },
  ];
}

function centreSpritePartsForFootprint(
  parts: ObjectDefinition['visual']['parts'],
  footprintWidth: number,
  footprintHeight: number,
): ObjectDefinition['visual']['parts'] {
  const center = getFootprintCenterOffset(footprintWidth, footprintHeight);
  return parts.map((part) => {
    if (part.shape !== 'sprite') {
      return { ...part };
    }

    return {
      ...part,
      localOffsetX: center.x,
      localOffsetY: center.y,
    };
  });
}

function getFootprintCenterOffset(footprintWidth: number, footprintHeight: number): { x: number; y: number } {
  return {
    x: ((footprintWidth - footprintHeight) * PROTOTYPE_SCALE.tileWidth) / 4,
    y: ((footprintWidth + footprintHeight - 2) * PROTOTYPE_SCALE.tileHeight) / 4,
  };
}

function getFootprintFitScale(
  textureWidth: number | undefined,
  textureHeight: number | undefined,
  footprintWidth: number,
  footprintHeight: number,
): number | undefined {
  if (
    textureWidth === undefined ||
    textureHeight === undefined ||
    textureWidth <= 0 ||
    textureHeight <= 0
  ) {
    return undefined;
  }

  const safeFootprintWidth = Math.max(1, Math.min(8, Math.trunc(footprintWidth)));
  const safeFootprintHeight = Math.max(1, Math.min(8, Math.trunc(footprintHeight)));
  const footprintPixelWidth = ((safeFootprintWidth + safeFootprintHeight) * PROTOTYPE_SCALE.tileWidth) / 2;
  const footprintPixelHeight = Math.max(
    PROTOTYPE_SCALE.tileHeight * 2,
    (safeFootprintWidth + safeFootprintHeight) * PROTOTYPE_SCALE.tileHeight,
  );
  const fitScale = Math.min(footprintPixelWidth / textureWidth, footprintPixelHeight / textureHeight);

  return Math.max(0.05, Math.min(1, fitScale));
}
