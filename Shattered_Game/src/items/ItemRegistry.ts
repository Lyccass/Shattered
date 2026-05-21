import type { ItemDefinition, ItemId } from './ItemTypes';

export class ItemRegistry {
  private readonly byId = new Map<ItemId, ItemDefinition>();

  constructor(definitions: readonly ItemDefinition[]) {
    definitions.forEach((definition) => {
      this.byId.set(definition.id, definition);
    });
  }

  get(itemId: ItemId): ItemDefinition {
    const definition = this.byId.get(itemId);

    if (!definition) {
      throw new Error(`ItemRegistry: unknown item "${itemId}"`);
    }

    return definition;
  }

  find(itemId: string): ItemDefinition | undefined {
    return this.byId.get(itemId as ItemId);
  }
}
