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
  groundBuildBudgetPerFrame?: number;
  gridBuildBudgetPerFrame?: number;
};

export type TerrainChunkStats = {
  configuredChunkCount: number;
  materializedChunkCount: number;
  visibleChunkCount: number;
  cachedChunkCount: number;
  evictedChunkCount: number;
  peakMaterializedChunkCount: number;
  pendingGroundBuildCount: number;
  pendingGridBuildCount: number;
  chunkDebugEnabled: boolean;
};

export class IsoTilemapChunkRenderer {
  private readonly chunkSize: number;
  private readonly visibleChunkRadius: number;
  private readonly retainChunkRadius: number;
  private readonly bleedTiles: number;
  private readonly groundBuildBudgetPerFrame: number;
  private readonly gridBuildBudgetPerFrame: number;
  private readonly drawSystem: TerrainChunkDrawSystem;
  private readonly chunkConfigs: TerrainChunkConfig[] = [];
  private readonly chunkConfigsByKey = new Map<string, TerrainChunkConfig>();
  private readonly materializedChunks = new Map<string, MaterializedTerrainChunk>();
  private gridMode: GridMode = 'off';
  private chunkDebugVisible = false;
  private visibleChunkCount = 0;
  private evictedChunkCount = 0;
  private peakMaterializedChunkCount = 0;
  private pendingGroundBuildCount = 0;
  private pendingGridBuildCount = 0;

  constructor(
    private readonly config: IsoTilemapChunkRendererConfig,
  ) {
    this.chunkSize = config.chunkSize ?? PROTOTYPE_SCALE.terrainChunkSize;
    this.visibleChunkRadius = config.visibleChunkRadius ?? PROTOTYPE_SCALE.terrainChunkVisibleRadius;
    this.retainChunkRadius = config.retainChunkRadius ?? PROTOTYPE_SCALE.terrainChunkRetainRadius;
    this.bleedTiles = config.bleedTiles ?? PROTOTYPE_SCALE.terrainChunkBleedTiles;
    this.groundBuildBudgetPerFrame = config.groundBuildBudgetPerFrame
      ?? PROTOTYPE_SCALE.terrainChunkGroundBuildBudgetPerFrame;
    this.gridBuildBudgetPerFrame = config.gridBuildBudgetPerFrame
      ?? PROTOTYPE_SCALE.terrainChunkGridBuildBudgetPerFrame;
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
    if (this.gridMode === gridMode) {
      return;
    }

    this.gridMode = gridMode;

    for (const chunk of this.materializedChunks.values()) {
      if (chunk.builtGridMode !== 'off' || chunk.gridBuildMode !== 'off') {
        this.drawSystem.clearGridChunk(chunk);
      }
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
      peakMaterializedChunkCount: this.peakMaterializedChunkCount,
      pendingGroundBuildCount: this.pendingGroundBuildCount,
      pendingGridBuildCount: this.pendingGridBuildCount,
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
    this.peakMaterializedChunkCount = 0;
    this.pendingGroundBuildCount = 0;
    this.pendingGridBuildCount = 0;
    this.chunkConfigsByKey.clear();
    this.drawSystem.destroy();
  }

  private registerChunkConfigs(): void {
    if (this.chunkConfigs.length > 0) {
      return;
    }

    const configs = createChunkConfigs({
        mapWidth: this.config.worldGrid.width,
        mapHeight: this.config.worldGrid.height,
        chunkSize: this.chunkSize,
        bleedTiles: this.bleedTiles,
        transform: this.config.transform,
      });
    this.chunkConfigs.push(...configs);
    configs.forEach((config) => {
      this.chunkConfigsByKey.set(config.key, config);
    });
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
    const pendingGroundBuildKeys = new Set<string>();
    const pendingGridBuildKeys = new Set<string>();
    const centerChunkX = Math.floor((visibleRange.minChunkX + visibleRange.maxChunkX) / 2);
    const centerChunkY = Math.floor((visibleRange.minChunkY + visibleRange.maxChunkY) / 2);

    for (const config of this.chunkConfigs) {
      const isVisible = isChunkCoordInRange(config.chunkX, config.chunkY, visibleRange);
      const shouldRetain = isChunkCoordInRange(config.chunkX, config.chunkY, retainRange);
      let chunk = this.materializedChunks.get(config.key);

      if (isVisible) {
        if (!chunk) {
          pendingGroundBuildKeys.add(config.key);
        } else {
          chunk.groundLayer.setVisible(chunk.isGroundReady);

          if (chunk.isGroundReady) {
            visibleChunkCount += 1;
          } else {
            pendingGroundBuildKeys.add(config.key);
          }

          if (this.gridMode === 'off') {
            if (chunk.builtGridMode !== 'off' || chunk.gridBuildMode !== 'off') {
              this.drawSystem.clearGridChunk(chunk);
            }
          } else if (chunk.isGroundReady) {
            if (chunk.builtGridMode === this.gridMode) {
              chunk.gridLayer.setVisible(true);
            } else {
              chunk.gridLayer.setVisible(false);
              pendingGridBuildKeys.add(config.key);
            }
          }
        }
      } else if (chunk) {
        chunk.groundLayer.setVisible(false);
        chunk.gridLayer.setVisible(false);

        if (chunk.builtGridMode !== 'off' || chunk.gridBuildMode !== 'off') {
          this.drawSystem.clearGridChunk(chunk);
        }

        if (!shouldRetain) {
          this.drawSystem.destroyChunk(chunk);
          this.materializedChunks.delete(config.key);
          this.evictedChunkCount += 1;
          chunk = undefined;
        }
      }

      if (chunk) {
        this.refreshChunkDebugState(chunk, isVisible);
      }
    }

    const sortedPendingGroundKeys = this.sortChunkKeysByDistance(
      Array.from(pendingGroundBuildKeys),
      centerChunkX,
      centerChunkY,
    );
    const sortedPendingGridKeys = this.sortChunkKeysByDistance(
      Array.from(pendingGridBuildKeys),
      centerChunkX,
      centerChunkY,
    );

    const builtGroundKeys = this.processGroundBuildQueue(
      sortedPendingGroundKeys,
      this.groundBuildBudgetPerFrame,
    );
    visibleChunkCount += builtGroundKeys.length;

    builtGroundKeys.forEach((key) => {
      if (this.gridMode !== 'off') {
        sortedPendingGridKeys.push(key);
      }
    });

    const dedupedGridKeys = Array.from(new Set(sortedPendingGridKeys));
    this.processGridBuildQueue(dedupedGridKeys, this.gridBuildBudgetPerFrame);

    this.pendingGroundBuildCount = sortedPendingGroundKeys.filter((key) => {
      const chunk = this.materializedChunks.get(key);
      return !chunk || !chunk.isGroundReady;
    }).length;
    this.pendingGridBuildCount = this.gridMode === 'off'
      ? 0
      : dedupedGridKeys.filter((key) => {
          const chunk = this.materializedChunks.get(key);
          return !!chunk && chunk.isGroundReady && chunk.builtGridMode !== this.gridMode;
        }).length;
    this.visibleChunkCount = visibleChunkCount;
  }

  private processGroundBuildQueue(keys: string[], budget: number): string[] {
    const builtKeys: string[] = [];
    let remainingBudget = budget;

    for (const key of keys) {
      if (remainingBudget <= 0) {
        break;
      }

      const config = this.chunkConfigsByKey.get(key);

      if (!config) {
        continue;
      }

      let chunk = this.materializedChunks.get(key);

      if (!chunk) {
        chunk = this.materializeChunk(config);
      }

      if (chunk.isGroundReady) {
        builtKeys.push(key);
        continue;
      }

      const processedTiles = this.drawSystem.buildGroundChunkStep(chunk, remainingBudget);
      remainingBudget -= processedTiles;
      this.refreshChunkDebugState(chunk, true);

      if (chunk.isGroundReady) {
        builtKeys.push(key);
      }
    }

    return builtKeys;
  }

  private processGridBuildQueue(keys: string[], budget: number): void {
    let remainingBudget = budget;

    for (const key of keys) {
      if (remainingBudget <= 0) {
        break;
      }

      const chunk = this.materializedChunks.get(key);

      if (!chunk || !chunk.isGroundReady || chunk.builtGridMode === this.gridMode || this.gridMode === 'off') {
        continue;
      }

      const processedTiles = this.drawSystem.buildGridChunkStep(chunk, this.gridMode, remainingBudget);
      remainingBudget -= processedTiles;
    }
  }

  private sortChunkKeysByDistance(
    keys: string[],
    centerChunkX: number,
    centerChunkY: number,
  ): string[] {
    return keys.sort((leftKey, rightKey) => {
      const left = this.chunkConfigsByKey.get(leftKey)!;
      const right = this.chunkConfigsByKey.get(rightKey)!;
      const leftDistance = Math.abs(left.chunkX - centerChunkX) + Math.abs(left.chunkY - centerChunkY);
      const rightDistance = Math.abs(right.chunkX - centerChunkX) + Math.abs(right.chunkY - centerChunkY);
      return leftDistance - rightDistance;
    });
  }

  private materializeChunk(config: TerrainChunkConfig): MaterializedTerrainChunk {
    const chunk = this.drawSystem.materializeChunk(config);

    chunk.groundLayer.setVisible(false);
    chunk.gridLayer.setVisible(false);
    this.materializedChunks.set(config.key, chunk);
    this.peakMaterializedChunkCount = Math.max(this.peakMaterializedChunkCount, this.materializedChunks.size);

    return chunk;
  }

  private refreshChunkDebugState(chunk: MaterializedTerrainChunk, isVisible: boolean): void {
    const signature = `${this.chunkDebugVisible}:${isVisible}`;

    if (chunk.lastDebugSignature === signature) {
      return;
    }

    this.drawSystem.drawChunkDebugOutline(chunk, {
      visible: isVisible,
      debugVisible: this.chunkDebugVisible,
    });
    chunk.lastDebugSignature = signature;
  }
}
