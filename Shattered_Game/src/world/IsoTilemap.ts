import Phaser from 'phaser';
import { blendedForestSurfaceHeight } from '../shared/iso/ForestRelief';
import { isForestTerrain } from './terrain/ForestTerrainDefinitions';
import { PROTOTYPE_SCALE } from '../config/prototypeScale';
import { RENDER_DEPTHS } from '../render/RenderLayers';
import { generateOrganicIsland } from './IslandGenerator';
import { IsoTransform } from './IsoTransform';
import {
  IsoTilemapChunkRenderer,
  type TerrainChunkStats,
} from './IsoTilemapChunkRenderer';
import type { TileType } from './IsoTilemapTypes';
import type { WorldChunkDefinition } from '../shared/world/ChunkTypes';
import { decodeTerrainPaletteLayer, getExactTerrainPaletteEntry } from '../shared/world/TerrainPalette';
import {
  parseEditorTerrainElevation,
  parseEditorTerrainTiles,
  parseEditorTerrainWalkability,
} from '../shared/editor/EditorMapModel';
import type { ResolvedTerrainTile } from './terrain/TerrainTypes';
import { TerrainResolutionCache } from './terrain/TerrainResolutionCache';
import type { GridMode } from './IsoTilemapTypes';
import { WorldGrid } from './WorldGrid';

const MAP_MARGIN = 160;

type IsoTilemapConfig = {
  width?: number;
  height?: number;
  terrain?: TileType[][];
  defaultTerrain?: TileType;
  terrainElevation?: Record<string, number>;
  terrainWalkability?: Record<string, boolean>;
  exactTerrainPaints?: Record<string, {
    id: string;
    family: TileType;
    textureKey: string;
    textureOffsetX?: number;
    textureOffsetY?: number;
    textureScale?: number;
    walkable: boolean;
    flipX: boolean;
    flipY: boolean;
  }>;
};

type WorldPoint = {
  x: number;
  y: number;
};

type ApplyWorldChunkOptions = {
  invalidateAdjacentRendererChunks?: boolean;
};

// IsoTilemap is a coordinator/facade.
// It creates and wires WorldGrid (gameplay state), IsoTransform (coordinate projection),
// and IsoTilemapChunkRenderer (visual rendering), then exposes a stable interface
// for player and debug systems so they never need to reach through into subsystems.
export class IsoTilemap {
  readonly width: number;
  readonly height: number;
  readonly originX: number;
  readonly originY: number;
  readonly tileWidth = PROTOTYPE_SCALE.tileWidth;
  readonly tileHeight = PROTOTYPE_SCALE.tileHeight;
  // IsoTransform is the coordinate projection layer — grid ↔ world ↔ screen.
  readonly transform: IsoTransform;
  // WorldGrid is the authoritative gameplay state for the map.
  readonly worldGrid: WorldGrid;

  private readonly scene: Phaser.Scene;
  private readonly terrainResolutionCache: TerrainResolutionCache;
  private waterBackdrop?: Phaser.GameObjects.Rectangle;
  private renderer?: IsoTilemapChunkRenderer;
  private gridMode: GridMode = 'off';

  constructor(scene: Phaser.Scene, config: IsoTilemapConfig = {}) {
    this.scene = scene;
    const terrain = config.terrain;

    if (terrain) {
      validateTerrainLayer(terrain);
      this.width = terrain[0].length;
      this.height = terrain.length;
    } else {
      this.width = config.width ?? PROTOTYPE_SCALE.mapWidth;
      this.height = config.height ?? PROTOTYPE_SCALE.mapHeight;
    }

    this.originX = (this.height * this.tileWidth) / 2 + MAP_MARGIN;
    this.originY = MAP_MARGIN;
    this.transform = new IsoTransform({
      originX: this.originX,
      originY: this.originY,
      tileWidth: this.tileWidth,
      tileHeight: this.tileHeight,
    });
    const terrainWalkability = buildTerrainWalkabilityOverrides(
      config.terrainWalkability,
      config.exactTerrainPaints,
    );
    this.worldGrid = terrain
      ? new WorldGrid(
          this.width,
          this.height,
          terrain,
          terrainWalkability,
          config.terrainElevation,
        )
      : config.defaultTerrain
        ? WorldGrid.createSparse(
            this.width,
            this.height,
            config.defaultTerrain,
            terrainWalkability,
            config.terrainElevation,
          )
        : new WorldGrid(
            this.width,
            this.height,
            generateOrganicIsland(this.width, this.height),
            terrainWalkability,
            config.terrainElevation,
          );
    this.terrainResolutionCache = new TerrainResolutionCache(
      this.worldGrid,
      undefined,
      config.exactTerrainPaints,
    );
  }

  render(): Phaser.Geom.Rectangle {
    this.createWaterBackdrop();
    this.createChunkRenderer();
    return this.getWorldBounds();
  }

  destroy(): void {
    this.renderer?.destroy();
    this.renderer = undefined;
    this.waterBackdrop?.destroy();
    this.waterBackdrop = undefined;
    this.terrainResolutionCache.clear();
  }

  // --- Coordinate facade (delegates to IsoTransform) ---

  gridToWorld(gridX: number, gridY: number): WorldPoint {
    const point = this.transform.gridToWorld(gridX, gridY);
    return { x: point.x, y: point.y };
  }

  getTileCenterWorld(gridX: number, gridY: number): WorldPoint {
    const point = this.transform.getTileCenterWorld(gridX, gridY);
    return { x: point.x, y: point.y };
  }

  worldToGrid(worldX: number, worldY: number): WorldPoint {
    const point = this.transform.worldToGrid(worldX, worldY);
    return { x: point.x, y: point.y };
  }

  // --- Walkability facade (delegates to WorldGrid) ---

  isTileInBounds(tileX: number, tileY: number): boolean {
    return this.worldGrid.isTileInBounds(tileX, tileY);
  }

  isTileTerrainBlocked(tileX: number, tileY: number): boolean {
    return this.worldGrid.isTerrainBlocked(tileX, tileY);
  }

  getTerrainFamilyAtTile(tileX: number, tileY: number): string | null {
    return this.worldGrid.getTile(tileX, tileY);
  }

  getSurfaceLift(worldX: number, worldY: number): number {
    const grid=this.transform.worldToGrid(worldX,worldY);
    const tile=this.transform.gridToTile(grid);
    const current=this.resolveTerrainTile(tile.x,tile.y)?.baseTileDefinition;
    if(!current || !isForestTerrain(current.id))return 0;
    return blendedForestSurfaceHeight(grid.x+.5,grid.y+.5,(x,y)=>{
      const adjacent=this.resolveTerrainTile(x,y)?.baseTileDefinition;
      return adjacent ? (isForestTerrain(adjacent.id)?adjacent.id:adjacent.family) : null;
    });
  }

  surfaceToGround(worldX: number, worldY: number): Phaser.Math.Vector2 {
    let groundY=worldY;
    for(let pass=0;pass<12;pass++) {
      const next=worldY+this.getSurfaceLift(worldX,groundY);
      if(Math.abs(next-groundY)<.01){groundY=next;break;}
      groundY=next;
    }
    return new Phaser.Math.Vector2(worldX,groundY);
  }

  resolveTerrainTile(tileX: number, tileY: number): ResolvedTerrainTile | null {
    return this.terrainResolutionCache.resolveTile(tileX, tileY);
  }

  // Unified walkability check — terrain and future object blocking both feed in here.
  isTileWalkable(tileX: number, tileY: number): boolean {
    return this.worldGrid.isTileWalkable(tileX, tileY);
  }

  getTerrainElevation(tileX: number, tileY: number): number | null {
    return this.worldGrid.getTerrainElevation(tileX, tileY);
  }

  isStepWalkable(fromTileX: number, fromTileY: number, toTileX: number, toTileY: number, maxStepHeight = 1): boolean {
    return this.worldGrid.isStepWalkable(fromTileX, fromTileY, toTileX, toTileY, maxStepHeight);
  }

  // Fractional grid position walkability check (used by the debug overlay).
  isWorldGridWalkable(gridX: number, gridY: number): boolean {
    const tile = this.transform.gridToTile(new Phaser.Math.Vector2(gridX, gridY));
    return this.worldGrid.isTileWalkable(tile.x, tile.y);
  }

  getTerrainBlockedTileCount(): number {
    return this.worldGrid.getTerrainBlockedTileCount();
  }

  // --- Renderer info ---

  getTerrainChunkCount(): number {
    return this.renderer?.getChunkCount() ?? 0;
  }

  getTerrainChunkStats(): TerrainChunkStats | null {
    return this.renderer?.getChunkStats() ?? null;
  }

  applyWorldChunk(chunk: WorldChunkDefinition, options: ApplyWorldChunkOptions = {}): void {
    const terrain = chunk.terrain.encoding === 'palette'
      ? decodeTerrainPaletteLayer(chunk.terrainPalette ?? {}, chunk.terrain.tiles)
      : chunk.terrain.tiles;
    const startTileX = chunk.chunkX * chunk.width;
    const startTileY = chunk.chunkY * chunk.height;
    const defaultWalkable = typeof chunk.metadata?.defaultWalkable === 'boolean'
      ? chunk.metadata.defaultWalkable
      : null;
    const exactTerrainPaints = {
      ...parseEditorTerrainTiles(chunk.metadata?.editorTerrainTiles),
      ...decodeChunkExactTerrainPaints(chunk),
    };
    const terrainWalkability = parseEditorTerrainWalkability(chunk.metadata?.editorTerrainWalkability);
    const terrainElevation = parseEditorTerrainElevation(chunk.metadata?.editorTerrainElevation);

    this.terrainResolutionCache.replaceExactTerrainPaintsInRect(
      startTileX,
      startTileY,
      chunk.width,
      chunk.height,
      toAbsoluteTerrainPaints(exactTerrainPaints, startTileX, startTileY, chunk.width, chunk.height),
    );

    for (let localY = 0; localY < chunk.height; localY += 1) {
      for (let localX = 0; localX < chunk.width; localX += 1) {
        const tileX = startTileX + localX;
        const tileY = startTileY + localY;
        const localKey = tileKey(localX, localY);
        const terrainFamily = terrain[localY][localX];
        const exactPaint = exactTerrainPaints[localKey];
        const explicitWalkable = terrainWalkability[localKey];
        const resolvedWalkable = explicitWalkable ?? exactPaint?.walkable ?? defaultWalkable;

        this.worldGrid.setTile(tileX, tileY, terrainFamily);
        this.worldGrid.setTerrainWalkabilityOverride(
          tileX,
          tileY,
          resolvedWalkable !== null &&
            resolvedWalkable !== undefined &&
            resolvedWalkable !== isTerrainFamilyWalkableByDefault(terrainFamily)
            ? resolvedWalkable
            : null,
        );
        this.worldGrid.setTerrainElevation(tileX, tileY, terrainElevation[localKey] ?? null);
      }
    }

    this.invalidateTerrainResolutionRect(startTileX, startTileY, chunk.width, chunk.height);
    this.renderer?.invalidateTileRect(startTileX, startTileY, chunk.width, chunk.height, {
      includeBleed: options.invalidateAdjacentRendererChunks ?? true,
    });
  }

  applyWorldChunks(chunks: WorldChunkDefinition[], options: ApplyWorldChunkOptions = {}): void {
    chunks.forEach((chunk) => this.applyWorldChunk(chunk, options));
  }

  toggleChunkDebug(): boolean {
    return this.renderer?.toggleChunkDebug() ?? false;
  }

  getSpawnPoint(): WorldPoint {
    return this.getTileCenterWorld(Math.floor(this.width / 2), Math.floor(this.height / 2));
  }

  // --- Grid mode (delegates to renderer) ---

  cycleGridMode(): GridMode {
    const nextMode: Record<GridMode, GridMode> = {
      off: 'subtle',
      subtle: 'build',
      build: 'off',
    };
    this.setGridMode(nextMode[this.gridMode]);
    return this.gridMode;
  }

  getGridMode(): GridMode {
    return this.gridMode;
  }

  toggleGridVisibility(): boolean {
    if (!this.renderer) return false;
    this.setGridMode(this.gridMode === 'off' ? 'build' : 'off');
    return this.gridMode !== 'off';
  }

  private setGridMode(gridMode: GridMode): void {
    this.gridMode = gridMode;
    this.renderer?.setGridMode(gridMode);
  }

  private createWaterBackdrop(): void {
    const bounds = this.getWorldBounds();
    this.waterBackdrop?.destroy();
    this.waterBackdrop = this.scene.add.rectangle(
      bounds.centerX,
      bounds.centerY,
      bounds.width,
      bounds.height,
      0x07111f,
      1,
    );
    this.waterBackdrop.setDepth(RENDER_DEPTHS.GROUND - 10);
  }

  private createChunkRenderer(): void {
    this.renderer = new IsoTilemapChunkRenderer({
      scene: this.scene,
      transform: this.transform,
      worldGrid: this.worldGrid,
      terrainResolutionCache: this.terrainResolutionCache,
    });
    this.renderer.render();
  }

  private invalidateTerrainResolutionRect(tileX: number, tileY: number, width: number, height: number): void {
    const startX = Math.max(0, tileX - 1);
    const startY = Math.max(0, tileY - 1);
    const endX = Math.min(this.width - 1, tileX + width);
    const endY = Math.min(this.height - 1, tileY + height);

    for (let y = startY; y <= endY; y += 1) {
      for (let x = startX; x <= endX; x += 1) {
        this.terrainResolutionCache.invalidateTile(x, y);
      }
    }
  }

  private getWorldBounds(): Phaser.Geom.Rectangle {
    const points = [
      ...this.transform.getTileDiamondPoints(0, 0),
      ...this.transform.getTileDiamondPoints(this.width - 1, 0),
      ...this.transform.getTileDiamondPoints(this.width - 1, this.height - 1),
      ...this.transform.getTileDiamondPoints(0, this.height - 1),
    ];
    const bounds = Phaser.Geom.Rectangle.FromPoints(points);
    const minX = bounds.left - MAP_MARGIN;
    const maxX = bounds.right + MAP_MARGIN;
    const minY = bounds.top - MAP_MARGIN;
    const maxY = bounds.bottom + MAP_MARGIN;
    return new Phaser.Geom.Rectangle(minX, minY, maxX - minX, maxY - minY);
  }
}

function buildTerrainWalkabilityOverrides(
  terrainWalkability: Record<string, boolean> | undefined,
  exactTerrainPaints: IsoTilemapConfig['exactTerrainPaints'],
): Record<string, boolean> {
  return {
    ...(exactTerrainPaints
      ? Object.fromEntries(Object.entries(exactTerrainPaints).map(([key, paint]) => [key, paint.walkable]))
      : {}),
    ...(terrainWalkability ?? {}),
  };
}

function isTerrainFamilyWalkableByDefault(tileType: TileType): boolean {
  return tileType !== 'water';
}

function toAbsoluteTerrainPaints(
  localPaints: NonNullable<IsoTilemapConfig['exactTerrainPaints']>,
  startTileX: number,
  startTileY: number,
  chunkWidth: number,
  chunkHeight: number,
): NonNullable<IsoTilemapConfig['exactTerrainPaints']> {
  return Object.fromEntries(
    Object.entries(localPaints).flatMap(([key, paint]) => {
      const [localX, localY] = parseTileKey(key);

      if (localX < 0 || localY < 0 || localX >= chunkWidth || localY >= chunkHeight) {
        return [];
      }

      return [[tileKey(startTileX + localX, startTileY + localY), paint]];
    }),
  );
}

function decodeChunkExactTerrainPaints(
  chunk: WorldChunkDefinition,
): NonNullable<IsoTilemapConfig['exactTerrainPaints']> {
  if (chunk.terrain.encoding !== 'palette') {
    return {};
  }

  const exactTerrainPaints: NonNullable<IsoTilemapConfig['exactTerrainPaints']> = {};
  const palette = chunk.terrainPalette ?? {};

  chunk.terrain.tiles.forEach((row, tileY) => {
    row.forEach((tileId, tileX) => {
      const exactEntry = getExactTerrainPaletteEntry(palette[tileId]);

      if (!exactEntry) {
        return;
      }

      exactTerrainPaints[tileKey(tileX, tileY)] = {
        id: exactEntry.tileId,
        family: exactEntry.family,
        textureKey: exactEntry.textureKey,
        ...(exactEntry.textureOffsetX !== undefined ? { textureOffsetX: exactEntry.textureOffsetX } : {}),
        ...(exactEntry.textureOffsetY !== undefined ? { textureOffsetY: exactEntry.textureOffsetY } : {}),
        ...(exactEntry.textureScale !== undefined ? { textureScale: exactEntry.textureScale } : {}),
        walkable: exactEntry.walkable ?? exactEntry.family !== 'water',
        flipX: exactEntry.flipX === true,
        flipY: exactEntry.flipY === true,
      };
    });
  });

  return exactTerrainPaints;
}

function tileKey(tileX: number, tileY: number): string {
  return `${tileX},${tileY}`;
}

function parseTileKey(key: string): [number, number] {
  const [tileX, tileY] = key.split(',').map((part) => Number.parseInt(part, 10));
  return [Number.isFinite(tileX) ? tileX : -1, Number.isFinite(tileY) ? tileY : -1];
}

function validateTerrainLayer(terrain: TileType[][]): void {
  if (terrain.length === 0 || terrain[0].length === 0) {
    throw new Error('IsoTilemap: terrain layer must not be empty');
  }

  const expectedWidth = terrain[0].length;

  terrain.forEach((row, rowIndex) => {
    if (row.length !== expectedWidth) {
      throw new Error(
        `IsoTilemap: terrain row ${rowIndex} has width ${row.length}, expected ${expectedWidth}`,
      );
    }
  });
}
