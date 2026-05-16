import Phaser from 'phaser';
import { PROTOTYPE_SCALE } from '../config/prototypeScale';
import { IsoTransform } from './IsoTransform';
import type { GridMode } from './IsoTilemapTypes';
import { WorldGrid } from './WorldGrid';
import { TerrainResolutionCache } from './terrain/TerrainResolutionCache';
import {
  createChunkConfigs,
  getChunkRangeForWorldView,
  isChunkCoordInRange,
  type TerrainChunkConfig,
} from './chunks/TerrainChunkMath';
import {
  MaterializedTerrainChunk,
  TerrainChunkDrawSystem,
} from './chunks/TerrainChunkDrawSystem';

type IsoTilemapChunkRendererConfig = {
  scene: Phaser.Scene;
  transform: IsoTransform;
  worldGrid: WorldGrid;
  terrainResolutionCache: TerrainResolutionCache;
  chunkSize?: number;
  visibleChunkRadius?: number;
  retainChunkRadius?: number;
  bleedTiles?: number;
};

export type TerrainChunkStats = {
  configuredChunkCount: number;
  materializedChunkCount: number;
  visibleChunkCount: number;
  cachedChunkCount: number;
  evictedChunkCount: number;
  chunkDebugEnabled: boolean;
};

export class IsoTilemapChunkRenderer {
  private readonly chunkSize: number;
  private readonly visibleChunkRadius: number;
  private readonly retainChunkRadius: number;
  private readonly bleedTiles: number;
  private readonly drawSystem: TerrainChunkDrawSystem;
  private readonly chunkConfigs: TerrainChunkConfig[] = [];
  private readonly materializedChunks = new Map<string, MaterializedTerrainChunk>();
  private gridMode: GridMode = 'off';
  private chunkDebugVisible = false;
  private visibleChunkCount = 0;
  private evictedChunkCount = 0;

  constructor(
    private readonly config: IsoTilemapChunkRendererConfig,
  ) {
    this.chunkSize = config.chunkSize ?? PROTOTYPE_SCALE.terrainChunkSize;
    this.visibleChunkRadius = config.visibleChunkRadius ?? PROTOTYPE_SCALE.terrainChunkVisibleRadius;
    this.retainChunkRadius = config.retainChunkRadius ?? PROTOTYPE_SCALE.terrainChunkRetainRadius;
    this.bleedTiles = config.bleedTiles ?? PROTOTYPE_SCALE.terrainChunkBleedTiles;
    this.drawSystem = new TerrainChunkDrawSystem(
      config.scene,
      config.transform,
      config.terrainResolutionCache,
    );
  }

  render(): void {
    this.registerChunkConfigs();
    this.config.scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.updateChunkLifecycle, this);
    this.updateChunkLifecycle();
  }

  setGridMode(gridMode: GridMode): void {
    this.gridMode = gridMode;

    for (const chunk of this.materializedChunks.values()) {
      this.drawSystem.drawGridChunk(chunk, this.gridMode);
    }

    this.updateChunkLifecycle();
  }

  toggleChunkDebug(): boolean {
    this.chunkDebugVisible = !this.chunkDebugVisible;
    this.updateChunkLifecycle();
    return this.chunkDebugVisible;
  }

  getChunkStats(): TerrainChunkStats {
    return {
      configuredChunkCount: this.chunkConfigs.length,
      materializedChunkCount: this.materializedChunks.size,
      visibleChunkCount: this.visibleChunkCount,
      cachedChunkCount: Math.max(0, this.materializedChunks.size - this.visibleChunkCount),
      evictedChunkCount: this.evictedChunkCount,
      chunkDebugEnabled: this.chunkDebugVisible,
    };
  }

  getChunkCount(): number {
    return this.chunkConfigs.length;
  }

  destroy(): void {
    this.config.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.updateChunkLifecycle, this);

    for (const chunk of this.materializedChunks.values()) {
      this.drawSystem.destroyChunk(chunk);
    }

    this.materializedChunks.clear();
    this.chunkConfigs.length = 0;
    this.visibleChunkCount = 0;
    this.evictedChunkCount = 0;
    this.drawSystem.destroy();
  }

  private registerChunkConfigs(): void {
    if (this.chunkConfigs.length > 0) {
      return;
    }

    this.chunkConfigs.push(
      ...createChunkConfigs({
        mapWidth: this.config.worldGrid.width,
        mapHeight: this.config.worldGrid.height,
        chunkSize: this.chunkSize,
        bleedTiles: this.bleedTiles,
        transform: this.config.transform,
      }),
    );
  }

  private updateChunkLifecycle(): void {
    const worldView = this.config.scene.cameras.main.worldView;
    const visibleRange = getChunkRangeForWorldView({
      worldView,
      transform: this.config.transform,
      chunkSize: this.chunkSize,
      radius: this.visibleChunkRadius,
      mapWidth: this.config.worldGrid.width,
      mapHeight: this.config.worldGrid.height,
    });
    const retainRange = getChunkRangeForWorldView({
      worldView,
      transform: this.config.transform,
      chunkSize: this.chunkSize,
      radius: this.retainChunkRadius,
      mapWidth: this.config.worldGrid.width,
      mapHeight: this.config.worldGrid.height,
    });

    let visibleChunkCount = 0;

    for (const config of this.chunkConfigs) {
      const isVisible = isChunkCoordInRange(config.chunkX, config.chunkY, visibleRange);
      const shouldRetain = isChunkCoordInRange(config.chunkX, config.chunkY, retainRange);
      let chunk = this.materializedChunks.get(config.key);

      if (isVisible) {
        if (!chunk) {
          chunk = this.materializeChunk(config);
        }

        chunk.groundLayer.setVisible(true);
        chunk.gridLayer.setVisible(this.gridMode !== 'off');
        visibleChunkCount += 1;
      } else if (chunk) {
        chunk.groundLayer.setVisible(false);
        chunk.gridLayer.setVisible(false);

        if (!shouldRetain) {
          this.drawSystem.destroyChunk(chunk);
          this.materializedChunks.delete(config.key);
          this.evictedChunkCount += 1;
          chunk = undefined;
        }
      }

      if (chunk) {
        this.drawSystem.drawChunkDebugOutline(chunk, {
          visible: isVisible,
          debugVisible: this.chunkDebugVisible,
        });
      }
    }

    this.visibleChunkCount = visibleChunkCount;
  }

  private materializeChunk(config: TerrainChunkConfig): MaterializedTerrainChunk {
    const chunk = this.drawSystem.materializeChunk(config);

    this.drawSystem.drawGroundChunk(chunk);
    this.drawSystem.drawGridChunk(chunk, this.gridMode);
    this.drawSystem.drawChunkDebugOutline(chunk, {
      visible: true,
      debugVisible: this.chunkDebugVisible,
    });
    this.materializedChunks.set(config.key, chunk);

    return chunk;
  }
}
