import type { EditorMapDefinition } from '../shared/editor/EditorMapModel';

const MAX_HISTORY = 50;

export class EditorHistoryStack {
  private readonly undoStack: EditorMapDefinition[] = [];
  private readonly redoStack: EditorMapDefinition[] = [];
  private strokeOpen = false;

  /** Call on pointer-down before a paint stroke begins. Only snapshots once per stroke. */
  beginStroke(current: EditorMapDefinition): void {
    if (this.strokeOpen) return;
    this.push(current);
    this.strokeOpen = true;
  }

  /** Call on pointer-up to close the current stroke. */
  endStroke(): void {
    this.strokeOpen = false;
  }

  /** Snapshot before an atomic operation (place object, resize, rename, etc.). */
  snapshot(current: EditorMapDefinition): void {
    this.strokeOpen = false;
    this.push(current);
  }

  popUndo(current: EditorMapDefinition): EditorMapDefinition | null {
    const prev = this.undoStack.pop();
    if (!prev) return null;
    this.redoStack.push(current);
    if (this.redoStack.length > MAX_HISTORY) this.redoStack.shift();
    this.strokeOpen = false;
    return prev;
  }

  popRedo(current: EditorMapDefinition): EditorMapDefinition | null {
    const next = this.redoStack.pop();
    if (!next) return null;
    this.push(current);
    this.strokeOpen = false;
    return next;
  }

  canUndo(): boolean { return this.undoStack.length > 0; }
  canRedo(): boolean { return this.redoStack.length > 0; }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.strokeOpen = false;
  }

  private push(map: EditorMapDefinition): void {
    this.undoStack.push(map);
    if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
    this.redoStack.length = 0;
  }
}
