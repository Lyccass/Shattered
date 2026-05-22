import Phaser from 'phaser';
import {
  getTileCenterWorld,
  type IsoTransformConfig,
} from '../../shared/iso/IsoCoordinates';

type PanKeys = {
  w: Phaser.Input.Keyboard.Key;
  a: Phaser.Input.Keyboard.Key;
  s: Phaser.Input.Keyboard.Key;
  d: Phaser.Input.Keyboard.Key;
  up: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
};

type EditorViewportControllerOptions = {
  maxZoom: number;
  minZoom: number;
  panSpeed: number;
  transform: IsoTransformConfig;
  zoomStep: number;
  onZoomChanged?: () => void;
};

export class EditorViewportController {
  private readonly panKeys?: PanKeys;
  private isPointerPanning = false;
  private lastPanPointer?: { x: number; y: number };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: EditorViewportControllerOptions,
  ) {
    this.panKeys = scene.input.keyboard?.addKeys({
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
    }) as PanKeys | undefined;
  }

  update(deltaMs: number): void {
    this.updateKeyboardPanning(deltaMs);
  }

  startPointerPan(pointer: Phaser.Input.Pointer): void {
    this.isPointerPanning = true;
    this.lastPanPointer = { x: pointer.x, y: pointer.y };
  }

  updatePointerPan(pointer: Phaser.Input.Pointer): void {
    if (!this.isPointerPanning || !this.lastPanPointer) {
      return;
    }

    const isStillPanning = pointer.rightButtonDown() || pointer.middleButtonDown();

    if (!isStillPanning) {
      this.stopPointerPan();
      return;
    }

    const camera = this.scene.cameras.main;
    const deltaX = pointer.x - this.lastPanPointer.x;
    const deltaY = pointer.y - this.lastPanPointer.y;
    camera.scrollX -= deltaX / camera.zoom;
    camera.scrollY -= deltaY / camera.zoom;
    this.lastPanPointer = { x: pointer.x, y: pointer.y };
  }

  stopPointerPan(): void {
    this.isPointerPanning = false;
    this.lastPanPointer = undefined;
  }

  isPanning(): boolean {
    return this.isPointerPanning;
  }

  adjustZoom(direction: 'in' | 'out'): void {
    this.adjustZoomBy(direction === 'in' ? this.options.zoomStep : -this.options.zoomStep);
  }

  adjustZoomBy(delta: number): void {
    const camera = this.scene.cameras.main;
    camera.setZoom(Phaser.Math.Clamp(
      camera.zoom + delta,
      this.options.minZoom,
      this.options.maxZoom,
    ));
    this.options.onZoomChanged?.();
  }

  centerOnMap(width: number, height: number): void {
    const center = getTileCenterWorld(
      this.options.transform,
      Math.floor(width / 2),
      Math.floor(height / 2),
    );
    this.scene.cameras.main.centerOn(center.x, center.y);
  }

  private updateKeyboardPanning(deltaMs: number): void {
    if (!this.panKeys) {
      return;
    }

    if (isTypingElement(document.activeElement)) {
      return;
    }

    const moveLeft = this.panKeys.a.isDown || this.panKeys.left.isDown;
    const moveRight = this.panKeys.d.isDown || this.panKeys.right.isDown;
    const moveUp = this.panKeys.w.isDown || this.panKeys.up.isDown;
    const moveDown = this.panKeys.s.isDown || this.panKeys.down.isDown;
    const x = Number(moveRight) - Number(moveLeft);
    const y = Number(moveDown) - Number(moveUp);

    if (x === 0 && y === 0) {
      return;
    }

    const camera = this.scene.cameras.main;
    const length = Math.hypot(x, y) || 1;
    const distance = (this.options.panSpeed * deltaMs) / 1000 / camera.zoom;
    camera.scrollX += (x / length) * distance;
    camera.scrollY += (y / length) * distance;
  }
}

function isTypingElement(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  if (element.isContentEditable) {
    return true;
  }

  return element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement;
}
