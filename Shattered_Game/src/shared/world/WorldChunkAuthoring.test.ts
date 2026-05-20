import { describe, expect, it } from 'vitest';
import { createHomeIslandMap } from '../../world/maps/TestHomeIslandMap';
import {
  createChunkKey,
  parseChunkKey,
} from './ChunkKey';
import {
  mapDefinitionToSingleWorldChunk,
  worldChunkDefinitionToMapDefinition,
} from './ChunkAdapters';
import {
  createWorldRuntimeSnapshot,
  isResourceAvailableInRuntimeState,
  pruneExpiredResourceDepletions,
  type WorldChunkRuntimeState,
} from './ChunkRuntimeState';
import { validateWorldChunkDefinition } from './ChunkValidation';
import type { WorldChunkDefinition } from './ChunkTypes';
import {
  createTerrainPalette,
  decodeTerrainPaletteLayer,
  encodeTerrainPaletteLayer,
} from './TerrainPalette';
import { HARBOR_COAST_CHUNK_0_0 } from './samples/TheWakeSampleWorld';

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

  it('adapts existing prototype maps into one authored chunk and back', () => {
    const map = createHomeIslandMap();
    const chunk = mapDefinitionToSingleWorldChunk(map, {
      worldId: 'prototype_world',
      regionId: 'home_island_region',
    });
    const adaptedMap = worldChunkDefinitionToMapDefinition(chunk, {
      mapId: map.id,
      displayName: map.displayName,
    });

    expect(validateWorldChunkDefinition(chunk)).toEqual({ ok: true });
    expect(adaptedMap.width).toBe(map.width);
    expect(adaptedMap.height).toBe(map.height);
    expect(adaptedMap.terrain).toEqual(map.terrain);
    expect(adaptedMap.objects).toEqual(map.objects);
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
