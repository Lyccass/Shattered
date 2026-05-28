import { describe, expect, it } from 'vitest';
import {
  createEditorMap,
  paintTerrainTile,
  type EditorTerrainTilePaint,
} from '../../shared/editor/EditorMapModel';
import {
  applyDirtyChunkBundle,
  createDirtyChunkBundle,
  createReferenceOnlyDirtyChunkBundle,
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
    const map = createEditorMap(64, 32, 'grass', 'dirty_map', 'Dirty Map', grassPaint);
    paintTerrainTile(map, 33, 4, stonePaint);

    const bundle = createDirtyChunkBundle(map, [{ chunkX: 1, chunkY: 0 }], {
      chunkSize: 32,
      exportedAt: '2026-05-20T00:00:00.000Z',
      regionId: 'test_region',
      worldId: 'the_wake',
    });

    expect(bundle.chunks).toHaveLength(1);
    expect(bundle.chunks[0]).toMatchObject({
      chunkX: 1,
      chunkY: 0,
      height: 32,
      regionId: 'test_region',
      width: 32,
      worldId: 'the_wake',
    });
    expect(Object.values(bundle.chunks[0].terrainPalette ?? {})).toContainEqual({
      family: stonePaint.family,
      tileId: stonePaint.id,
      textureKey: stonePaint.textureKey,
      walkable: stonePaint.walkable,
      flipX: stonePaint.flipX,
      flipY: stonePaint.flipY,
    });
    expect(bundle.chunks[0].metadata?.editorTerrainTiles).toBeUndefined();
  });

  it('imports chunk terrain and objects back into the matching map area', () => {
    const source = createEditorMap(64, 32, 'grass', 'source_map', 'Source Map', grassPaint);
    paintTerrainTile(source, 33, 4, stonePaint);
    source.objects.push({
      id: 'rock_1',
      definitionId: 'mossy_rock',
      tileX: 34,
      tileY: 5,
    });
    const target = createEditorMap(64, 32, 'grass', 'target_map', 'Target Map', grassPaint);

    const bundle = createDirtyChunkBundle(source, [{ chunkX: 1, chunkY: 0 }], {
      chunkSize: 32,
      exportedAt: '2026-05-20T00:00:00.000Z',
      regionId: 'test_region',
      worldId: 'the_wake',
    });
    const imported = applyDirtyChunkBundle(target, bundle);

    expect(imported.terrain[4][33]).toBe('stone');
    expect(imported.terrainTiles['33,4']).toEqual(stonePaint);
    expect(imported.objects).toContainEqual({
      id: 'rock_1',
      definitionId: 'mossy_rock',
      tileX: 34,
      tileY: 5,
    });
  });

  it('exports encounter areas as chunk habitat data and imports them back', () => {
    const source = createEditorMap(64, 32, 'grass', 'source_map', 'Source Map', grassPaint);
    source.encounterAreas.push({
      id: 'forest_edge',
      name: 'Forest Edge',
      tileX: 30,
      tileY: 4,
      width: 8,
      height: 6,
      tags: ['wilds', 'forest'],
      spawnRules: [
        {
          id: 'wolf_rule',
          enemyDefinitionId: 'wolf_passive',
          creatureFamilyId: 'wolf',
          maxPopulation: 4,
          respawnMs: 45_000,
          weight: 2,
          lootTableId: 'wolf_common',
        },
      ],
      manualSpawns: [
        {
          id: 'fixed_wolf',
          enemyDefinitionId: 'wolf_passive',
          tileX: 35,
          tileY: 6,
          respawnMs: 60_000,
          lootTableId: 'wolf_common',
        },
      ],
    });
    const target = createEditorMap(64, 32, 'grass', 'target_map', 'Target Map', grassPaint);

    const bundle = createDirtyChunkBundle(source, [{ chunkX: 1, chunkY: 0 }], {
      chunkSize: 32,
      exportedAt: '2026-05-20T00:00:00.000Z',
      regionId: 'test_region',
      worldId: 'the_wake',
    });
    const chunk = bundle.chunks[0];

    expect(chunk.habitatLayer.habitats).toEqual([
      expect.objectContaining({
        id: 'forest_edge',
        name: 'Forest Edge',
        tileX: 0,
        tileY: 4,
        width: 6,
        height: 6,
        tags: ['wilds', 'forest'],
        spawnRules: [
          expect.objectContaining({
            enemyDefinitionId: 'wolf_passive',
            maxPopulation: 4,
            respawnMs: 45_000,
            lootTableId: 'wolf_common',
          }),
        ],
        manualSpawns: [
          expect.objectContaining({
            id: 'fixed_wolf',
            tileX: 3,
            tileY: 6,
          }),
        ],
      }),
    ]);

    const imported = applyDirtyChunkBundle(target, bundle);

    expect(imported.encounterAreas).toEqual([
      expect.objectContaining({
        id: 'forest_edge',
        tileX: 32,
        tileY: 4,
        width: 6,
        height: 6,
        manualSpawns: [
          expect.objectContaining({
            id: 'fixed_wolf',
            tileX: 35,
            tileY: 6,
          }),
        ],
      }),
    ]);
  });

  it('can strip image payloads from project-library chunk bundles', () => {
    const customPaint: EditorTerrainTilePaint = {
      ...stonePaint,
      textureDataUrl: 'data:image/png;base64,huge-tile-payload',
    };
    const map = createEditorMap(64, 32, 'grass', 'source_map', 'Source Map', grassPaint);
    map.customTerrainBrushes = [customPaint];
    paintTerrainTile(map, 33, 4, customPaint);

    const portableBundle = createDirtyChunkBundle(map, [{ chunkX: 1, chunkY: 0 }], {
      chunkSize: 32,
      exportedAt: '2026-05-20T00:00:00.000Z',
      regionId: 'test_region',
      worldId: 'the_wake',
    });
    const referenceOnlyBundle = createReferenceOnlyDirtyChunkBundle(portableBundle);
    const serialized = JSON.stringify(referenceOnlyBundle);

    expect(serialized).not.toContain('huge-tile-payload');
    expect(referenceOnlyBundle.chunks[0].metadata?.editorTerrainBrushes).toBeUndefined();
    expect(Object.values(referenceOnlyBundle.chunks[0].terrainPalette ?? {})).toContainEqual({
      family: customPaint.family,
      tileId: customPaint.id,
      textureKey: customPaint.textureKey,
      walkable: customPaint.walkable,
      flipX: customPaint.flipX,
      flipY: customPaint.flipY,
    });
    expect(referenceOnlyBundle.chunks[0].metadata?.editorTerrainTiles).toBeUndefined();
  });

  it('exports NPC anchors into chunk npcLayer and imports them back', () => {
    const source = createEditorMap(64, 32, 'grass', 'source_map', 'Source Map', grassPaint);
    source.npcAnchors.push({ id: 'maren_1', definitionId: 'trader_maren', tileX: 33, tileY: 5 });
    const target = createEditorMap(64, 32, 'grass', 'target_map', 'Target Map', grassPaint);

    const bundle = createDirtyChunkBundle(source, [{ chunkX: 1, chunkY: 0 }], {
      chunkSize: 32,
      exportedAt: '2026-05-20T00:00:00.000Z',
      regionId: 'test_region',
      worldId: 'the_wake',
    });

    expect(bundle.chunks[0].npcLayer?.anchors).toEqual([
      expect.objectContaining({ npcDefinitionId: 'trader_maren', tileX: 1, tileY: 5 }),
    ]);

    const imported = applyDirtyChunkBundle(target, bundle);
    expect(imported.npcAnchors).toEqual([
      expect.objectContaining({ id: 'maren_1', definitionId: 'trader_maren', tileX: 33, tileY: 5 }),
    ]);
  });

  it('rejects malformed dirty chunk bundle json safely', () => {
    expect(() => parseDirtyChunkBundleJson('{"version":2,"chunks":[]}'))
      .toThrow('Invalid dirty chunk bundle.');
  });
});
