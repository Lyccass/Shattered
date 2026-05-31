import Phaser from 'phaser';
import type { EditorMapDefinition } from '../../shared/editor/EditorMapModel';
import type { EditorTerrainToolController } from '../terrain/EditorTerrainToolController';
import type { EditorAssetLibraryController } from './EditorAssetLibraryController';
import { loadImageFromDataUrl } from './EditorDefinitionImage';

type EditorAssetTextureCallbacks = {
  getMap: () => EditorMapDefinition;
  persistWorkingDraft: () => void;
  redrawTerrain: () => void;
  setMap: (map: EditorMapDefinition) => void;
  updateInfoText: () => void;
};

export class EditorAssetTextureWorkflowController {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly assetLibrary: EditorAssetLibraryController,
    private readonly terrainTool: EditorTerrainToolController,
    private readonly tileWidth: number,
    private readonly tileHeight: number,
    private readonly callbacks: EditorAssetTextureCallbacks,
  ) {}

  async applyMapCustomDefinitions(): Promise<void> {
    await this.assetLibrary.applyMapDefinitions(this.callbacks.getMap());
    this.repairImportedTerrainScales();
  }

  getTexturePreviewDataUrl(textureKey: string | null): string | null {
    if (!textureKey || !this.scene.textures.exists(textureKey)) {
      return null;
    }

    return this.scene.textures.getBase64(textureKey);
  }

  loadDroppedTexture(textureKey: string, dataUrl: string): Promise<string> {
    if (this.scene.textures.exists(textureKey)) {
      this.scene.textures.remove(textureKey);
    }

    return new Promise((resolve, reject) => {
      const onLoad = (loadedKey: string): void => {
        if (loadedKey !== textureKey) {
          return;
        }

        cleanup();
        resolve(textureKey);
      };
      const onError = (failedKey: string): void => {
        if (failedKey !== textureKey) {
          return;
        }

        cleanup();
        reject(new Error(`Could not load image for ${textureKey}.`));
      };
      const cleanup = (): void => {
        this.scene.textures.off('onload', onLoad);
        this.scene.textures.off('onerror', onError);
      };

      this.scene.textures.on('onload', onLoad);
      this.scene.textures.on('onerror', onError);
      this.scene.textures.addBase64(textureKey, dataUrl);
    });
  }

  private repairImportedTerrainScales(): void {
    const map = this.callbacks.getMap();
    const repairs: Array<Promise<{ key: string; scale: number } | null>> = [];

    const enqueueRepair = (
      key: string,
      paint: { textureDataUrl?: string; textureScale?: number },
    ): void => {
      if (!paint.textureDataUrl || paint.textureScale !== undefined) return;
      repairs.push(
        loadImageFromDataUrl(paint.textureDataUrl)
          .then((image) => {
            const scale = this.getTerrainTileFitScale(image.width, image.height);
            return scale !== undefined ? { key, scale } : null;
          })
          .catch(() => null),
      );
    };

    for (const paint of map.customTerrainBrushes) {
      enqueueRepair(`brush:${paint.id}`, paint);
    }
    for (const [tileKey, paint] of Object.entries(map.terrainTiles)) {
      enqueueRepair(`tile:${tileKey}`, paint);
    }

    if (repairs.length === 0) return;

    void Promise.all(repairs).then((results) => {
      const fixes = results.filter((r): r is { key: string; scale: number } => r !== null);
      if (fixes.length === 0) return;

      const scaleByBrushId: Record<string, number> = {};
      const scaleByTileKey: Record<string, number> = {};
      for (const { key, scale } of fixes) {
        if (key.startsWith('brush:')) scaleByBrushId[key.slice(6)] = scale;
        else scaleByTileKey[key.slice(5)] = scale;
      }

      const currentMap = this.callbacks.getMap();
      const repairedMap = {
        ...currentMap,
        customTerrainBrushes: currentMap.customTerrainBrushes.map((p) =>
          scaleByBrushId[p.id] !== undefined ? { ...p, textureScale: scaleByBrushId[p.id] } : p,
        ),
        terrainTiles: Object.fromEntries(
          Object.entries(currentMap.terrainTiles).map(([k, p]) =>
            scaleByTileKey[k] !== undefined ? [k, { ...p, textureScale: scaleByTileKey[k] }] : [k, p],
          ),
        ),
      };
      this.callbacks.setMap(repairedMap);
      this.terrainTool.addCustomPaints(repairedMap.customTerrainBrushes);
      this.callbacks.persistWorkingDraft();
      this.callbacks.redrawTerrain();
      this.callbacks.updateInfoText();
    });
  }

  private getTerrainTileFitScale(
    textureWidth: number | undefined,
    textureHeight: number | undefined,
  ): number | undefined {
    if (
      textureWidth === undefined ||
      textureHeight === undefined ||
      textureWidth <= 0 ||
      textureHeight <= 0
    ) {
      return undefined;
    }

    const scale = Math.min(this.tileWidth / textureWidth, this.tileHeight / textureHeight);
    return Math.max(0.05, Math.min(1, scale));
  }
}
