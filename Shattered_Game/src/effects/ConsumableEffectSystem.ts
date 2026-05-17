import type { EffectRegistry } from './EffectRegistry';
import type { ActiveEffect, ActiveEffectSnapshot, EffectId } from './EffectTypes';
import type { ActiveEffectSaveState } from '../persistence/SaveTypes';

export class ConsumableEffectSystem {
  private readonly activeEffects = new Map<EffectId, ActiveEffect>();

  constructor(private readonly effectRegistry: EffectRegistry) {}

  applyEffect(effectId: EffectId, nowMs: number): ActiveEffect {
    const definition = this.effectRegistry.get(effectId);
    const activeEffect: ActiveEffect = {
      id: definition.id,
      displayName: definition.displayName,
      description: definition.description,
      durationMs: definition.durationMs,
      expiresAtMs: nowMs + definition.durationMs,
    };

    this.activeEffects.set(effectId, activeEffect);
    return activeEffect;
  }

  update(nowMs: number): boolean {
    let didChange = false;

    for (const activeEffect of this.activeEffects.values()) {
      if (nowMs < activeEffect.expiresAtMs) {
        continue;
      }

      this.activeEffects.delete(activeEffect.id);
      didChange = true;
    }

    return didChange;
  }

  getActiveEffects(nowMs: number): ActiveEffectSnapshot[] {
    return Array.from(this.activeEffects.values())
      .filter((activeEffect) => activeEffect.expiresAtMs > nowMs)
      .sort((a, b) => a.expiresAtMs - b.expiresAtMs)
      .map((activeEffect) => ({
        id: activeEffect.id,
        displayName: activeEffect.displayName,
        remainingMs: Math.max(0, activeEffect.expiresAtMs - nowMs),
      }));
  }

  createSaveSnapshot(nowMs: number): ActiveEffectSaveState[] {
    return Array.from(this.activeEffects.values())
      .filter((activeEffect) => activeEffect.expiresAtMs > nowMs)
      .sort((a, b) => a.expiresAtMs - b.expiresAtMs)
      .map((activeEffect) => ({
        effectId: activeEffect.id,
        remainingMs: Math.max(0, activeEffect.expiresAtMs - nowMs),
      }));
  }

  restoreSaveSnapshot(snapshot: ActiveEffectSaveState[], nowMs: number): void {
    this.activeEffects.clear();

    snapshot.forEach((entry) => {
      const remainingMs = sanitizeRemainingMs(entry.remainingMs);

      if (remainingMs <= 0 || !this.effectRegistry.has(entry.effectId)) {
        return;
      }

      const definition = this.effectRegistry.get(entry.effectId);
      this.activeEffects.set(definition.id, {
        id: definition.id,
        displayName: definition.displayName,
        description: definition.description,
        durationMs: definition.durationMs,
        expiresAtMs: nowMs + remainingMs,
      });
    });
  }
}

function sanitizeRemainingMs(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}
