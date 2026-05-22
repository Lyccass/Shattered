import type { NpcDefinition } from './NpcTypes';
import { NPC_DEFINITIONS } from './NpcDefinitions';

export class NpcRegistry {
  private readonly map = new Map<string, NpcDefinition>();

  constructor() {
    for (const def of NPC_DEFINITIONS) {
      this.map.set(def.id, def);
    }
  }

  get(id: string): NpcDefinition {
    const def = this.map.get(id);
    if (!def) {
      throw new Error(`[NpcRegistry] Unknown NPC definition: "${id}"`);
    }
    return def;
  }

  has(id: string): boolean {
    return this.map.has(id);
  }
}
