import { describe, expect, it } from 'vitest';
import { ActiveWorldChunkWindow } from '../../world/streaming/ActiveWorldChunkWindow';
import { materializeWorldChunkRuntimeLayers } from '../../world/streaming/WorldChunkRuntimeLayers';
import {
  createChunkKey,
  parseChunkKey,
} from './ChunkKey';
import {
  createWorldRuntimeSnapshot,
  isResourceAvailableInRuntimeState,
  pruneExpiredResourceDepletions,
  type WorldChunkRuntimeState,
} from './ChunkRuntimeState';
import { validateWorldChunkDefinition } from './ChunkValidation';
import type { WorldChunkDefinition } from './ChunkTypes';
import { WorldChunkProvider } from './WorldChunkProvider';
import { validateWorldManifest } from './WorldManifestValidation';
import {
  createTerrainPalette,
  decodeTerrainPaletteLayer,
  encodeTerrainPaletteLayer,
} from './TerrainPalette';
import {
  HARBOR_COAST_CHUNK_0_0,
  THE_WAKE_WORLD_MANIFEST,
} from './samples/TheWakeSampleWorld';

describe('world chunk authoring', () => {
  it('encodes and decodes terrain families through a palette', () => {
    const palette = createTerrainPalette(['grass', 'dirt', 'water']);
    const terrain = [
      ['grass', 'dirt'],
      ['water', 'grass'],
    ] as const;

    const encoded = encodeTerrainPaletteLayer(terrain.map((row) => [...row]), palette);

    expect(encoded).toEqual([
      [0, 1],
      [2, 0],
    ]);
    expect(decodeTerrainPaletteLayer(palette, encoded)).toEqual(terrain);
  });

  it('creates and parses chunk keys', () => {
    const key = createChunkKey({ chunkX: -2, chunkY: 7 });

    expect(key).toBe('-2,7');
    expect(parseChunkKey(key)).toEqual({ chunkX: -2, chunkY: 7 });
    expect(parseChunkKey('bad')).toBeNull();
  });

  it('accepts a valid authored world chunk', () => {
    expect(validateWorldChunkDefinition(HARBOR_COAST_CHUNK_0_0)).toEqual({ ok: true });
  });

  it('accepts a valid world manifest', () => {
    expect(validateWorldManifest(THE_WAKE_WORLD_MANIFEST)).toEqual({ ok: true });
  });

  it('rejects duplicated authored chunk coordinates in a world manifest', () => {
    expect(validateWorldManifest({
      ...THE_WAKE_WORLD_MANIFEST,
      authoredChunks: [
        ...THE_WAKE_WORLD_MANIFEST.authoredChunks,
        {
          ...THE_WAKE_WORLD_MANIFEST.authoredChunks[0],
          path: 'data/worlds/the_wake/chunks/duplicate_0_0.json',
        },
      ],
    })).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        'World manifest authored chunk "0,0" is duplicated.',
      ]),
    });
  });

  it('provides registered authored chunks by coordinate', async () => {
    const provider = new WorldChunkProvider(THE_WAKE_WORLD_MANIFEST, {
      authoredChunks: [HARBOR_COAST_CHUNK_0_0],
    });

    await expect(provider.loadChunk({ chunkX: 0, chunkY: 0 })).resolves.toMatchObject({
      chunk: HARBOR_COAST_CHUNK_0_0,
      source: 'authored',
    });
  });

  it('loads authored chunks through a manifest reference loader', async () => {
    const provider = new WorldChunkProvider(THE_WAKE_WORLD_MANIFEST, {
      loadAuthoredChunk: async (reference) =>
        reference.chunkX === 0 && reference.chunkY === 0 ? HARBOR_COAST_CHUNK_0_0 : null,
    });

    const result = await provider.loadChunk({ chunkX: 0, chunkY: 0 });

    expect(result.source).toBe('authored');
    expect(result.reference?.path).toBe('data/worlds/the_wake/chunks/0_0.json');
    expect(result.chunk).toBe(HARBOR_COAST_CHUNK_0_0);
  });

  it('generates default-fill chunks for unauthored world space', async () => {
    const provider = new WorldChunkProvider(THE_WAKE_WORLD_MANIFEST);
    const result = await provider.loadChunk({ chunkX: 12, chunkY: 8 });

    expect(result.source).toBe('default');
    expect(result.chunk).toMatchObject({
      worldId: 'the_wake',
      regionId: 'harbor_coast',
      chunkX: 12,
      chunkY: 8,
      width: 32,
      height: 32,
      terrain: {
        encoding: 'families',
      },
      metadata: {
        defaultWalkable: true,
        generatedFrom: 'world_manifest_default_fill',
      },
    });
    expect(result.chunk.terrain.tiles).toHaveLength(32);
    expect(result.chunk.terrain.tiles[0]).toHaveLength(32);
    expect(result.chunk.terrain.tiles[0][0]).toBe('grass');
    expect(validateWorldChunkDefinition(result.chunk)).toEqual({ ok: true });
  });

  it('rejects chunk requests outside manifest bounds', async () => {
    const provider = new WorldChunkProvider(THE_WAKE_WORLD_MANIFEST);

    await expect(provider.loadChunk({ chunkX: 1_000, chunkY: 0 })).rejects.toThrow(
      'Chunk 1000,0 is outside world manifest bounds.',
    );
  });

  it('loads an active player-centered chunk window', async () => {
    const provider = new WorldChunkProvider(THE_WAKE_WORLD_MANIFEST, {
      authoredChunks: [HARBOR_COAST_CHUNK_0_0],
    });
    const window = new ActiveWorldChunkWindow(provider, {
      loadRadius: 1,
      retainRadius: 2,
    });

    const chunks = await window.loadAroundTile(32, 32);

    expect(chunks).toHaveLength(9);
    expect(window.getActiveChunk({ chunkX: 1, chunkY: 1 })).not.toBeNull();
    expect(window.getStats()).toMatchObject({
      activeChunkCount: 9,
      centerChunk: { chunkX: 1, chunkY: 1 },
      retainedChunkCount: 9,
    });
  });

  it('keeps a retained buffer while moving the active chunk window', async () => {
    const provider = new WorldChunkProvider(THE_WAKE_WORLD_MANIFEST);
    const window = new ActiveWorldChunkWindow(provider, {
      loadRadius: 0,
      retainRadius: 1,
    });

    await window.loadAroundChunk({ chunkX: 10, chunkY: 10 });
    await window.loadAroundChunk({ chunkX: 11, chunkY: 10 });

    expect(window.getActiveChunks().map((chunk) => `${chunk.chunkX},${chunk.chunkY}`)).toEqual(['11,10']);
    expect(window.getStats().retainedChunkCount).toBe(2);
  });

  it('materializes chunk-local objects resources and zones into global runtime layers', () => {
    const layers = materializeWorldChunkRuntimeLayers({
      ...HARBOR_COAST_CHUNK_0_0,
      chunkX: 2,
      chunkY: 3,
    });

    expect(layers.chunkKey).toBe('2,3');
    expect(layers.objects[0]).toMatchObject({
      id: 'the_wake:2,3:object:harbor_rock_01',
      definitionId: 'small_rock',
      tileX: 70,
      tileY: 97,
    });
    expect(layers.resourceAnchors[0]).toMatchObject({
      id: 'the_wake:2,3:resource:driftwood_0_0_01',
      interactionType: 'resource_node',
      resourceNodeType: 'driftwood',
      tileX: 66,
      tileY: 101,
    });
    expect(layers.zones[0]).toMatchObject({
      id: 'the_wake:2,3:zone:harbor_safe_edge',
      tileX: 64,
      tileY: 96,
      width: 4,
      height: 4,
      tags: ['harbor', 'town'],
    });
  });

  it('rejects invalid terrain dimensions', () => {
    const chunk = makeChunk({
      terrain: {
        encoding: 'palette',
        tiles: [[0]],
      },
    });

    expect(validateWorldChunkDefinition(chunk)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        'terrain row count 1 does not match height 2.',
      ]),
    });
  });

  it('rejects missing terrain palette ids', () => {
    const chunk = makeChunk({
      terrain: {
        encoding: 'palette',
        tiles: [
          [0, 9],
          [1, 0],
        ],
      },
    });

    expect(validateWorldChunkDefinition(chunk)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        'Terrain tile 1,0 uses missing palette id 9.',
      ]),
    });
  });

  it('rejects resource nodes outside chunk bounds', () => {
    const chunk = makeChunk({
      resourceLayer: {
        nodes: [{
          id: 'bad_resource',
          resourceDefinitionId: 'driftwood',
          tileX: 3,
          tileY: 0,
        }],
      },
    });

    expect(validateWorldChunkDefinition(chunk)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        'Resource "bad_resource" is out of chunk bounds at 3,0.',
      ]),
    });
  });

  it('rejects habitat zones outside chunk bounds', () => {
    const chunk = makeChunk({
      habitatLayer: {
        habitats: [{
          id: 'bad_habitat',
          tileX: 1,
          tileY: 1,
          width: 2,
          height: 2,
          spawnRules: [{
            id: 'wolf_rule',
            creatureFamilyId: 'wolf',
          }],
        }],
      },
    });

    expect(validateWorldChunkDefinition(chunk)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        'Habitat "bad_habitat" is out of chunk bounds.',
      ]),
    });
  });

  it('treats future resource depletion as unavailable and past depletion as available', () => {
    const runtimeState: WorldChunkRuntimeState = {
      worldId: 'the_wake',
      regionId: 'harbor_coast',
      chunkX: 0,
      chunkY: 0,
      depletedResources: {
        driftwood: { nodeId: 'driftwood', respawnAt: 2_000 },
      },
    };

    expect(isResourceAvailableInRuntimeState(runtimeState, 'driftwood', 1_000)).toBe(false);
    expect(isResourceAvailableInRuntimeState(runtimeState, 'driftwood', 2_500)).toBe(true);
    expect(pruneExpiredResourceDepletions(runtimeState, 2_500).depletedResources).toBeUndefined();
  });

  it('omits unchanged chunks from runtime snapshots', () => {
    const changed: WorldChunkRuntimeState = {
      worldId: 'the_wake',
      regionId: 'harbor_coast',
      chunkX: 0,
      chunkY: 0,
      depletedResources: {
        driftwood: { nodeId: 'driftwood', respawnAt: 2_000 },
      },
    };
    const unchanged: WorldChunkRuntimeState = {
      worldId: 'the_wake',
      regionId: 'harbor_coast',
      chunkX: 0,
      chunkY: 1,
    };

    expect(createWorldRuntimeSnapshot('the_wake', [changed, unchanged], 1_000).changedChunks).toEqual({
      '0,0': changed,
    });
  });

});

function makeChunk(overrides: Partial<WorldChunkDefinition> = {}): WorldChunkDefinition {
  return {
    worldId: 'the_wake',
    regionId: 'test_region',
    chunkX: 0,
    chunkY: 0,
    width: 2,
    height: 2,
    terrainPalette: {
      0: 'grass',
      1: 'water',
    },
    terrain: {
      encoding: 'palette',
      tiles: [
        [0, 0],
        [1, 0],
      ],
    },
    objectLayer: { objects: [] },
    resourceLayer: { nodes: [] },
    zoneLayer: { zones: [] },
    habitatLayer: { habitats: [] },
    ...overrides,
  };
}
