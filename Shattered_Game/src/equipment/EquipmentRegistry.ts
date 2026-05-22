import type { EquipmentDefinition } from './EquipmentTypes';

export class EquipmentRegistry {
  private readonly map: Map<string, EquipmentDefinition>;

  constructor(definitions: EquipmentDefinition[]) {
    this.map = new Map(definitions.map((d) => [d.id, d]));
  }

  has(id: string): boolean {
    return this.map.has(id);
  }

  get(id: string): EquipmentDefinition | undefined {
    return this.map.get(id);
  }

  getAll(): EquipmentDefinition[] {
    return Array.from(this.map.values());
  }
}
