import type { ChunkCoordinate } from '../../shared/world/ChunkKey';

export type EditorSaveTarget = 'project-world' | 'chunk-library';

export type EditorSaveSnapshot = {
  savedAt: Date;
  savedChunkCount: number;
  target: EditorSaveTarget;
  worldId: string;
};

export type EditorSaveConfidenceState = {
  dirtyChunkCount: number;
  dirtyChunkKeys: string[];
  lastSave: EditorSaveSnapshot | null;
};

export function createSaveConfidenceState(
  dirtyChunks: ChunkCoordinate[],
  lastSave: EditorSaveSnapshot | null,
): EditorSaveConfidenceState {
  return {
    dirtyChunkCount: dirtyChunks.length,
    dirtyChunkKeys: dirtyChunks
      .map((chunk) => `${chunk.chunkX},${chunk.chunkY}`)
      .sort(compareChunkKeys),
    lastSave,
  };
}

export function formatSaveConfidence(state: EditorSaveConfidenceState): string {
  if (state.dirtyChunkCount > 0) {
    return `${state.dirtyChunkCount} unsaved chunk${state.dirtyChunkCount === 1 ? '' : 's'}`;
  }

  if (!state.lastSave) {
    return 'No saved changes this session';
  }

  return `${state.lastSave.savedChunkCount} chunk${state.lastSave.savedChunkCount === 1 ? '' : 's'} saved ${formatTime(state.lastSave.savedAt)}`;
}

export function formatSaveTarget(target: EditorSaveTarget): string {
  return target === 'project-world' ? 'world files' : 'chunk library';
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function compareChunkKeys(left: string, right: string): number {
  const [leftX, leftY] = parseChunkKey(left);
  const [rightX, rightY] = parseChunkKey(right);
  return leftY - rightY || leftX - rightX;
}

function parseChunkKey(key: string): [number, number] {
  const [chunkX = '0', chunkY = '0'] = key.split(',');
  return [Number.parseInt(chunkX, 10) || 0, Number.parseInt(chunkY, 10) || 0];
}
