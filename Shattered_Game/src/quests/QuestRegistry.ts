import type { QuestDefinition, QuestId } from './QuestTypes';
import { assertValidQuestDefinitions } from './QuestDefinitionValidation';

export class QuestRegistry {
  private readonly byId = new Map<QuestId, QuestDefinition>();

  constructor(definitions: readonly QuestDefinition[]) {
    assertValidQuestDefinitions(definitions);

    definitions.forEach((definition) => {
      if (this.byId.has(definition.id)) {
        throw new Error(`QuestRegistry: duplicate quest "${definition.id}"`);
      }
      this.byId.set(definition.id, definition);
    });
  }

  get(questId: QuestId): QuestDefinition {
    const definition = this.byId.get(questId);

    if (!definition) {
      throw new Error(`QuestRegistry: unknown quest "${questId}"`);
    }

    return definition;
  }

  has(questId: QuestId): boolean {
    return this.byId.has(questId);
  }

  getAll(): QuestDefinition[] {
    return Array.from(this.byId.values());
  }
}
