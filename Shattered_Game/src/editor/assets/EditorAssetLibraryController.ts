import Phaser from 'phaser';
import type { ObjectDefinition } from '../../objects/ObjectTypes';
import type { EditorMapDefinition, EditorTerrainTilePaint } from '../../shared/editor/EditorMapModel';
import {
  loadEditorAssetLibrary,
  saveEditorAssetLibrary,
  syncEditorAssetLibraryFromProject,
  type EditorAssetLibrary,
} from '../io/EditorLocalLibrary';
import type { EditorObjectToolController } from '../objects/EditorObjectToolController';
import type { EditorTerrainToolController } from '../terrain/EditorTerrainToolController';

export class EditorAssetLibraryController {
  private library: EditorAssetLibrary = loadEditorAssetLibrary();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly terrainTool: EditorTerrainToolController,
    private readonly objectTool: EditorObjectToolController,
  ) {}

  async syncGlobalAssets(): Promise<void> {
    this.library = await syncEditorAssetLibraryFromProject();
    await this.registerAssetTextures(this.library);
    this.applyLibraryToTools();
  }

  async applyMapDefinitions(map: EditorMapDefinition): Promise<void> {
    const mapLibrary: EditorAssetLibrary = {
      objectDefinitions: map.customObjectDefinitions,
      terrainBrushes: map.customTerrainBrushes,
    };

    await this.registerAssetTextures(mapLibrary);
    this.terrainTool.addCustomPaints(map.customTerrainBrushes);
    this.objectTool.addCustomDefinitions(map.customObjectDefinitions);
  }

  addTerrainPaint(paint: EditorTerrainTilePaint): void {
    this.library = {
      ...this.library,
      terrainBrushes: upsertById(this.library.terrainBrushes, paint),
    };
    this.terrainTool.addCustomPaints([paint]);
    this.save();
  }

  addObjectDefinition(definition: ObjectDefinition): void {
    this.library = {
      ...this.library,
      objectDefinitions: upsertById(this.library.objectDefinitions, definition),
    };
    this.objectTool.addCustomDefinitions([definition]);
    this.save();
  }

  removeTerrainPaint(id: string): void {
    this.library = {
      ...this.library,
      terrainBrushes: this.library.terrainBrushes.filter((paint) => paint.id !== id),
    };
    this.save();
  }

  removeObjectDefinition(id: string): void {
    this.library = {
      ...this.library,
      objectDefinitions: this.library.objectDefinitions.filter((definition) => definition.id !== id),
    };
    this.save();
  }

  hydrateMapForSerialization(map: EditorMapDefinition): EditorMapDefinition {
    const placedDefinitionIds = new Set(map.objects.map((object) => object.definitionId));
    const objectDefinitions = mergeById(
      map.customObjectDefinitions,
      this.library.objectDefinitions.filter((definition) => placedDefinitionIds.has(definition.id)),
    );

    return {
      ...map,
      customObjectDefinitions: objectDefinitions,
      customTerrainBrushes: map.customTerrainBrushes,
    };
  }

  private applyLibraryToTools(): void {
    this.terrainTool.addCustomPaints(this.library.terrainBrushes);
    this.objectTool.addCustomDefinitions(this.library.objectDefinitions);
  }

  private async registerAssetTextures(library: EditorAssetLibrary): Promise<void> {
    const loads: Promise<void>[] = [];

    for (const paint of library.terrainBrushes) {
      if (paint.textureDataUrl && !this.scene.textures.exists(paint.textureKey)) {
        loads.push(this.loadAndRegisterTexture(paint.textureKey, paint.textureDataUrl));
      }
    }

    for (const definition of library.objectDefinitions) {
      for (const part of definition.visual.parts) {
        if (part.shape === 'sprite' && part.editorTextureDataUrl && !this.scene.textures.exists(part.textureKey)) {
          loads.push(this.loadAndRegisterTexture(part.textureKey, part.editorTextureDataUrl));
        }
      }
    }

    await Promise.all(loads);
  }

  private async loadAndRegisterTexture(textureKey: string, dataUrl: string): Promise<void> {
    if (this.scene.textures.exists(textureKey)) {
      return;
    }

    const image = await loadImageFromDataUrl(dataUrl);

    if (!this.scene.textures.exists(textureKey)) {
      this.scene.textures.addImage(textureKey, image);
    }
  }

  private save(): void {
    saveEditorAssetLibrary(this.library);
  }
}

function upsertById<T extends { id: string }>(items: T[], item: T): T[] {
  return [
    ...items.filter((candidate) => candidate.id !== item.id),
    item,
  ];
}

function mergeById<T extends { id: string }>(first: T[], second: T[]): T[] {
  const merged = new Map<string, T>();

  for (const item of first) {
    merged.set(item.id, item);
  }

  for (const item of second) {
    merged.set(item.id, item);
  }

  return Array.from(merged.values());
}

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load editor asset image.'));
    image.src = dataUrl;
  });
}
