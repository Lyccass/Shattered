import type { ItemDefinition } from './ItemTypes';

// ─── Module-level singleton ───────────────────────────────────────────────────
// All item definitions are registered here at startup via src/items/ItemDefinitions.ts.
// New items: add a definition to the appropriate definitions/category file.

const _items = new Map<string, ItemDefinition>();

export function registerItem(def: ItemDefinition): void {
  if (_items.has(def.id)) {
    throw new Error(`[ItemRegistry] duplicate item id: '${def.id}'`);
  }
  _items.set(def.id, def);
}

export function getItem(id: string): ItemDefinition | undefined {
  return _items.get(id);
}

export function requireItem(id: string): ItemDefinition {
  const def = _items.get(id);
  if (!def) throw new Error(`[ItemRegistry] unknown item: '${id}'`);
  return def;
}

export function getAllItems(): ItemDefinition[] {
  return Array.from(_items.values());
}

export function getItemsByCategory(category: ItemDefinition['category']): ItemDefinition[] {
  return getAllItems().filter((d) => d.category === category);
}

// ─── Class wrapper (dependency-injection compatibility) ───────────────────────
// Systems that receive an ItemRegistry instance via constructor can still use this.

export class ItemRegistry {
  /** Throws if item is not registered. */
  get(id: string): ItemDefinition {
    return requireItem(id);
  }

  find(id: string): ItemDefinition | undefined {
    return getItem(id);
  }
}
