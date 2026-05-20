import { describe, expect, it } from 'vitest';
import { EditorDirtyChunkTracker } from './EditorDirtyChunkTracker';

describe('EditorDirtyChunkTracker', () => {
  it('marks changed tiles by chunk key', () => {
    const tracker = new EditorDirtyChunkTracker(16);

    tracker.markTileDirty(0, 0);
    tracker.markTileDirty(17, 2);
    tracker.markTileDirty(17, 2);

    expect(tracker.getSummary()).toEqual({
      count: 2,
      keys: ['0,0', '1,0'],
    });
  });

  it('can mark all chunks dirty after whole-map edits', () => {
    const tracker = new EditorDirtyChunkTracker(16);

    tracker.markAllChunksDirty(33, 17);

    expect(tracker.getDirtyChunks()).toEqual([
      { chunkX: 0, chunkY: 0 },
      { chunkX: 1, chunkY: 0 },
      { chunkX: 2, chunkY: 0 },
      { chunkX: 0, chunkY: 1 },
      { chunkX: 1, chunkY: 1 },
      { chunkX: 2, chunkY: 1 },
    ]);
  });

  it('clears dirty chunks after save/export checkpoints', () => {
    const tracker = new EditorDirtyChunkTracker(16);

    tracker.markTileDirty(7, 7);
    expect(tracker.hasDirtyChunks()).toBe(true);

    tracker.clear();
    expect(tracker.getSummary()).toEqual({ count: 0, keys: [] });
  });
});
