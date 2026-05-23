import { getItem, getAllItems } from '../items/ItemRegistry';
import type { ItemDefinition } from '../items/ItemTypes';

// Equipment items are any ItemDefinition that has an `.equipment` field.
// The registry reads directly from the global ItemRegistry — no separate list needed.

export class EquipmentRegistry {
  has(id: string): boolean {
    return !!getItem(id)?.equipment;
  }

  /** Returns the ItemDefinition only if the item is equippable; undefined otherwise. */
  get(id: string): ItemDefinition | undefined {
    const def = getItem(id);
    return def?.equipment ? def : undefined;
  }

  getAll(): ItemDefinition[] {
    return getAllItems().filter((d) => !!d.equipment);
  }
}
