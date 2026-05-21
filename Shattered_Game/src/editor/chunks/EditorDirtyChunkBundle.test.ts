import { describe, expect, it } from 'vitest';
import {
  createEditorMap,
  paintTerrainTile,
  type EditorTerrainTilePaint,
} from '../../shared/editor/EditorMapModel';
import {
  applyDirtyChunkBundle,
  createDirtyChunkBundle,
  parseDirtyChunkBundleJson,
} from './EditorDirtyChunkBundle';

const grassPaint: EditorTerrainTilePaint = {
  id: 'grass_test',
  family: 'grass',
  textureKey: 'grass_texture',
  walkable: true,
  flipX: false,
  flipY: false,
};

const stonePaint: EditorTerrainTilePaint = {
  id: 'stone_test',
  family: 'stone',
  textureKey: 'stone_texture',
  walkable: true,
  flipX: true,
  flipY: false,
};

describe('EditorDirtyChunkBundle', () => {
  it('exports only requested dirty chunks as world chunks', () => {
    const map = createEditorMap(32, 16, 'grass', 'dirty_map', 'Dirty Map', grassPaint);
    paintTerrainTile(map, 17, 4, stonePaint);

    const bundle = createDirtyChunkBundle(map, [{ chunkX: 1, chunkY: 0 }], {
      chunkSize: 16,
      exportedAt: '2026-05-20T00:00:00.000Z',
      regionId: 'test_region',
      worldId: 'the_wake',
    });

    expect(bundle.chunks).toHaveLength(1);
    expect(bundle.chunks[0]).toMatchObject({
      chunkX: 1,
      chunkY: 0,
      height: 16,
      regionId: 'test_region',
      width: 16,
      worldId: 'the_wake',
    });
    expect(bundle.chunks[0].metadata?.editorTerrainTiles).toMatchObject({
      '1,4': stonePaint,
    });
  });

  it('imports chunk terrain and objects back into the matching map area', () => {
    const source = createEditorMap(32, 16, 'grass', 'source_map', 'Source Map', grassPaint);
    paintTerrainTile(source, 17, 4, stonePaint);
    source.objects.push({
      id: 'rock_1',
      definitionId: 'mossy_rock',
      tileX: 18,
      tileY: 5,
    });
    const target = createEditorMap(32, 16, 'grass', 'target_map', 'Target Map', grassPaint);

    const bundle = createDirtyChunkBundle(source, [{ chunkX: 1, chunkY: 0 }], {
      chunkSize: 16,
      exportedAt: '2026-05-20T00:00:00.000Z',
      regionId: 'test_region',
      worldId: 'the_wake',
    });
    const imported = applyDirtyChunkBundle(target, bundle);

    expect(imported.terrain[4][17]).toBe('stone');
    expect(imported.terrainTiles['17,4']).toEqual(stonePaint);
    expect(imported.objects).toContainEqual({
      id: 'rock_1',
      definitionId: 'mossy_rock',
      tileX: 18,
      tileY: 5,
    });
  });

  it('rejects malformed dirty chunk bundle json safely', () => {
    expect(() => parseDirtyChunkBundleJson('{"version":2,"chunks":[]}'))
      .toThrow('Invalid dirty chunk bundle.');
  });
});
