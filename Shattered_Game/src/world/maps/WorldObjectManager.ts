import { blendedForestSurfaceHeight } from '../../shared/iso/ForestRelief';
import { isForestTerrain } from '../terrain/ForestTerrainDefinitions';
import Phaser from 'phaser';
import { ObjectDebugRenderer } from '../../objects/ObjectDebugRenderer';
import { ObjectOcclusionSystem } from '../../objects/ObjectOcclusionSystem';
import { ObjectPlacementSystem } from '../../objects/ObjectPlacementSystem';
import { ObjectRegistry } from '../../objects/ObjectRegistry';
import { ObjectRenderer } from '../../objects/ObjectRenderer';
import type { LoadedMapRuntime } from './MapRuntime';

export class WorldObjectManager {
  private objectRenderer?: ObjectRenderer;
  private objectPlacementSystem?: ObjectPlacementSystem;
  private objectDebugRenderer?: ObjectDebugRenderer;
  private objectOcclusionSystem?: ObjectOcclusionSystem;
  private objectDebugVisible = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly objectRegistry: ObjectRegistry,
  ) {}

  loadRuntime(
    runtime: LoadedMapRuntime,
    placeAuthoredObjects: (placementSystem: ObjectPlacementSystem) => void,
  ): void {
    this.clearMapObjects();

    this.objectRenderer = new ObjectRenderer(this.scene, runtime.isoTilemap.transform, (x,y)=>{
      const tile=runtime.isoTilemap.resolveTerrainTile(x,y)?.baseTileDefinition;
      return tile && isForestTerrain(tile.id)?blendedForestSurfaceHeight(x+.5,y+.5,(sx,sy)=>{
        const adjacent=runtime.isoTilemap.resolveTerrainTile(sx,sy)?.baseTileDefinition;
        return adjacent ? (isForestTerrain(adjacent.id)?adjacent.id:adjacent.family) : null;
      }):0;
    });
    this.objectDebugRenderer = new ObjectDebugRenderer(this.scene, runtime.isoTilemap.transform);
    this.objectDebugRenderer.setVisible(this.objectDebugVisible);
    this.objectPlacementSystem = new ObjectPlacementSystem(
      runtime.isoTilemap.worldGrid,
      this.objectRegistry,
      this.objectRenderer,
      this.objectDebugRenderer,
    );
    placeAuthoredObjects(this.objectPlacementSystem);
  }

  bindPlayer(player: Phaser.GameObjects.Sprite): void {
    if (!this.objectRenderer) {
      this.objectOcclusionSystem = undefined;
      return;
    }

    this.objectOcclusionSystem = new ObjectOcclusionSystem(this.objectRenderer, player);
  }

  clearMapObjects(): void {
    this.objectDebugVisible = this.objectDebugRenderer?.isVisible() ?? this.objectDebugVisible;
    this.objectPlacementSystem?.clear();
    this.objectRenderer?.destroyAll();
    this.objectDebugRenderer?.destroyAll();
    this.objectRenderer = undefined;
    this.objectDebugRenderer = undefined;
    this.objectPlacementSystem = undefined;
    this.objectOcclusionSystem = undefined;
  }

  getDebugRenderer(): ObjectDebugRenderer | undefined {
    return this.objectDebugRenderer;
  }

  getOcclusionSystem(): ObjectOcclusionSystem | undefined {
    return this.objectOcclusionSystem;
  }

  getPlacementSystem(): ObjectPlacementSystem | undefined {
    return this.objectPlacementSystem;
  }

  destroy(): void {
    this.clearMapObjects();
  }
}
