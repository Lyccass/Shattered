import Phaser from 'phaser';
import { PROTOTYPE_SCALE } from '../config/prototypeScale';
import { IsoTransform } from './IsoTransform';
import type { GridMode } from './IsoTilemapTypes';
import { WorldGrid } from './WorldGrid';
import { TerrainResolutionCache } from './terrain/TerrainResolutionCache';
import {
  createChunkConfig,
  getChunkCoordForTile,
  getChunkRangeForWorldView,
  getChunkKey,
  isChunkCoordInRange,
  type TerrainChunkConfig,
  type TerrainChunkRange,
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
  prefetchGroundBuildBudgetPerFrame?: number;
  gridBuildBudgetPerFrame?: number;
  groundBuildTimeBudgetMs?: number;
  gridBuildTimeBudgetMs?: number;
};

type BuildQueueResult = {
  builtKeys: string[];
  processedTiles: number;
};

type InvalidateTileRectOptions = {
  includeBleed?: boolean;
};

const GROUND_BUILD_BATCH_SIZE = 32;
const GRID_BUILD_BATCH_SIZE = 24;

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
  private readonly prefetchGroundBuildBudgetPerFrame: number;
  private readonly gridBuildBudgetPerFrame: number;
  private readonly groundBuildTimeBudgetMs: number;
  private readonly gridBuildTimeBudgetMs: number;
  private readonly drawSystem: TerrainChunkDrawSystem;
  private readonly chunkConfigsByKey = new Map<string, TerrainChunkConfig>();
  private readonly materializedChunks = new Map<string, MaterializedTerrainChunk>();
  private readonly chunkCountX: number;
  private readonly chunkCountY: number;
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
    this.prefetchGroundBuildBudgetPerFrame = config.prefetchGroundBuildBudgetPerFrame
      ?? PROTOTYPE_SCALE.terrainChunkPrefetchGroundBuildBudgetPerFrame;
    this.gridBuildBudgetPerFrame = config.gridBuildBudgetPerFrame
      ?? PROTOTYPE_SCALE.terrainChunkGridBuildBudgetPerFrame;
    this.groundBuildTimeBudgetMs = config.groundBuildTimeBudgetMs
      ?? PROTOTYPE_SCALE.terrainChunkGroundBuildTimeBudgetMs;
    this.gridBuildTimeBudgetMs = config.gridBuildTimeBudgetMs
      ?? PROTOTYPE_SCALE.terrainChunkGridBuildTimeBudgetMs;
    this.chunkCountX = Math.ceil(config.worldGrid.width / this.chunkSize);
    this.chunkCountY = Math.ceil(config.worldGrid.height / this.chunkSize);
    this.drawSystem = new TerrainChunkDrawSystem(
      config.scene,
      config.transform,
      config.terrainResolutionCache,
    );
  }

  render(): void {
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

  invalidateTileRect(
    tileX: number,
    tileY: number,
    width: number,
    height: number,
    options: InvalidateTileRectOptions = {},
  ): void {
    const bleedTiles = options.includeBleed ?? true
      ? this.bleedTiles
      : 0;
    const minCoord = getChunkCoordForTile(
      Math.max(0, tileX - bleedTiles),
      Math.max(0, tileY - bleedTiles),
      this.chunkSize,
    );
    const maxCoord = getChunkCoordForTile(
      Math.min(this.config.worldGrid.width - 1, tileX + width - 1 + bleedTiles),
      Math.min(this.config.worldGrid.height - 1, tileY + height - 1 + bleedTiles),
      this.chunkSize,
    );

    for (let chunkY = minCoord.chunkY; chunkY <= maxCoord.chunkY; chunkY += 1) {
      for (let chunkX = minCoord.chunkX; chunkX <= maxCoord.chunkX; chunkX += 1) {
        const key = getChunkKey(chunkX, chunkY);
        const chunk = this.materializedChunks.get(key);

        if (chunk) {
          this.drawSystem.destroyChunk(chunk);
          this.materializedChunks.delete(key);
        }

        this.chunkConfigsByKey.delete(key);
      }
    }
  }

  getChunkStats(): TerrainChunkStats {
    return {
      configuredChunkCount: this.getChunkCount(),
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
    return this.chunkCountX * this.chunkCountY;
  }

  destroy(): void {
    this.config.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.updateChunkLifecycle, this);

    for (const chunk of this.materializedChunks.values()) {
      this.drawSystem.destroyChunk(chunk);
    }

    this.materializedChunks.clear();
    this.visibleChunkCount = 0;
    this.evictedChunkCount = 0;
    this.peakMaterializedChunkCount = 0;
    this.pendingGroundBuildCount = 0;
    this.pendingGridBuildCount = 0;
    this.chunkConfigsByKey.clear();
    this.drawSystem.destroy();
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
    const visibleGroundBuildKeys = new Set<string>();
    const prefetchGroundBuildKeys = new Set<string>();
    const pendingGridBuildKeys = new Set<string>();
    const centerChunkX = Math.floor((visibleRange.minChunkX + visibleRange.maxChunkX) / 2);
    const centerChunkY = Math.floor((visibleRange.minChunkY + visibleRange.maxChunkY) / 2);
    this.ensureChunkConfigsForRange(retainRange);

    for (const config of Array.from(this.chunkConfigsByKey.values())) {
      const isVisible = isChunkCoordInRange(config.chunkX, config.chunkY, visibleRange);
      const shouldRetain = isChunkCoordInRange(config.chunkX, config.chunkY, retainRange);
      let chunk = this.materializedChunks.get(config.key);

      if (isVisible) {
        if (!chunk) {
          visibleGroundBuildKeys.add(config.key);
        } else {
          chunk.groundLayer.setVisible(chunk.isGroundReady);

          if (chunk.isGroundReady) {
            visibleChunkCount += 1;
          } else {
            visibleGroundBuildKeys.add(config.key);
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
      } else if (shouldRetain) {
        if (!chunk) {
          prefetchGroundBuildKeys.add(config.key);
        } else {
          chunk.groundLayer.setVisible(false);
          chunk.gridLayer.setVisible(false);

          if (!chunk.isGroundReady) {
            prefetchGroundBuildKeys.add(config.key);
          }

          if (chunk.builtGridMode !== 'off' || chunk.gridBuildMode !== 'off') {
            this.drawSystem.clearGridChunk(chunk);
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
          this.chunkConfigsByKey.delete(config.key);
          this.evictedChunkCount += 1;
          chunk = undefined;
        }
      } else if (!shouldRetain) {
        this.chunkConfigsByKey.delete(config.key);
      }

      if (chunk) {
        this.refreshChunkDebugState(chunk, isVisible);
      }
    }

    const sortedVisibleGroundKeys = this.sortChunkKeysByDistance(
      Array.from(visibleGroundBuildKeys),
      centerChunkX,
      centerChunkY,
    );
    const sortedPrefetchGroundKeys = this.sortChunkKeysByDistance(
      Array.from(prefetchGroundBuildKeys).filter((key) => !visibleGroundBuildKeys.has(key)),
      centerChunkX,
      centerChunkY,
    );
    const sortedPendingGridKeys = this.sortChunkKeysByDistance(
      Array.from(pendingGridBuildKeys),
      centerChunkX,
      centerChunkY,
    );
    const frameStartedAt = this.now();

    const visibleBuildResult = this.processGroundBuildQueue(
      sortedVisibleGroundKeys,
      this.groundBuildBudgetPerFrame,
      frameStartedAt,
      this.groundBuildTimeBudgetMs,
      true,
    );
    const visibleGroundStillPending = sortedVisibleGroundKeys.some((key) => {
      const chunk = this.materializedChunks.get(key);
      return !chunk || !chunk.isGroundReady;
    });
    const prefetchBuildResult = !visibleGroundStillPending
      ? this.processGroundBuildQueue(
          sortedPrefetchGroundKeys,
          this.prefetchGroundBuildBudgetPerFrame,
          frameStartedAt,
          this.groundBuildTimeBudgetMs,
          false,
        )
      : { builtKeys: [], processedTiles: 0 };
    const builtGroundKeys = [
      ...visibleBuildResult.builtKeys,
      ...prefetchBuildResult.builtKeys,
    ];
    visibleChunkCount += builtGroundKeys.filter((key) => {
      const config = this.chunkConfigsByKey.get(key);
      return !!config && isChunkCoordInRange(config.chunkX, config.chunkY, visibleRange);
    }).length;

    builtGroundKeys.forEach((key) => {
      if (this.gridMode !== 'off') {
        sortedPendingGridKeys.push(key);
      }
    });

    const dedupedGridKeys = Array.from(new Set(sortedPendingGridKeys));
    this.processGridBuildQueue(
      dedupedGridKeys,
      this.gridBuildBudgetPerFrame,
      frameStartedAt,
      this.gridBuildTimeBudgetMs,
    );

    this.pendingGroundBuildCount = [...sortedVisibleGroundKeys, ...sortedPrefetchGroundKeys].filter((key) => {
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

  private ensureChunkConfigsForRange(range: TerrainChunkRange): void {
    for (let chunkY = range.minChunkY; chunkY <= range.maxChunkY; chunkY += 1) {
      for (let chunkX = range.minChunkX; chunkX <= range.maxChunkX; chunkX += 1) {
        const key = getChunkKey(chunkX, chunkY);

        if (this.chunkConfigsByKey.has(key)) {
          continue;
        }

        this.chunkConfigsByKey.set(key, createChunkConfig({
          chunkX,
          chunkY,
          mapWidth: this.config.worldGrid.width,
          mapHeight: this.config.worldGrid.height,
          chunkSize: this.chunkSize,
          bleedTiles: this.bleedTiles,
          transform: this.config.transform,
        }));
      }
    }
  }

  private processGroundBuildQueue(
    keys: string[],
    budget: number,
    frameStartedAt: number,
    timeBudgetMs: number,
    debugVisible: boolean,
  ): BuildQueueResult {
    const builtKeys: string[] = [];
    let remainingBudget = budget;
    let processedTiles = 0;
    let materializedChunkThisFrame = false;

    for (const key of keys) {
      if (remainingBudget <= 0 || !this.hasFrameTimeRemaining(frameStartedAt, timeBudgetMs)) {
        break;
      }

      const config = this.chunkConfigsByKey.get(key);

      if (!config) {
        continue;
      }

      let chunk = this.materializedChunks.get(key);

      if (!chunk) {
        if (materializedChunkThisFrame) {
          continue;
        }

        chunk = this.materializeChunk(config);
        materializedChunkThisFrame = true;
        this.refreshChunkDebugState(chunk, debugVisible);
        continue;
      }

      if (chunk.isGroundReady) {
        builtKeys.push(key);
        continue;
      }

      const batchBudget = Math.min(remainingBudget, GROUND_BUILD_BATCH_SIZE);
      const processedBatchTiles = this.drawSystem.buildGroundChunkStep(chunk, batchBudget);
      remainingBudget -= processedBatchTiles;
      processedTiles += processedBatchTiles;
      this.refreshChunkDebugState(chunk, debugVisible);

      if (chunk.isGroundReady) {
        builtKeys.push(key);
      }
    }

    return { builtKeys, processedTiles };
  }

  private processGridBuildQueue(
    keys: string[],
    budget: number,
    frameStartedAt: number,
    timeBudgetMs: number,
  ): void {
    let remainingBudget = budget;

    for (const key of keys) {
      if (remainingBudget <= 0 || !this.hasFrameTimeRemaining(frameStartedAt, timeBudgetMs)) {
        break;
      }

      const chunk = this.materializedChunks.get(key);

      if (!chunk || !chunk.isGroundReady || chunk.builtGridMode === this.gridMode || this.gridMode === 'off') {
        continue;
      }

      const processedTiles = this.drawSystem.buildGridChunkStep(
        chunk,
        this.gridMode,
        Math.min(remainingBudget, GRID_BUILD_BATCH_SIZE),
      );
      remainingBudget -= processedTiles;
    }
  }

  private hasFrameTimeRemaining(frameStartedAt: number, timeBudgetMs: number): boolean {
    return this.now() - frameStartedAt < timeBudgetMs;
  }

  private now(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
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
