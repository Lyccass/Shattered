import { describe, expect, it } from 'vitest';
import {
  createSaveConfidenceState,
  formatSaveConfidence,
  formatSaveTarget,
} from './EditorSaveConfidence';

describe('EditorSaveConfidence', () => {
  it('reports unsaved chunk count before last-save details', () => {
    const state = createSaveConfidenceState(
      [{ chunkX: 2, chunkY: 0 }, { chunkX: 1, chunkY: 0 }],
      {
        savedAt: new Date('2026-05-26T12:00:00Z'),
        savedChunkCount: 2,
        target: 'project-world',
        worldId: 'the_wake',
      },
      'project-world',
    );

    expect(state.dirtyChunkKeys).toEqual(['1,0', '2,0']);
    expect(formatSaveConfidence(state)).toBe('2 unsaved chunks');
  });

  it('formats target labels for world and library saves', () => {
    expect(formatSaveTarget('project-world')).toBe('world files');
    expect(formatSaveTarget('chunk-library')).toBe('chunk library');
  });
});
