import Phaser from 'phaser';
import type { TerrainFamily } from '../../shared/map/TerrainTypes';

export type EditorToolMode = 'terrain' | 'object' | 'walkability' | 'elevation' | 'zone' | 'encounter' | 'npc';
type ZoomDirection = 'in' | 'out';

type EditorInputHandlers = {
  applyPrimaryAction: (pointer: Phaser.Input.Pointer) => void;
  adjustBrushSize: (delta: number) => void;
  beginStroke: () => void;
  centerCameraOnMap: () => void;
  cycleSelection: (offset: number) => void;
  endStroke: () => void;
  exportDirtyChunks: () => void;
  exportWorldChunk: () => void;
  flipSelectedBrush: (axis: 'x' | 'y') => void;
  getToolMode: () => EditorToolMode;
  importDirtyChunks: () => void;
  isPaletteOpen: () => boolean;
  isPointerPanning: () => boolean;
  openChunkWindow: () => void;
  redo: () => void;
  redrawPointerState: () => void;
  removeHoveredObject: () => void;
  renameHoveredChunk: () => void;
  resetTerrainStroke: () => void;
  resizeMap: () => void;
  selectBrushForFamily: (family: TerrainFamily) => void;
  setToolMode: (mode: EditorToolMode) => void;
  startPointerPan: (pointer: Phaser.Input.Pointer) => void;
  stopPointerPan: () => void;
  togglePalette: () => void;
  undo: () => void;
  updatePointerPan: (pointer: Phaser.Input.Pointer) => void;
  updateHoverFromPointer: (pointer: Phaser.Input.Pointer) => void;
  zoom: (direction: ZoomDirection) => void;
};

const BRUSH_KEYS: Record<string, TerrainFamily> = {
  Digit1: 'grass',
  Digit2: 'dirt',
  Digit3: 'stone',
  Digit4: 'water',
  Digit5: 'sand',
};

export class EditorInputController {
  private isRegistered = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly handlers: EditorInputHandlers,
  ) {}

  register(): void {
    if (this.isRegistered) {
      return;
    }

    this.scene.input.on('pointermove', this.onPointerMove);
    this.scene.input.on('pointerdown', this.onPointerDown);
    this.scene.input.on('pointerup', this.onPointerUp);
    this.scene.input.on('wheel', this.onWheel);
    this.scene.input.keyboard?.on('keydown', this.onKeyDown);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy);
    this.isRegistered = true;
  }

  destroy = (): void => {
    if (!this.isRegistered) {
      return;
    }

    this.scene.input.off('pointermove', this.onPointerMove);
    this.scene.input.off('pointerdown', this.onPointerDown);
    this.scene.input.off('pointerup', this.onPointerUp);
    this.scene.input.off('wheel', this.onWheel);
    this.scene.input.keyboard?.off('keydown', this.onKeyDown);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy);
    this.isRegistered = false;
  };

  private readonly onPointerMove = (pointer: Phaser.Input.Pointer): void => {
    this.handlers.updatePointerPan(pointer);
    this.handlers.updateHoverFromPointer(pointer);

    if (pointer.leftButtonDown() && !this.handlers.isPointerPanning() && !this.handlers.isPaletteOpen()) {
      this.handlers.applyPrimaryAction(pointer);
    }

    this.handlers.redrawPointerState();
  };

  private readonly onPointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (this.handlers.isPaletteOpen()) {
      return;
    }

    this.handlers.resetTerrainStroke();

    if (pointer.rightButtonDown() || pointer.middleButtonDown()) {
      this.handlers.startPointerPan(pointer);
      return;
    }

    if (pointer.leftButtonDown()) {
      this.handlers.beginStroke();
      this.handlers.applyPrimaryAction(pointer);
    }
  };

  private readonly onPointerUp = (): void => {
    this.handlers.stopPointerPan();
    this.handlers.resetTerrainStroke();
    this.handlers.endStroke();
  };

  private readonly onWheel = (
    _pointer: Phaser.Input.Pointer,
    _objects: unknown[],
    _deltaX: number,
    deltaY: number,
  ): void => {
    this.handlers.zoom(deltaY > 0 ? 'out' : 'in');
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (isTypingTarget(event.target)) {
      return;
    }

    const brushFamily = BRUSH_KEYS[event.code];

    if (brushFamily && this.handlers.getToolMode() === 'terrain') {
      this.handlers.selectBrushForFamily(brushFamily);
      return;
    }

    if (event.code === 'KeyT') {
      this.handlers.setToolMode('terrain');
      return;
    }

    if (event.code === 'KeyO') {
      this.handlers.setToolMode('object');
      return;
    }

    if (event.code === 'KeyP') {
      this.handlers.togglePalette();
      return;
    }

    if (event.ctrlKey && event.code === 'KeyS') {
      event.preventDefault();
      this.handlers.exportDirtyChunks();
      return;
    }

    if (event.ctrlKey && event.shiftKey && event.code === 'KeyZ') {
      event.preventDefault();
      this.handlers.redo();
      return;
    }

    if (event.ctrlKey && event.code === 'KeyZ') {
      event.preventDefault();
      this.handlers.undo();
      return;
    }

    if (event.ctrlKey && event.code === 'KeyY') {
      event.preventDefault();
      this.handlers.redo();
      return;
    }

    if (event.code === 'KeyL') {
      this.handlers.openChunkWindow();
      return;
    }

    if (event.code === 'KeyQ' || event.code === 'BracketLeft') {
      if (!event.shiftKey) {
        this.handlers.cycleSelection(-1);
      }
      return;
    }

    if (event.code === 'KeyE' || event.code === 'BracketRight') {
      if (!event.shiftKey) {
        this.handlers.cycleSelection(1);
      }
      return;
    }

    // Shift+[ / Shift+] → decrease / increase brush size (terrain mode only)
    if (event.shiftKey && event.code === 'BracketLeft' && this.handlers.getToolMode() === 'terrain') {
      this.handlers.adjustBrushSize(-1);
      return;
    }

    if (event.shiftKey && event.code === 'BracketRight' && this.handlers.getToolMode() === 'terrain') {
      this.handlers.adjustBrushSize(1);
      return;
    }

    if (event.code === 'KeyF' && this.handlers.getToolMode() === 'terrain') {
      this.handlers.flipSelectedBrush('x');
      return;
    }

    if (event.code === 'KeyV' && this.handlers.getToolMode() === 'terrain') {
      this.handlers.flipSelectedBrush('y');
      return;
    }

    if (event.code === 'KeyN') {
      this.handlers.renameHoveredChunk();
      return;
    }

    if (event.code === 'Backspace' || event.code === 'Delete') {
      this.handlers.removeHoveredObject();
      return;
    }

    if (event.code === 'KeyU') {
      this.handlers.exportDirtyChunks();
      return;
    }

    if (event.code === 'KeyI') {
      this.handlers.openChunkWindow();
      return;
    }

    if (event.code === 'KeyJ') {
      this.handlers.importDirtyChunks();
      return;
    }

    if (event.code === 'KeyR') {
      this.handlers.resizeMap();
      return;
    }

    if (event.code === 'KeyC') {
      this.handlers.centerCameraOnMap();
      return;
    }

    if (event.code === 'Equal' || event.code === 'NumpadAdd') {
      this.handlers.zoom('in');
      return;
    }

    if (event.code === 'Minus' || event.code === 'NumpadSubtract') {
      this.handlers.zoom('out');
    }
  };
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  return target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement;
}
