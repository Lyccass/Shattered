import type { EffectDefinition, EffectId } from './EffectTypes';

export class EffectRegistry {
  private readonly byId = new Map<EffectId, EffectDefinition>();

  constructor(definitions: readonly EffectDefinition[]) {
    definitions.forEach((definition) => {
      this.byId.set(definition.id, definition);
    });
  }

  get(effectId: EffectId): EffectDefinition {
    const definition = this.byId.get(effectId);

    if (!definition) {
      throw new Error(`EffectRegistry: unknown effect "${effectId}"`);
    }

    return definition;
  }

  has(effectId: string): effectId is EffectId {
    return this.byId.has(effectId as EffectId);
  }
}
