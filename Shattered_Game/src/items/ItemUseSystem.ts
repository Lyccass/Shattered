import type { ConsumableEffectSystem } from '../effects/ConsumableEffectSystem';
import type { PlayerItemKey, PlayerInventoryState } from '../player/PlayerInventoryState';
import type { InteractionResult } from '../interactions/InteractionTypes';
import { ItemRegistry } from './ItemRegistry';

export class ItemUseSystem {
  constructor(
    private readonly itemRegistry: ItemRegistry,
    private readonly effectSystem: ConsumableEffectSystem,
  ) {}

  useItem(
    itemId: PlayerItemKey,
    inventory: PlayerInventoryState,
    nowMs: number,
  ): InteractionResult {
    const itemDefinition = this.itemRegistry.get(itemId);

    if (itemDefinition.useMode !== 'consume') {
      return {
        ok: false,
        interactionType: 'item_use',
        targetId: itemId,
        message: `${itemDefinition.displayName} cannot be used that way.`,
      };
    }

    if (!inventory.consumeItem(itemId, 1)) {
      return {
        ok: false,
        interactionType: 'item_use',
        targetId: itemId,
        message: `You don't have any ${itemDefinition.displayName}.`,
      };
    }

    if (itemDefinition.consumableEffectId) {
      this.effectSystem.applyEffect(itemDefinition.consumableEffectId, nowMs);
    }

    return {
      ok: true,
      interactionType: 'item_use',
      targetId: itemId,
      message: itemDefinition.consumeMessage ?? `You use ${itemDefinition.displayName}.`,
      itemDelta: { [itemId]: -1 },
    };
  }
}
