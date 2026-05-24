import '../items/ItemDefinitions'; // ensure global registry is populated
import { computeDerivedStats, type SkillLevels } from '../equipment/DerivedStatsCalculator';
import { EquipmentRegistry } from '../equipment/EquipmentRegistry';
import type {
  EquipmentSlot,
  EquipmentSnapshot,
  EquippedSlotEntry,
  EquippedSlots,
  PlayerDerivedStats,
} from '../equipment/EquipmentTypes';
import type { ItemDefinition } from '../items/ItemTypes';

export const EQUIPMENT_REGISTRY = new EquipmentRegistry();

export class PlayerEquipmentState {
  private readonly slots: EquippedSlots = {};

  constructor(private readonly registry = EQUIPMENT_REGISTRY) {}

  equip(slot: EquipmentSlot, itemId: string): boolean {
    const def = this.registry.get(itemId);
    if (!def || def.equipment?.slot !== slot) return false;
    this.slots[slot] = itemId;
    return true;
  }

  unequip(slot: EquipmentSlot): void {
    delete this.slots[slot];
  }

  getEquippedId(slot: EquipmentSlot): string | undefined {
    return this.slots[slot];
  }

  getEquipped(slot: EquipmentSlot): ItemDefinition | undefined {
    const id = this.slots[slot];
    return id ? this.registry.get(id) : undefined;
  }

  getDerivedStats(skills: SkillLevels): PlayerDerivedStats {
    return computeDerivedStats(this.slots, this.registry, skills);
  }

  getSnapshot(skills: SkillLevels): EquipmentSnapshot {
    const derivedStats = this.getDerivedStats(skills);
    const slotEntries: Partial<Record<EquipmentSlot, EquippedSlotEntry>> = {};

    for (const [slot, itemId] of Object.entries(this.slots) as [EquipmentSlot, string][]) {
      const def = this.registry.get(itemId);
      if (def) {
        slotEntries[slot] = { itemId, displayName: def.name };
      }
    }

    return { slots: slotEntries, derivedStats };
  }

  createSaveSnapshot(): Record<string, string> {
    return { ...this.slots } as Record<string, string>;
  }

  restoreSaveSnapshot(saved: Record<string, string>): void {
    for (const key of Object.keys(this.slots) as EquipmentSlot[]) {
      delete this.slots[key];
    }

    for (const [slot, itemId] of Object.entries(saved)) {
      if (this.registry.has(itemId)) {
        (this.slots as Record<string, string>)[slot] = itemId;
      }
    }
  }
}
