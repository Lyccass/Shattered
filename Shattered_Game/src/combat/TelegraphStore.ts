import type { TelegraphDefinition, TelegraphSnapshot } from './TelegraphTypes';

export class TelegraphStore {
  private readonly telegraphs = new Map<string, TelegraphDefinition>();

  showTelegraph(definition: TelegraphDefinition): void {
    this.telegraphs.set(definition.id, { ...definition });
  }

  removeTelegraph(id: string): boolean {
    return this.telegraphs.delete(id);
  }

  update(nowMs: number): boolean {
    let removed = false;

    for (const [id, telegraph] of this.telegraphs.entries()) {
      if (nowMs >= telegraph.startedAtMs + telegraph.durationMs) {
        this.telegraphs.delete(id);
        removed = true;
      }
    }

    return removed;
  }

  getSnapshots(nowMs: number): TelegraphSnapshot[] {
    this.update(nowMs);

    return Array.from(this.telegraphs.values()).map((telegraph) => {
      const remainingMs = Math.max(0, telegraph.startedAtMs + telegraph.durationMs - nowMs);
      const fadeWindow = telegraph.fadeOutMs ?? telegraph.durationMs;
      const alpha =
        fadeWindow <= 0
          ? 1
          : Math.max(0.2, Math.min(1, remainingMs / fadeWindow));

      return {
        ...telegraph,
        remainingMs,
        alpha,
      };
    });
  }

  clear(): void {
    this.telegraphs.clear();
  }
}
