import type { TaskJournalSaveState } from '../persistence/SaveTypes';
import { sanitizeCount } from '../persistence/saveNumbers';
import { QuestState } from '../quests/QuestState';

export class TaskJournalState {
  private readonly acceptedContractIds = new Set<string>();
  private readonly completedNonRepeatableContractIds = new Set<string>();
  private readonly contractCompletionCounts = new Map<string, number>();
  private readonly questState = new QuestState();

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

  getQuestState(): QuestState {
    return this.questState;
  }

  createSaveSnapshot(): TaskJournalSaveState {
    return {
      acceptedContractIds: Array.from(this.acceptedContractIds),
      completedNonRepeatableContractIds: Array.from(this.completedNonRepeatableContractIds),
      contractCompletionCounts: Object.fromEntries(this.contractCompletionCounts.entries()),
      quests: this.questState.createSaveSnapshot(),
    };
  }

  restoreSaveSnapshot(snapshot: TaskJournalSaveState): void {
    this.acceptedContractIds.clear();
    this.completedNonRepeatableContractIds.clear();
    this.contractCompletionCounts.clear();

    snapshot.acceptedContractIds.forEach((contractId) => {
      this.acceptedContractIds.add(contractId);
    });

    snapshot.completedNonRepeatableContractIds.forEach((contractId) => {
      this.completedNonRepeatableContractIds.add(contractId);
    });

    Object.entries(snapshot.contractCompletionCounts).forEach(([contractId, amount]) => {
      this.contractCompletionCounts.set(contractId, sanitizeCount(amount));
    });

    this.questState.restoreSaveSnapshot(snapshot.quests);
  }
}

