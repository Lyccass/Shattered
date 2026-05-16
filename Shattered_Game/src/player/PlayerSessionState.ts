import { ConsumableEffectSystem } from '../effects/ConsumableEffectSystem';
import { EFFECT_DEFINITIONS } from '../effects/EffectDefinitions';
import { EffectRegistry } from '../effects/EffectRegistry';
import type { ActiveEffectSnapshot } from '../effects/EffectTypes';
import { PlayerInventoryState, type PlayerInventorySnapshot } from './PlayerInventoryState';

export class PlayerSessionState {
  private readonly inventoryState = new PlayerInventoryState();
  private readonly effectSystem = new ConsumableEffectSystem(
    new EffectRegistry(EFFECT_DEFINITIONS),
  );

  getInventoryState(): PlayerInventoryState {
    return this.inventoryState;
  }

  getInventorySnapshot(): PlayerInventorySnapshot {
    return this.inventoryState.getSnapshot();
  }

  getEffectSystem(): ConsumableEffectSystem {
    return this.effectSystem;
  }

  getActiveEffects(nowMs: number): ActiveEffectSnapshot[] {
    return this.effectSystem.getActiveEffects(nowMs);
  }

  update(nowMs: number): boolean {
    return this.effectSystem.update(nowMs);
  }
}
