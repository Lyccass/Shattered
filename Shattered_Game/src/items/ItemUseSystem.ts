import type { ConsumableEffectSystem } from '../effects/ConsumableEffectSystem';
import type { PlayerInventoryState } from '../player/PlayerInventoryState';
import type { InteractionResult } from '../interactions/InteractionTypes';
import { ItemRegistry } from './ItemRegistry';

export class ItemUseSystem {
  constructor(
    private readonly itemRegistry: ItemRegistry,
    private readonly effectSystem: ConsumableEffectSystem,
  ) {}

  useItem(
    itemId: string,
    inventory: PlayerInventoryState,
    nowMs: number,
  ): InteractionResult {
    const def = this.itemRegistry.get(itemId);

    if (!def.consume) {
      return {
        ok: false,
        interactionType: 'item_use',
        targetId: itemId,
        message: `${def.name} cannot be used that way.`,
      };
    }

    if (!inventory.consume(itemId, 1)) {
      return {
        ok: false,
        interactionType: 'item_use',
        targetId: itemId,
        message: `You don't have any ${def.name}.`,
      };
    }

    if (def.consume.effectId) {
      this.effectSystem.applyEffect(def.consume.effectId, nowMs);
    }

    return {
      ok: true,
      sfxId: 'tea_consumed',
      interactionType: 'item_use',
      targetId: itemId,
      message: def.consume.message ?? `You use ${def.name}.`,
      itemDelta: { [itemId]: -1 },
    };
  }
}
