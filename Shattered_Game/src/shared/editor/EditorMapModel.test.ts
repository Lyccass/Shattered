import { describe, expect, it } from 'vitest';
import {
  createEditorMap,
  createEditorMapFromWorldChunkDefinition,
  addEditorPlacedObject,
  exportEditorMapToMapDefinition,
  exportEditorMapToWorldChunkDefinition,
  getEditorTerrainTilePaint,
  paintTerrain,
  paintTerrainTile,
  resizeEditorMap,
  serializeEditorMap,
  type EditorTerrainTilePaint,
} from './EditorMapModel';
import { validateMapShape } from '../map/MapValidation';

const GRASS_TILE: EditorTerrainTilePaint = {
  id: 'grassA01',
  family: 'grass',
  textureKey: 'terrain-grassA01',
  flipX: false,
  flipY: false,
};

const WATER_TILE: EditorTerrainTilePaint = {
  id: 'waterA',
  family: 'water',
  textureKey: 'terrain-waterA',
  flipX: false,
  flipY: false,
};

const FLIPPED_STONE_TILE: EditorTerrainTilePaint = {
  id: 'stoneGroundA08',
  family: 'stone',
  textureKey: 'terrain-groundA08',
  flipX: true,
  flipY: true,
};

describe('EditorMapModel', () => {
  it('paints terrain at the requested tile', () => {
    const map = createEditorMap(4, 3, 'grass');

    expect(paintTerrain(map, 2, 1, 'water')).toBe(true);
    expect(map.terrain[1][2]).toBe('water');
  });

  it('ignores out-of-bounds paint requests', () => {
    const map = createEditorMap(4, 3, 'grass');

    expect(paintTerrain(map, 4, 1, 'water')).toBe(false);
    expect(paintTerrain(map, -1, 1, 'water')).toBe(false);
    expect(map.terrain.flat().every((family) => family === 'grass')).toBe(true);
  });

  it('resizes maps while preserving overlapping terrain', () => {
    const map = createEditorMap(2, 2, 'grass', 'editor_test_map', 'Editor Test Map', GRASS_TILE);
    paintTerrainTile(map, 1, 0, WATER_TILE);

    const resized = resizeEditorMap(map, 3, 1, FLIPPED_STONE_TILE);

    expect(resized.width).toBe(3);
    expect(resized.height).toBe(1);
    expect(resized.terrain).toEqual([
      ['grass', 'water', 'stone'],
    ]);
    expect(getEditorTerrainTilePaint(resized, 1, 0)).toEqual(WATER_TILE);
    expect(getEditorTerrainTilePaint(resized, 2, 0)).toEqual(FLIPPED_STONE_TILE);
  });

  it('tracks exact tile art separately from terrain families', () => {
    const map = createEditorMap(2, 2, 'grass', 'editor_test_map', 'Editor Test Map', GRASS_TILE);

    expect(paintTerrainTile(map, 1, 1, FLIPPED_STONE_TILE)).toBe(true);
    expect(getEditorTerrainTilePaint(map, 1, 1)).toEqual(FLIPPED_STONE_TILE);

    const exported = exportEditorMapToMapDefinition(map);

    expect(exported.terrain[1][1]).toBe('stone');
    expect(exported.metadata).toMatchObject({
      editorTerrainTiles: {
        '1,1': FLIPPED_STONE_TILE,
      },
    });
  });

  it('clears exact tile art when falling back to family-only terrain paint', () => {
    const map = createEditorMap(2, 2, 'grass', 'editor_test_map', 'Editor Test Map', GRASS_TILE);
    paintTerrainTile(map, 1, 1, FLIPPED_STONE_TILE);

    paintTerrain(map, 1, 1, 'water');

    expect(getEditorTerrainTilePaint(map, 1, 1)).toBeNull();
  });

  it('exports terrain dimensions and terrain families only', () => {
    const map = createEditorMap(5, 2, 'grass');
    paintTerrain(map, 1, 0, 'stone');

    const exported = exportEditorMapToMapDefinition(map);

    expect(exported.width).toBe(5);
    expect(exported.height).toBe(2);
    expect(exported.terrain).toEqual([
      ['grass', 'stone', 'grass', 'grass', 'grass'],
      ['grass', 'grass', 'grass', 'grass', 'grass'],
    ]);
    expect(exported.objects).toEqual([]);
    expect(exported.transitions).toEqual([]);
  });

  it('exports object placements as explicit object definition ids', () => {
    const map = addEditorPlacedObject(createEditorMap(3, 3, 'grass'), {
      id: 'object_1',
      definitionId: 'small_rock',
      tileX: 1,
      tileY: 2,
    });

    const exported = exportEditorMapToMapDefinition(map);

    expect(exported.objects).toEqual([
      {
        id: 'object_1',
        definitionId: 'small_rock',
        tileX: 1,
        tileY: 2,
      },
    ]);
  });

  it('exports and reimports world chunk definitions for chunk-authoring workflows', () => {
    const map = createEditorMap(2, 2, 'grass', 'editor_test_map', 'Editor Test Map', GRASS_TILE);
    paintTerrainTile(map, 1, 1, FLIPPED_STONE_TILE);

    const chunk = exportEditorMapToWorldChunkDefinition(map, {
      worldId: 'the_wake',
      regionId: 'editor_region',
      chunkX: 0,
      chunkY: 0,
    });
    const reimported = createEditorMapFromWorldChunkDefinition(chunk);

    expect(chunk.worldId).toBe('the_wake');
    expect(chunk.terrain.encoding).toBe('palette');
    expect(chunk.metadata).toMatchObject({
      editorTerrainTiles: {
        '1,1': FLIPPED_STONE_TILE,
      },
    });
    expect(reimported.terrain).toEqual(map.terrain);
    expect(getEditorTerrainTilePaint(reimported, 1, 1)).toEqual(FLIPPED_STONE_TILE);
  });

  it('serializes a plain JSON map definition', () => {
    const map = createEditorMap(2, 2, 'dirt');
    const serialized = serializeEditorMap(map);
    const parsed: unknown = JSON.parse(serialized);

    expect(parsed).toEqual({
      id: 'editor_test_map',
      displayName: 'Editor Test Map',
      spaceType: 'open_world',
      width: 2,
      height: 2,
      terrain: [
        ['dirt', 'dirt'],
        ['dirt', 'dirt'],
      ],
      spawnPoints: {
        default: {
          id: 'default',
          tileX: 1,
          tileY: 1,
        },
      },
      objects: [],
      transitions: [],
      zones: [],
      interactionAnchors: [],
      metadata: {
        source: 'map_editor_v0',
        editorTerrainTiles: {},
      },
    });
  });

  it('validates exported maps', () => {
    const map = createEditorMap(3, 3, 'sand');

    expect(validateMapShape(exportEditorMapToMapDefinition(map))).toEqual({ ok: true });
  });

  it('rejects invalid terrain dimensions', () => {
    const result = validateMapShape({
      id: 'bad_map',
      displayName: 'Bad Map',
      width: 2,
      height: 2,
      terrain: [['grass']],
    });

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      errors: expect.arrayContaining([
        'Map terrain row count 1 does not match height 2.',
      ]),
    });
  });

  it('rejects invalid terrain families', () => {
    const result = validateMapShape({
      id: 'bad_map',
      displayName: 'Bad Map',
      width: 1,
      height: 1,
      terrain: [['lava']],
    });

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      errors: expect.arrayContaining([
        'Map terrain tile 0,0 uses invalid family "lava".',
      ]),
    });
  });
});
