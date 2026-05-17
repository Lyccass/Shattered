import Phaser from 'phaser';
import { CameraSystem } from '../camera/CameraSystem';
import { PROTOTYPE_SCALE } from '../config/prototypeScale';
import { ObjectDebugRenderer } from '../objects/ObjectDebugRenderer';
import { ObjectPlacementSystem } from '../objects/ObjectPlacementSystem';
import { PlayerController } from '../player/PlayerController';
import { RENDER_DEPTHS } from '../render/RenderLayers';
import { IsoTilemap } from '../world/IsoTilemap';
import { MapLoader } from '../world/maps/MapLoader';
import { MapTransitionSystem } from '../world/maps/MapTransitionSystem';
import type { ResolvedTerrainTile } from '../world/terrain/TerrainTypes';

type DebugOverlaySystemConfig = {
  scene: Phaser.Scene;
  worldCamera: Phaser.Cameras.Scene2D.Camera;
  cameraSystem: CameraSystem;
  playerController: PlayerController;
  isoTilemap: IsoTilemap;
  mapLoader?: MapLoader;
  mapTransitionSystem?: MapTransitionSystem;
  objectPlacementSystem?: ObjectPlacementSystem;
  objectDebugRenderer?: ObjectDebugRenderer;
};

export class DebugOverlaySystem {
  private static readonly FRAME_TIME_SAMPLE_SIZE = 120;
  private static readonly FRAME_TIME_SPIKE_THRESHOLD_MS = 25;

  private readonly scene: Phaser.Scene;
  private readonly cameraSystem: CameraSystem;
  private readonly playerController: PlayerController;
  private isoTilemap: IsoTilemap;
  private mapLoader?: MapLoader;
  private mapTransitionSystem?: MapTransitionSystem;
  private objectPlacementSystem?: ObjectPlacementSystem;
  private objectDebugRenderer?: ObjectDebugRenderer;
  private readonly uiCamera: Phaser.Cameras.Scene2D.Camera;
  private readonly zoomText: Phaser.GameObjects.Text;
  private readonly detailText: Phaser.GameObjects.Text;
  private readonly playerFeetMarker: Phaser.GameObjects.Arc;
  private isVisible = false;
  private nextBannerRefreshAt = 0;
  private nextDetailRefreshAt = 0;
  private lastBannerText = '';
  private lastFrameSampleAt = 0;
  private latestFrameTimeMs = 0;
  private readonly recentFrameTimes = new Array<number>(DebugOverlaySystem.FRAME_TIME_SAMPLE_SIZE).fill(0);
  private recentFrameTimeCount = 0;
  private recentFrameTimeWriteIndex = 0;
  private destroyed = false;

  private readonly handleToggleKeydown = (event: KeyboardEvent): void => {
    event.preventDefault();
    this.setVisible(!this.isVisible);
  };

  private readonly handleResize = (gameSize: Phaser.Structs.Size): void => {
    this.uiCamera.setViewport(0, 0, gameSize.width, gameSize.height);
  };

  private readonly handleAddedToScene = (child: Phaser.GameObjects.GameObject): void => {
    if (!this.isUiObject(child)) {
      this.uiCamera.ignore(child);
    }
  };

  constructor({
    scene,
    worldCamera,
    cameraSystem,
    playerController,
    isoTilemap,
    mapLoader,
    mapTransitionSystem,
    objectPlacementSystem,
    objectDebugRenderer,
  }: DebugOverlaySystemConfig) {
    this.scene = scene;
    this.cameraSystem = cameraSystem;
    this.playerController = playerController;
    this.isoTilemap = isoTilemap;
    this.mapLoader = mapLoader;
    this.mapTransitionSystem = mapTransitionSystem;
    this.objectPlacementSystem = objectPlacementSystem;
    this.objectDebugRenderer = objectDebugRenderer;
    this.uiCamera = this.scene.cameras.add(0, 0, this.scene.scale.width, this.scene.scale.height);
    this.zoomText = this.createText(16, 16);
    this.detailText = this.createText(16, 56);
    this.playerFeetMarker = this.createPlayerFeetMarker();

    worldCamera.ignore([this.zoomText, this.detailText]);
    this.ignoreWorldForUiCamera();
    this.registerResizeHandler();
    this.registerToggleKey();
    this.setVisible(false);
  }

  update(): void {
    if (this.destroyed) {
      return;
    }

    this.recordFrameTimeSample();

    const zoom = this.cameraSystem.getZoom();
    const gridMode = this.isoTilemap.getGridMode();
    const objectDebugOn = this.objectDebugRenderer?.isVisible() ?? false;
    const currentMapId = this.mapLoader?.getCurrentMapId() ?? 'procedural';
    const activeTransition = this.mapTransitionSystem?.getActiveTransition() ?? null;
    const transitionPrompt = activeTransition
      ? `  Press E -> ${activeTransition.targetMapId}:${activeTransition.targetSpawnId}`
      : '';
    const chunkStats = this.isoTilemap.getTerrainChunkStats();
    const now = this.scene.time.now;

    if (now >= this.nextBannerRefreshAt) {
      this.nextBannerRefreshAt = now + PROTOTYPE_SCALE.debugOverlayBannerRefreshMs;
      const bannerText = `Map: ${currentMapId}  Zoom: ${zoom.toFixed(2)}x  Grid: ${gridMode}  ObjDbg: ${objectDebugOn ? 'on' : 'off'}  ChunkDbg: ${chunkStats?.chunkDebugEnabled ? 'on' : 'off'}  [Tab] [Z/Wheel] [G] [C] [O] [M]${transitionPrompt}`;

      if (bannerText !== this.lastBannerText) {
        this.zoomText.setText(bannerText);
        this.lastBannerText = bannerText;
      }
    }

    if (!this.isVisible) {
      return;
    }

    const feetPoint = this.playerController.getFeetPoint();
    const isPlayerFeetBlocked = this.playerController.isFeetTileBlocked();
    this.playerFeetMarker.setPosition(feetPoint.x, feetPoint.y);
    this.playerFeetMarker.setFillStyle(isPlayerFeetBlocked ? 0xff3b5c : 0xffff00, 1);

    if (now < this.nextDetailRefreshAt) {
      return;
    }
    this.nextDetailRefreshAt = now + PROTOTYPE_SCALE.debugOverlayDetailRefreshMs;

    const player = this.playerController.sprite;
    const playerGrid = this.playerController.getGridPosition();
    const pointer = this.scene.input.activePointer;
    const mouseWorld = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const mouseGrid = this.isoTilemap.transform.getMouseGridPosition(pointer, this.scene.cameras.main);
    const mouseTile = this.isoTilemap.transform.worldToTile(mouseWorld.x, mouseWorld.y);
    const playerFeetTile = this.playerController.getFeetTile();
    const isMouseGridWalkable = this.isoTilemap.isWorldGridWalkable(mouseGrid.x, mouseGrid.y);
    const isMouseTileBlocked = !this.isoTilemap.isTileWalkable(mouseTile.x, mouseTile.y);
    const mouseTerrainFamily = this.isoTilemap.getTerrainFamilyAtTile(mouseTile.x, mouseTile.y);
    const mouseResolvedTerrain = this.isoTilemap.resolveTerrainTile(mouseTile.x, mouseTile.y);
    const mouseTransition = this.mapTransitionSystem?.getTransitionAtTile(mouseTile.x, mouseTile.y) ?? null;
    const fps = this.scene.game.loop.actualFps;
    const frameTimingStats = this.getFrameTimingStats();

    const objectInstanceCount = this.objectPlacementSystem?.getInstanceCount() ?? 0;
    const objectBlockedCount = this.isoTilemap.worldGrid.getObjectBlockedTileCount();
    const mouseTileObject = this.objectPlacementSystem?.getObjectAtTile(mouseTile.x, mouseTile.y);
    const mouseObjectLabel = mouseTileObject ? mouseTileObject.id : '—';
    const currentSpawnId = this.mapLoader?.getCurrentSpawnId() ?? 'default';
    const resolvedChunkStats = chunkStats ?? {
      configuredChunkCount: 0,
      materializedChunkCount: 0,
      visibleChunkCount: 0,
      cachedChunkCount: 0,
      evictedChunkCount: 0,
      peakMaterializedChunkCount: 0,
      pendingGroundBuildCount: 0,
      pendingGridBuildCount: 0,
      chunkDebugEnabled: false,
    };

    this.detailText.setText([
      'Debug [Tab]   Toggle obj overlays [O]   Log placements [M]   Toggle chunk debug [C]',
      `Map: ${currentMapId}   spawn: ${currentSpawnId}`,
      `Player: ${player.x.toFixed(1)}, ${player.y.toFixed(1)}`,
      `Player grid: ${playerGrid.x.toFixed(2)}, ${playerGrid.y.toFixed(2)}`,
      `Player feet tile: ${playerFeetTile.x}, ${playerFeetTile.y} ${isPlayerFeetBlocked ? 'BLOCKED' : 'walkable'}`,
      `Feet/depth: ${feetPoint.x.toFixed(1)}, ${feetPoint.y.toFixed(1)}`,
      `Mouse world: ${mouseWorld.x.toFixed(1)}, ${mouseWorld.y.toFixed(1)}`,
      `Mouse fractional grid: ${mouseGrid.x.toFixed(2)}, ${mouseGrid.y.toFixed(2)} ${isMouseGridWalkable ? 'walkable' : 'BLOCKED'}`,
      `Mouse resolved tile: ${mouseTile.x}, ${mouseTile.y} ${isMouseTileBlocked ? 'BLOCKED' : 'walkable'}`,
      `Mouse terrain: ${mouseTerrainFamily ?? 'out'} -> ${mouseResolvedTerrain?.baseTileDefinition.id ?? '—'} (${mouseResolvedTerrain?.baseTileDefinition.spriteFrame ?? '—'})`,
      `Mouse neighbours: ${this.formatTerrainNeighbours(mouseResolvedTerrain)}`,
      `Mouse terrain edges: ${this.formatTerrainEdges(mouseResolvedTerrain)}`,
      `Mouse terrain transform: ${this.formatTerrainTransform(mouseResolvedTerrain)}`,
      `Mouse transitions: ${this.formatTerrainTransitions(mouseResolvedTerrain)}`,
      `Mouse shoreline: ${this.formatTerrainTransitions(mouseResolvedTerrain, 'shoreline')}`,
      `Mouse map transition: ${mouseTransition ? `${mouseTransition.id} -> ${mouseTransition.targetMapId}:${mouseTransition.targetSpawnId}` : 'none'}`,
      `Active transition: ${activeTransition ? `${activeTransition.id} -> ${activeTransition.targetMapId}:${activeTransition.targetSpawnId} [E]` : 'none'}`,
      `Mouse tile object: ${mouseObjectLabel}`,
      `FPS: ${fps.toFixed(0)}`,
      `Frame ms: ${this.latestFrameTimeMs.toFixed(1)}   avg ${frameTimingStats.averageMs.toFixed(1)}   worst ${frameTimingStats.worstMs.toFixed(1)}   spikes>${DebugOverlaySystem.FRAME_TIME_SPIKE_THRESHOLD_MS}ms ${frameTimingStats.spikeCount}`,
      `Zoom: ${zoom.toFixed(2)}x`,
      `Grid mode: ${gridMode}`,
      `Map/chunks: ${this.isoTilemap.width}x${this.isoTilemap.height} / configured ${resolvedChunkStats.configuredChunkCount} / visible ${resolvedChunkStats.visibleChunkCount} / cached ${resolvedChunkStats.cachedChunkCount} / resident ${resolvedChunkStats.materializedChunkCount}`,
      `Chunk queues: ground ${resolvedChunkStats.pendingGroundBuildCount} / grid ${resolvedChunkStats.pendingGridBuildCount}   peak resident: ${resolvedChunkStats.peakMaterializedChunkCount}   evicted: ${resolvedChunkStats.evictedChunkCount}`,
      `Terrain-blocked tiles: ${this.isoTilemap.getTerrainBlockedTileCount()}`,
      `Object instances: ${objectInstanceCount}   object-blocked tiles: ${objectBlockedCount}`,
      `Object debug overlays: ${objectDebugOn ? 'on' : 'off'}`,
      'Legend:',
      'chunk debug = green logical chunk, orange bleed margin',
      'yellow dot = player feet/depth anchor',
      'red diamond = blocking object footprint',
      'blue diamond = non-blocking object footprint',
      'yellow dot on object = object depth anchor (front-most tile)',
      'BLOCKED = terrain or object blocked',
    ]);
  }

  private formatTerrainEdges(resolvedTerrain: ResolvedTerrainTile | null): string {
    if (!resolvedTerrain) {
      return '—';
    }

    const { edges } = resolvedTerrain.baseTileDefinition;

    return `x+ ${edges.xPlus}, x- ${edges.xMinus}, y+ ${edges.yPlus}, y- ${edges.yMinus}`;
  }

  private formatTerrainTransform(resolvedTerrain: ResolvedTerrainTile | null): string {
    if (!resolvedTerrain) {
      return '—';
    }

    const { flipX, flipY, rotation } = resolvedTerrain.baseTransform;

    return `flipX ${flipX ? 'yes' : 'no'}, flipY ${flipY ? 'yes' : 'no'}, rot ${rotation}`;
  }

  private formatTerrainNeighbours(resolvedTerrain: ResolvedTerrainTile | null): string {
    if (!resolvedTerrain) {
      return '—';
    }

    const { edges, corners } = resolvedTerrain.debugInfo.neighbourFamilies;

    return `x+ ${edges.xPlus}, x- ${edges.xMinus}, y+ ${edges.yPlus}, y- ${edges.yMinus}, diag ${corners.xPlusYPlus}/${corners.xPlusYMinus}/${corners.xMinusYPlus}/${corners.xMinusYMinus}`;
  }

  private formatTerrainTransitions(
    resolvedTerrain: ResolvedTerrainTile | null,
    filter?: 'shoreline',
  ): string {
    if (!resolvedTerrain) {
      return '—';
    }

    const overlays = filter === 'shoreline'
      ? resolvedTerrain.debugInfo.shorelineCandidates
      : resolvedTerrain.transitionOverlays;

    if (overlays.length === 0) {
      return 'none';
    }

    return overlays
      .slice(0, 4)
      .map((overlay) => `${overlay.definition.kind}:${overlay.definition.direction}->${overlay.definition.toFamily}`)
      .join(', ');
  }

  private createText(x: number, y: number): Phaser.GameObjects.Text {
    const text = this.scene.add.text(x, y, '', {
      color: '#d7f3ff',
      fontFamily: 'monospace',
      fontSize: '16px',
      backgroundColor: '#07111fcc',
      padding: {
        x: 10,
        y: 8,
      },
    });

    text.setScrollFactor(0);
    text.setDepth(RENDER_DEPTHS.UI);
    text.setVisible(false);

    return text;
  }

  private createPlayerFeetMarker(): Phaser.GameObjects.Arc {
    const marker = this.scene.add.circle(0, 0, 5, 0xffff00, 1);

    marker.setStrokeStyle(2, 0x111111, 0.85);
    marker.setDepth(RENDER_DEPTHS.DEBUG + 4);

    return marker;
  }

  private recordFrameTimeSample(): void {
    const now = performance.now();

    if (this.lastFrameSampleAt > 0) {
      this.latestFrameTimeMs = now - this.lastFrameSampleAt;
      this.recentFrameTimes[this.recentFrameTimeWriteIndex] = this.latestFrameTimeMs;
      this.recentFrameTimeWriteIndex =
        (this.recentFrameTimeWriteIndex + 1) % DebugOverlaySystem.FRAME_TIME_SAMPLE_SIZE;
      this.recentFrameTimeCount = Math.min(
        this.recentFrameTimeCount + 1,
        DebugOverlaySystem.FRAME_TIME_SAMPLE_SIZE,
      );
    }

    this.lastFrameSampleAt = now;
  }

  private getFrameTimingStats(): { averageMs: number; worstMs: number; spikeCount: number } {
    if (this.recentFrameTimeCount === 0) {
      return {
        averageMs: 0,
        worstMs: 0,
        spikeCount: 0,
      };
    }

    let sum = 0;
    let worstMs = 0;
    let spikeCount = 0;

    for (let index = 0; index < this.recentFrameTimeCount; index += 1) {
      const frameTimeMs = this.recentFrameTimes[index];
      sum += frameTimeMs;
      worstMs = Math.max(worstMs, frameTimeMs);

      if (frameTimeMs > DebugOverlaySystem.FRAME_TIME_SPIKE_THRESHOLD_MS) {
        spikeCount += 1;
      }
    }

    return {
      averageMs: sum / this.recentFrameTimeCount,
      worstMs,
      spikeCount,
    };
  }

  private registerToggleKey(): void {
    this.scene.input.keyboard?.on('keydown-TAB', this.handleToggleKeydown);
  }

  private setVisible(isVisible: boolean): void {
    this.isVisible = isVisible;
    this.zoomText.setVisible(isVisible);
    this.detailText.setVisible(isVisible);
    this.playerFeetMarker.setVisible(isVisible);
  }

  private registerResizeHandler(): void {
    this.scene.scale.on('resize', this.handleResize);
  }

  private ignoreWorldForUiCamera(): void {
    const existing = this.scene.children.getChildren().filter((c) => !this.isUiObject(c));
    this.uiCamera.ignore(existing);
    this.scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, this.handleAddedToScene);
  }

  setWorldContext({
    isoTilemap,
    mapLoader,
    mapTransitionSystem,
    objectPlacementSystem,
    objectDebugRenderer,
  }: {
    isoTilemap: IsoTilemap;
    mapLoader?: MapLoader;
    mapTransitionSystem?: MapTransitionSystem;
    objectPlacementSystem?: ObjectPlacementSystem;
    objectDebugRenderer?: ObjectDebugRenderer;
  }): void {
    this.isoTilemap = isoTilemap;
    this.mapLoader = mapLoader;
    this.mapTransitionSystem = mapTransitionSystem;
    this.objectPlacementSystem = objectPlacementSystem;
    this.objectDebugRenderer = objectDebugRenderer;
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.scene.input.keyboard?.off('keydown-TAB', this.handleToggleKeydown);
    this.scene.scale.off('resize', this.handleResize);
    this.scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, this.handleAddedToScene);
    this.zoomText.destroy();
    this.detailText.destroy();
    this.playerFeetMarker.destroy();
    this.scene.cameras.remove(this.uiCamera);
  }

  private isUiObject(child: Phaser.GameObjects.GameObject): boolean {
    return child === this.zoomText || child === this.detailText;
  }
}
