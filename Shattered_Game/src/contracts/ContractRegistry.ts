import type { ContractDefinition } from './ContractTypes';

export class ContractRegistry {
  private readonly byId = new Map<string, ContractDefinition>();

  constructor(definitions: readonly ContractDefinition[]) {
    definitions.forEach((definition) => {
      this.byId.set(definition.id, definition);
    });
  }

  get(contractId: string): ContractDefinition {
    const definition = this.byId.get(contractId);

    if (!definition) {
      throw new Error(`ContractRegistry: unknown contract "${contractId}"`);
    }

    return definition;
  }
}
