import Phaser from 'phaser';
import { ObjectPlacementSystem } from '../../objects/ObjectPlacementSystem';
import { PROTOTYPE_SCALE } from '../../config/prototypeScale';
import { generateOrganicIsland } from '../IslandGenerator';
import { IsoTilemap } from '../IsoTilemap';
import { getMapDefinition } from './MapDefinitions';
import type { MapDefinition, MapSpawnPoint, MapTransition } from './MapTypes';
import type { LoadedMapRuntime } from './MapRuntime';

export class MapLoader {
  private currentRuntime?: LoadedMapRuntime;

  constructor(private readonly scene: Phaser.Scene) {}

  loadMap(mapId: string, spawnId = 'default'): LoadedMapRuntime {
    this.destroyCurrentRuntime();

    const definition = getMapDefinition(mapId);
    const activeSpawnId = this.resolveSpawnId(definition, spawnId);
    const isoTilemap = new IsoTilemap(this.scene, {
      width: definition.width,
      height: definition.height,
      terrain: definition.terrain,
    });
    const worldBounds = isoTilemap.render();

    this.currentRuntime = {
      definition,
      isoTilemap,
      worldBounds,
      activeSpawnId,
      transitions: definition.transitions,
    };

    return this.currentRuntime;
  }

  loadProceduralMap(
    mapId = 'debug_procedural_island',
    spawnId = 'default',
    width = PROTOTYPE_SCALE.mapWidth,
    height = PROTOTYPE_SCALE.mapHeight,
  ): LoadedMapRuntime {
    this.destroyCurrentRuntime();

    const proceduralDefinition: MapDefinition = {
      id: mapId,
      displayName: 'Procedural Debug Island',
      width,
      height,
      terrain: generateOrganicIsland(width, height),
      spawnPoints: {
        default: {
          id: 'default',
          tileX: Math.floor(width / 2),
          tileY: Math.floor(height / 2),
        },
      },
      objects: [],
      transitions: [],
      metadata: {
        procedural: true,
        generatedFrom: 'IslandGenerator',
      },
    };
    const activeSpawnId = this.resolveSpawnId(proceduralDefinition, spawnId);
    const isoTilemap = new IsoTilemap(this.scene, {
      width,
      height,
      terrain: proceduralDefinition.terrain,
    });
    const worldBounds = isoTilemap.render();

    this.currentRuntime = {
      definition: proceduralDefinition,
      isoTilemap,
      worldBounds,
      activeSpawnId,
      transitions: proceduralDefinition.transitions,
    };

    return this.currentRuntime;
  }

  destroyCurrentRuntime(): void {
    this.currentRuntime?.isoTilemap.destroy();
    this.currentRuntime = undefined;
  }

  placeCurrentMapObjects(objectPlacementSystem: ObjectPlacementSystem): {
    placed: number;
  } {
    const runtime = this.getCurrentRuntime();
    let placed = 0;

    runtime.definition.objects.forEach((mapObject) => {
      objectPlacementSystem.placeAuthoredObject(runtime.definition.id, mapObject);
      placed += 1;
    });

    return { placed };
  }

  getCurrentRuntime(): LoadedMapRuntime {
    if (!this.currentRuntime) {
      throw new Error('MapLoader: no map has been loaded yet');
    }

    return this.currentRuntime;
  }

  getCurrentMapId(): string {
    return this.getCurrentRuntime().definition.id;
  }

  getCurrentSpawnId(): string {
    return this.getCurrentRuntime().activeSpawnId;
  }

  getCurrentSpawnPoint(): MapSpawnPoint {
    const runtime = this.getCurrentRuntime();
    return runtime.definition.spawnPoints[runtime.activeSpawnId];
  }

  getCurrentSpawnWorldPoint(): Phaser.Math.Vector2 {
    const runtime = this.getCurrentRuntime();
    const spawnPoint = this.getCurrentSpawnPoint();

    return runtime.isoTilemap.transform.getTileCenterWorld(spawnPoint.tileX, spawnPoint.tileY);
  }

  getCurrentObjectCount(): number {
    return this.getCurrentRuntime().definition.objects.length;
  }

  getCurrentTransitions(): MapTransition[] {
    return this.getCurrentRuntime().transitions;
  }

  private resolveSpawnId(definition: MapDefinition, spawnId: string): string {
    if (definition.spawnPoints[spawnId]) {
      return spawnId;
    }

    if (definition.spawnPoints.default) {
      return 'default';
    }

    const [firstSpawnId] = Object.keys(definition.spawnPoints);

    if (!firstSpawnId) {
      throw new Error(`MapLoader: map "${definition.id}" has no spawn points`);
    }

    return firstSpawnId;
  }
}
