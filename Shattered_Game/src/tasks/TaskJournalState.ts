export class TaskJournalState {
  private readonly acceptedContractIds = new Set<string>();
  private readonly completedNonRepeatableContractIds = new Set<string>();
  private readonly contractCompletionCounts = new Map<string, number>();

  acceptContract(contractId: string): boolean {
    const wasAdded = !this.acceptedContractIds.has(contractId);
    this.acceptedContractIds.add(contractId);
    return wasAdded;
  }

  completeContract(contractId: string, repeatable: boolean): number {
    this.acceptedContractIds.delete(contractId);

    if (!repeatable) {
      this.completedNonRepeatableContractIds.add(contractId);
    }

    const nextCount = this.getContractCompletionCount(contractId) + 1;
    this.contractCompletionCounts.set(contractId, nextCount);
    return nextCount;
  }

  isContractAccepted(contractId: string): boolean {
    return this.acceptedContractIds.has(contractId);
  }

  isContractCompletedNonRepeatable(contractId: string): boolean {
    return this.completedNonRepeatableContractIds.has(contractId);
  }

  getContractCompletionCount(contractId: string): number {
    return this.contractCompletionCounts.get(contractId) ?? 0;
  }

  getAcceptedContractIds(): string[] {
    return Array.from(this.acceptedContractIds);
  }
}
