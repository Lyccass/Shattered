import type { ToastKind } from './ToastTypes';

export type ToastEntry = {
  id: number;
  text: string;
  kind: ToastKind;
  expiresAtMs: number;
};

export class ToastQueue {
  private nextId = 1;
  private readonly entries: ToastEntry[] = [];

  push(
    text: string,
    kind: ToastKind,
    nowMs: number,
    durationMs: number,
  ): ToastEntry {
    const entry: ToastEntry = {
      id: this.nextId,
      text,
      kind,
      expiresAtMs: nowMs + durationMs,
    };
    this.nextId += 1;
    this.entries.push(entry);
    return entry;
  }

  update(nowMs: number): boolean {
    const initialLength = this.entries.length;

    for (let index = this.entries.length - 1; index >= 0; index -= 1) {
      if (this.entries[index].expiresAtMs <= nowMs) {
        this.entries.splice(index, 1);
      }
    }

    return this.entries.length !== initialLength;
  }

  getEntries(): ToastEntry[] {
    return this.entries.map((entry) => ({ ...entry }));
  }
}
