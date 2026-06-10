import { getCompanionDefinition } from './CompanionRegistry';
import type {
  CompanionSlot,
  CompanionSlotData,
  CompanionSnapshot,
  EquippedCompanionSlots,
} from './CompanionTypes';

export class PlayerCompanionState {
  private readonly slots: EquippedCompanionSlots = {};

  equip(slot: CompanionSlot, definitionId: string): boolean {
    const def = getCompanionDefinition(definitionId);
    if (!def) return false;
    this.slots[slot] = { definitionId, durability: def.maxDurability };
    return true;
  }

  unequip(slot: CompanionSlot): void {
    delete this.slots[slot];
  }

  getSlots(): EquippedCompanionSlots {
    return { ...this.slots };
  }

  getSnapshot(): CompanionSnapshot {
    const result: CompanionSnapshot = {};
    for (const [slot, data] of Object.entries(this.slots) as [CompanionSlot, CompanionSlotData][]) {
      const def = getCompanionDefinition(data.definitionId);
      if (def) {
        result[slot] = {
          definitionId: data.definitionId,
          displayName: def.displayName,
          durability: data.durability,
          maxDurability: def.maxDurability,
        };
      }
    }
    return result;
  }
}
