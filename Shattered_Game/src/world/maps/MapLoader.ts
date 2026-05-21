import Phaser from 'phaser';
import { ObjectPlacementSystem } from '../../objects/ObjectPlacementSystem';
import { PROTOTYPE_SCALE } from '../../config/prototypeScale';
import {
  parseEditorObjectDefinitions,
  parseEditorTerrainBrushes,
  parseEditorTerrainElevation,
  parseEditorTerrainTiles,
  parseEditorTerrainWalkability,
} from '../../shared/editor/EditorMapModel';
import { generateOrganicIsland } from '../IslandGenerator';
import { IsoTilemap } from '../IsoTilemap';
import { getMapDefinition } from './MapDefinitions';
import { MapZoneIndex } from './MapZoneIndex';
import type { MapDefinition, MapSpawnPoint, MapTransition } from './MapTypes';
import type { LoadedMapRuntime } from './MapRuntime';

export class MapLoader {
  private currentRuntime?: LoadedMapRuntime;

  constructor(private readonly scene: Phaser.Scene) {}

  loadMap(mapId: string, spawnId = 'default'): LoadedMapRuntime {
    this.destroyCurrentRuntime();

    const definition = getMapDefinition(mapId);
    const activeSpawnId = this.resolveSpawnId(definition, spawnId);
    this.registerEmbeddedEditorTextures(definition);
    const isoTilemap = new IsoTilemap(this.scene, {
      width: definition.width,
      height: definition.height,
      terrain: definition.terrain,
      terrainElevation: parseEditorTerrainElevation(definition.metadata?.editorTerrainElevation),
      terrainWalkability: parseEditorTerrainWalkability(definition.metadata?.editorTerrainWalkability),
      exactTerrainPaints: parseEditorTerrainTiles(definition.metadata?.editorTerrainTiles),
    });
    const worldBounds = isoTilemap.render();

    this.currentRuntime = {
      definition,
      isoTilemap,
      worldBounds,
      activeSpawnId,
      transitions: definition.transitions,
      zones: definition.zones ?? [],
      zoneIndex: new MapZoneIndex(definition.zones ?? []),
      interactionAnchors: definition.interactionAnchors ?? [],
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
      spaceType: 'open_world',
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
      interactionAnchors: [],
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
      zones: proceduralDefinition.zones ?? [],
      zoneIndex: new MapZoneIndex(proceduralDefinition.zones ?? []),
      interactionAnchors: proceduralDefinition.interactionAnchors ?? [],
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

  private registerEmbeddedEditorTextures(definition: MapDefinition): void {
    const terrainPaints = [
      ...Object.values(parseEditorTerrainTiles(definition.metadata?.editorTerrainTiles)),
      ...parseEditorTerrainBrushes(definition.metadata?.editorTerrainBrushes),
    ];

    for (const paint of terrainPaints) {
      if (paint.textureDataUrl && !this.scene.textures.exists(paint.textureKey)) {
        this.scene.textures.addBase64(paint.textureKey, paint.textureDataUrl);
      }
    }

    for (const objectDefinition of parseEditorObjectDefinitions(definition.metadata?.editorObjectDefinitions)) {
      for (const part of objectDefinition.visual.parts) {
        if (part.shape === 'sprite' && part.editorTextureDataUrl && !this.scene.textures.exists(part.textureKey)) {
          this.scene.textures.addBase64(part.textureKey, part.editorTextureDataUrl);
        }
      }
    }
  }
}
