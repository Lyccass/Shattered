import type { ObjectDefinition } from './ObjectTypes';

// ObjectRegistry is a read-only lookup of ObjectDefinitions by id.
// The object system is data-driven: nothing else should ever construct an
// ObjectDefinition inline — definitions live in ObjectDefinitions.ts and flow
// through this registry.
export class ObjectRegistry {
  private readonly definitions = new Map<string, ObjectDefinition>();

  constructor(definitions: readonly ObjectDefinition[]) {
    this.registerDefinitions(definitions, 'throw');
  }

  addDefinitions(definitions: readonly ObjectDefinition[]): void {
    this.registerDefinitions(definitions, 'replace');
  }

  private registerDefinitions(
    definitions: readonly ObjectDefinition[],
    duplicatePolicy: 'throw' | 'replace',
  ): void {
    for (const def of definitions) {
      const existing = this.definitions.get(def.id);

      if (existing && duplicatePolicy === 'throw') {
        throw new Error(`ObjectRegistry: duplicate object definition id "${def.id}"`);
      }
      this.definitions.set(def.id, def);
    }
  }

  get(definitionId: string): ObjectDefinition {
    const def = this.definitions.get(definitionId);
    if (!def) {
      throw new Error(`ObjectRegistry: unknown object definition id "${definitionId}"`);
    }
    return def;
  }

  has(definitionId: string): boolean {
    return this.definitions.has(definitionId);
  }

  list(): ObjectDefinition[] {
    return Array.from(this.definitions.values());
  }
}
