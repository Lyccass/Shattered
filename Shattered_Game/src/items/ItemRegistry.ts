import type { PlayerItemKey } from '../player/PlayerInventoryState';
import type { ItemDefinition } from './ItemTypes';

export class ItemRegistry {
  private readonly byId = new Map<PlayerItemKey, ItemDefinition>();

  constructor(definitions: readonly ItemDefinition[]) {
    definitions.forEach((definition) => {
      this.byId.set(definition.id, definition);
    });
  }

  get(itemId: PlayerItemKey): ItemDefinition {
    const definition = this.byId.get(itemId);

    if (!definition) {
      throw new Error(`ItemRegistry: unknown item "${itemId}"`);
    }

    return definition;
  }
}
