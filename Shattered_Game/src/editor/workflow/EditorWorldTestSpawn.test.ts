import { describe, expect, it } from 'vitest';
import { resolveEditorWorldTestSpawn } from './EditorWorldTestSpawn';

describe('EditorWorldTestSpawn', () => {
  it('resolves hover tiles into world chunk spawn ids', () => {
    expect(resolveEditorWorldTestSpawn('hover', {
      chunkSize: 32,
      hoverTile: { x: 4, y: 9 },
      mapHeight: 32,
      mapWidth: 32,
      originChunkX: 3,
      originChunkY: 2,
    })).toMatchObject({
      chunkX: 3,
      chunkY: 2,
      label: 'Tile 4, 9',
      spawnId: 'chunk_3_2_tile_4_9',
    });
  });

  it('uses the loaded window center when center mode is selected', () => {
    expect(resolveEditorWorldTestSpawn('center', {
      chunkSize: 32,
      hoverTile: { x: 0, y: 0 },
      mapHeight: 64,
      mapWidth: 64,
      originChunkX: 1,
      originChunkY: 1,
    })).toMatchObject({
      chunkX: 2,
      chunkY: 2,
      label: 'Tile 32, 32',
      spawnId: 'chunk_2_2_tile_0_0',
    });
  });
});
