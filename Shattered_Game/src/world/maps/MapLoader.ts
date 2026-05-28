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
import { createChunkKey } from '../../shared/world/ChunkKey';
import { isTerrainFamily } from '../../shared/map/TerrainTypes';
import { generateOrganicIsland } from '../IslandGenerator';
import { IsoTilemap } from '../IsoTilemap';
import { getChunkCoordForTile } from '../chunks/TerrainChunkMath';
import { ActiveWorldChunkWindow } from '../streaming/ActiveWorldChunkWindow';
import { loadWorldChunkProviderFromManifestUrl } from '../streaming/BrowserWorldChunkLoader';
import { getMapDefinition } from './MapDefinitions';
import { MapZoneIndex } from './MapZoneIndex';
import type { MapDefinition, MapSpawnPoint, MapTransition } from './MapTypes';
import type { LoadedMapRuntime } from './MapRuntime';

type EmbeddedEditorTexture = {
  dataUrl: string;
  textureKey: string;
};

export class MapLoader {
  private currentRuntime?: LoadedMapRuntime;

  constructor(private readonly scene: Phaser.Scene) {}

  async prepareMapAssets(mapId: string): Promise<void> {
    const definition = getMapDefinition(mapId);
    await this.prepareEmbeddedEditorTextures(definition);
  }

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
      enemySpawns: [],
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
      enemySpawns: [],
    };

    return this.currentRuntime;
  }

  async loadWorldManifest(manifestUrl: string, spawnId = 'default'): Promise<LoadedMapRuntime> {
    this.destroyCurrentRuntime();

    const provider = await loadWorldChunkProviderFromManifestUrl(manifestUrl);
    const manifest = provider.getManifest();
    const defaultRegion = manifest.regions.find((region) => region.id === manifest.defaultRegionId);

    if (!defaultRegion || !isTerrainFamily(defaultRegion.defaultTerrain)) {
      throw new Error(`MapLoader: world manifest "${manifest.worldId}" has no valid default terrain.`);
    }

    if (manifest.bounds.minChunkX !== 0 || manifest.bounds.minChunkY !== 0) {
      throw new Error('MapLoader: streamed world manifests currently need 0,0 as their minimum chunk bound.');
    }

    const width = (manifest.bounds.maxChunkX - manifest.bounds.minChunkX + 1) * manifest.chunkSize;
    const height = (manifest.bounds.maxChunkY - manifest.bounds.minChunkY + 1) * manifest.chunkSize;
    const defaultSpawn = manifest.defaultSpawn;
    const transitionSpawn = parseWorldChunkTileSpawnId(spawnId);
    const resolvedSpawnId: string = transitionSpawn
      ? spawnId
      : spawnId === 'default'
        ? (defaultSpawn.spawnId ?? 'default')
        : spawnId;
    const spawnPoint: MapSpawnPoint = transitionSpawn
      ? {
        id: resolvedSpawnId,
        tileX: transitionSpawn.chunkX * manifest.chunkSize + transitionSpawn.tileX,
        tileY: transitionSpawn.chunkY * manifest.chunkSize + transitionSpawn.tileY,
      }
      : {
        id: resolvedSpawnId,
        tileX: defaultSpawn.chunk.chunkX * manifest.chunkSize + defaultSpawn.tileX,
        tileY: defaultSpawn.chunk.chunkY * manifest.chunkSize + defaultSpawn.tileY,
      };
    const definition: MapDefinition = {
      id: manifest.worldId,
      displayName: manifest.displayName,
      spaceType: 'open_world',
      width,
      height,
      terrain: [],
      spawnPoints: {
        [resolvedSpawnId]: spawnPoint,
      },
      objects: [],
      transitions: [],
      interactionAnchors: [],
      zones: [],
      metadata: {
        streamedWorld: true,
        worldManifestUrl: manifestUrl,
      },
    };
    const isoTilemap = new IsoTilemap(this.scene, {
      width,
      height,
      defaultTerrain: defaultRegion.defaultTerrain,
    });
    const activeWindow = new ActiveWorldChunkWindow(provider, {
      loadRadius: PROTOTYPE_SCALE.terrainChunkVisibleRadius,
      retainRadius: PROTOTYPE_SCALE.terrainChunkRetainRadius,
    });
    const initialChunks = await activeWindow.loadAroundTile(spawnPoint.tileX, spawnPoint.tileY);
    isoTilemap.applyWorldChunks(initialChunks);
    const worldBounds = isoTilemap.render();
    const spawnCenter = getChunkCoordForTile(spawnPoint.tileX, spawnPoint.tileY, manifest.chunkSize);

    const runtime: LoadedMapRuntime = {
      definition,
      isoTilemap,
      worldBounds,
      activeSpawnId: resolvedSpawnId,
      transitions: [],
      zones: [],
      zoneIndex: new MapZoneIndex([]),
      interactionAnchors: [],
      enemySpawns: [],
      streamedWorld: {
        provider,
        activeWindow,
        lastCenterChunkKey: createChunkKey(spawnCenter),
        loadingCenterChunkKey: null,
        materializedChunkKeys: new Set(),
        materializedObjectIdsByChunk: new Map(),
      },
    };
    this.currentRuntime = runtime;

    return runtime;
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
    for (const { dataUrl, textureKey } of collectEmbeddedEditorTextures(definition)) {
      if (!this.scene.textures.exists(textureKey)) {
        this.scene.textures.addBase64(textureKey, dataUrl);
      }
    }
  }

  private async prepareEmbeddedEditorTextures(definition: MapDefinition): Promise<void> {
    await Promise.all(
      collectEmbeddedEditorTextures(definition)
        .map(({ dataUrl, textureKey }) => this.prepareEmbeddedTexture(textureKey, dataUrl)),
    );
  }

  private async prepareEmbeddedTexture(textureKey: string, dataUrl: string): Promise<void> {
    if (this.scene.textures.exists(textureKey)) {
      return;
    }

    const image = await loadHtmlImage(dataUrl);

    if (!this.scene.textures.exists(textureKey)) {
      this.scene.textures.addImage(textureKey, image);
    }
  }
}

function parseWorldChunkTileSpawnId(spawnId: string): {
  chunkX: number;
  chunkY: number;
  tileX: number;
  tileY: number;
} | null {
  const match = /^chunk_(-?\d+)_(-?\d+)_tile_(\d+)_(\d+)$/.exec(spawnId);

  if (!match) {
    return null;
  }

  return {
    chunkX: Number.parseInt(match[1], 10),
    chunkY: Number.parseInt(match[2], 10),
    tileX: Number.parseInt(match[3], 10),
    tileY: Number.parseInt(match[4], 10),
  };
}

function collectEmbeddedEditorTextures(definition: MapDefinition): EmbeddedEditorTexture[] {
  const textures = new Map<string, EmbeddedEditorTexture>();
  const addTexture = (textureKey: string, dataUrl: string | undefined): void => {
    if (!dataUrl || textures.has(textureKey)) {
      return;
    }

    textures.set(textureKey, { dataUrl, textureKey });
  };

  const terrainPaints = [
    ...Object.values(parseEditorTerrainTiles(definition.metadata?.editorTerrainTiles)),
    ...parseEditorTerrainBrushes(definition.metadata?.editorTerrainBrushes),
  ];

  for (const paint of terrainPaints) {
    addTexture(paint.textureKey, paint.textureDataUrl);
  }

  for (const objectDefinition of parseEditorObjectDefinitions(definition.metadata?.editorObjectDefinitions)) {
    for (const part of objectDefinition.visual.parts) {
      if (part.shape === 'sprite') {
        addTexture(part.textureKey, part.editorTextureDataUrl);
      }
    }
  }

  return Array.from(textures.values());
}

function loadHtmlImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load embedded editor texture.'));
    image.src = dataUrl;
  });
}
