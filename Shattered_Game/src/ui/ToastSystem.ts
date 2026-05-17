import Phaser from 'phaser';
import { createUiText } from './UiTextFactory';
import { ToastQueue } from './ToastQueue';
import type { ToastKind } from './UiTypes';

const TOAST_DURATION_MS = 2200;
const MAX_VISIBLE_TOASTS = 4;

const TOAST_COLORS: Record<ToastKind, string> = {
  info: '#e2e8f0',
  success: '#bbf7d0',
  error: '#fecaca',
  reward: '#fde68a',
};

export class ToastSystem {
  private readonly queue = new ToastQueue();
  private readonly textPool: Phaser.GameObjects.Text[] = [];
  private width = 0;

  constructor(private readonly scene: Phaser.Scene) {
    for (let index = 0; index < MAX_VISIBLE_TOASTS; index += 1) {
      this.textPool.push(createUiText(scene, 'toast'));
    }
  }

  push(text: string, kind: ToastKind = 'info', durationMs = TOAST_DURATION_MS): void {
    if (!text) {
      return;
    }

    this.queue.push(text, kind, this.scene.time.now, durationMs);
    this.render();
  }

  update(): void {
    if (this.queue.update(this.scene.time.now)) {
      this.render();
      return;
    }

    const entries = this.queue.getEntries().slice(-MAX_VISIBLE_TOASTS).reverse();
    entries.forEach((entry, index) => {
      const text = this.textPool[index];
      const remainingMs = Math.max(0, entry.expiresAtMs - this.scene.time.now);
      text.setAlpha(Math.min(1, remainingMs / 300));
    });
  }

  layout(width: number): void {
    this.width = width;
    this.render();
  }

  getDisplayObjects(): Phaser.GameObjects.GameObject[] {
    return this.textPool;
  }

  private render(): void {
    const entries = this.queue.getEntries().slice(-MAX_VISIBLE_TOASTS).reverse();

    this.textPool.forEach((text, index) => {
      const entry = entries[index];

      if (!entry) {
        text.setVisible(false);
        text.setText('');
        return;
      }

      text.setText(entry.text);
      text.setVisible(true);
      text.setColor(TOAST_COLORS[entry.kind]);
      text.setAlpha(1);
      text.setPosition(this.width / 2, 24 + index * 42);
      text.setOrigin(0.5, 0);
    });
  }
}
