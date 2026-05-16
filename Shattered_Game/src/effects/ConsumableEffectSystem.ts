import type { EffectRegistry } from './EffectRegistry';
import type { ActiveEffect, ActiveEffectSnapshot, EffectId } from './EffectTypes';

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
}
