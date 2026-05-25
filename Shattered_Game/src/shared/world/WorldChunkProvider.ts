import {
  createChunkKey,
  type ChunkCoordinate,
  type ChunkKey,
} from './ChunkKey';
import type { WorldChunkDefinition } from './ChunkTypes';
import type {
  AuthoredWorldChunkReference,
  WorldManifest,
  WorldManifestRegion,
} from './WorldManifestTypes';
import { assertValidWorldManifest } from './WorldManifestValidation';
import { validateWorldChunkDefinition } from './ChunkValidation';

export type WorldChunkProviderSource = 'authored' | 'default';

export type WorldChunkProviderResult = {
  chunk: WorldChunkDefinition;
  reference?: AuthoredWorldChunkReference;
  source: WorldChunkProviderSource;
};

export type AuthoredWorldChunkLoader = (
  reference: AuthoredWorldChunkReference,
) => Promise<WorldChunkDefinition | null>;

export type WorldChunkProviderOptions = {
  authoredChunks?: WorldChunkDefinition[];
  loadAuthoredChunk?: AuthoredWorldChunkLoader;
};

export class WorldChunkProvider {
  private readonly authoredChunkReferencesByKey = new Map<ChunkKey, AuthoredWorldChunkReference>();
  private readonly authoredChunksByKey = new Map<ChunkKey, WorldChunkDefinition>();
  private readonly regionsById = new Map<string, WorldManifestRegion>();

  constructor(
    private readonly manifest: WorldManifest,
    private readonly options: WorldChunkProviderOptions = {},
  ) {
    assertValidWorldManifest(manifest);

    for (const region of manifest.regions) {
      this.regionsById.set(region.id, region);
    }

    for (const reference of manifest.authoredChunks) {
      this.authoredChunkReferencesByKey.set(createChunkKey(reference), reference);
    }

    for (const chunk of options.authoredChunks ?? []) {
      this.registerAuthoredChunk(chunk);
    }
  }

  getManifest(): WorldManifest {
    return this.manifest;
  }

  getAuthoredChunkReference(coordinate: ChunkCoordinate): AuthoredWorldChunkReference | null {
    this.assertInBounds(coordinate);
    return this.authoredChunkReferencesByKey.get(createChunkKey(coordinate)) ?? null;
  }

  hasAuthoredChunk(coordinate: ChunkCoordinate): boolean {
    this.assertInBounds(coordinate);
    return this.authoredChunkReferencesByKey.has(createChunkKey(coordinate));
  }

  getRegisteredChunk(coordinate: ChunkCoordinate): WorldChunkDefinition | null {
    this.assertInBounds(coordinate);
    return this.authoredChunksByKey.get(createChunkKey(coordinate)) ?? null;
  }

  registerAuthoredChunk(chunk: WorldChunkDefinition): void {
    const validation = validateWorldChunkDefinition(chunk);

    if (!validation.ok) {
      throw new Error(validation.errors.join('\n'));
    }

    if (chunk.worldId !== this.manifest.worldId) {
      throw new Error(`Chunk worldId "${chunk.worldId}" does not match manifest worldId "${this.manifest.worldId}".`);
    }

    this.assertInBounds(chunk);

    if (!this.regionsById.has(chunk.regionId)) {
      throw new Error(`Chunk regionId "${chunk.regionId}" does not exist in world manifest regions.`);
    }

    const key = createChunkKey(chunk);
    this.authoredChunksByKey.set(key, chunk);

    if (!this.authoredChunkReferencesByKey.has(key)) {
      this.authoredChunkReferencesByKey.set(key, {
        chunkX: chunk.chunkX,
        chunkY: chunk.chunkY,
        regionId: chunk.regionId,
        path: createDefaultAuthoredChunkPath(this.manifest.worldId, chunk),
      });
    }
  }

  async loadChunk(coordinate: ChunkCoordinate): Promise<WorldChunkProviderResult> {
    this.assertInBounds(coordinate);

    const key = createChunkKey(coordinate);
    const registeredChunk = this.authoredChunksByKey.get(key);

    if (registeredChunk) {
      return {
        chunk: registeredChunk,
        reference: this.authoredChunkReferencesByKey.get(key),
        source: 'authored',
      };
    }

    const reference = this.authoredChunkReferencesByKey.get(key);

    if (reference && this.options.loadAuthoredChunk) {
      const loadedChunk = await this.options.loadAuthoredChunk(reference);

      if (loadedChunk) {
        this.registerAuthoredChunk(loadedChunk);
        return {
          chunk: loadedChunk,
          reference,
          source: 'authored',
        };
      }
    }

    return {
      chunk: this.createDefaultChunk(coordinate),
      reference,
      source: 'default',
    };
  }

  createDefaultChunk(coordinate: ChunkCoordinate): WorldChunkDefinition {
    this.assertInBounds(coordinate);

    const region = this.getDefaultRegion();

    return {
      worldId: this.manifest.worldId,
      regionId: region.id,
      chunkX: coordinate.chunkX,
      chunkY: coordinate.chunkY,
      width: this.manifest.chunkSize,
      height: this.manifest.chunkSize,
      terrain: {
        encoding: 'families',
        tiles: Array.from({ length: this.manifest.chunkSize }, () =>
          Array.from({ length: this.manifest.chunkSize }, () => region.defaultTerrain),
        ),
      },
      objectLayer: { objects: [] },
      resourceLayer: { nodes: [] },
      zoneLayer: { zones: [] },
      habitatLayer: { habitats: [] },
      metadata: {
        generatedFrom: 'world_manifest_default_fill',
        defaultWalkable: region.defaultWalkable,
      },
    };
  }

  private getDefaultRegion(): WorldManifestRegion {
    const region = this.regionsById.get(this.manifest.defaultRegionId);

    if (!region) {
      throw new Error(`World manifest defaultRegionId "${this.manifest.defaultRegionId}" does not exist.`);
    }

    return region;
  }

  private assertInBounds(coordinate: ChunkCoordinate): void {
    const { bounds } = this.manifest;

    if (
      coordinate.chunkX < bounds.minChunkX ||
      coordinate.chunkX > bounds.maxChunkX ||
      coordinate.chunkY < bounds.minChunkY ||
      coordinate.chunkY > bounds.maxChunkY
    ) {
      throw new Error(`Chunk ${coordinate.chunkX},${coordinate.chunkY} is outside world manifest bounds.`);
    }
  }
}

function createDefaultAuthoredChunkPath(
  worldId: string,
  coordinate: ChunkCoordinate,
): string {
  return `data/worlds/${worldId}/chunks/${coordinate.chunkX}_${coordinate.chunkY}.json`;
}
