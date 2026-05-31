import type { EditorMapDefinition } from '../../shared/editor/EditorMapModel';
import type { EditorDirtyChunkTracker } from '../chunks/EditorDirtyChunkTracker';
import type { EditorHistoryStack } from '../EditorHistoryStack';

type EditorUndoRedoCallbacks = {
  getMap: () => EditorMapDefinition;
  persistWorkingDraft: () => void;
  redrawObjects: () => void;
  redrawOverlay: () => void;
  redrawTerrain: () => void;
  setMap: (map: EditorMapDefinition) => void;
  setStatus: (message: string) => void;
  updateInfoText: () => void;
};

export class EditorUndoRedoController {
  constructor(
    private readonly history: EditorHistoryStack,
    private readonly dirtyChunks: EditorDirtyChunkTracker,
    private readonly callbacks: EditorUndoRedoCallbacks,
  ) {}

  applyUndo(): void {
    const previousMap = this.history.popUndo(this.callbacks.getMap());
    if (!previousMap) {
      this.callbacks.setStatus('Nothing to undo.');
      return;
    }

    this.applyMapFromHistory(previousMap);
    this.callbacks.setStatus('Undo.');
  }

  applyRedo(): void {
    const nextMap = this.history.popRedo(this.callbacks.getMap());
    if (!nextMap) {
      this.callbacks.setStatus('Nothing to redo.');
      return;
    }

    this.applyMapFromHistory(nextMap);
    this.callbacks.setStatus('Redo.');
  }

  private applyMapFromHistory(map: EditorMapDefinition): void {
    this.callbacks.setMap(map);
    this.dirtyChunks.markAllChunksDirty(map.width, map.height);
    this.callbacks.redrawTerrain();
    this.callbacks.redrawObjects();
    this.callbacks.redrawOverlay();
    this.callbacks.updateInfoText();
    this.callbacks.persistWorkingDraft();
  }
}
