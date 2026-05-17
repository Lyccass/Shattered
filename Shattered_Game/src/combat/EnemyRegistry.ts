import type { EnemyDefinition } from './EnemyTypes';

export class EnemyRegistry {
  private readonly definitions = new Map<string, EnemyDefinition>();

  constructor(definitions: EnemyDefinition[]) {
    definitions.forEach((definition) => {
      this.definitions.set(definition.id, definition);
    });
  }

  get(definitionId: string): EnemyDefinition {
    const definition = this.definitions.get(definitionId);

    if (!definition) {
      throw new Error(`EnemyRegistry: unknown enemy definition "${definitionId}"`);
    }

    return definition;
  }
}
