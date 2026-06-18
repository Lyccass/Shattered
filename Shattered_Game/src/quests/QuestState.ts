import type { QuestJournalSaveState } from '../persistence/SaveTypes';
import { sanitizeCount } from '../persistence/saveNumbers';
import type {
  QuestId,
  QuestObjectiveProgress,
  QuestRuntimeState,
} from './QuestTypes';

export class QuestState {
  private readonly activeQuests = new Map<QuestId, QuestRuntimeState>();
  private readonly completedQuestIds = new Set<QuestId>();
  private readonly questCompletionCounts = new Map<QuestId, number>();

  startQuest(questId: QuestId): boolean {
    if (this.activeQuests.has(questId)) {
      return false;
    }

    this.activeQuests.set(questId, {
      phaseIndex: 0,
      objectiveProgress: {},
    });
    return true;
  }

  isQuestActive(questId: QuestId): boolean {
    return this.activeQuests.has(questId);
  }

  getActiveQuestIds(): QuestId[] {
    return Array.from(this.activeQuests.keys());
  }

  getCompletedQuestIds(): QuestId[] {
    return Array.from(this.completedQuestIds);
  }

  isQuestCompleted(questId: QuestId): boolean {
    return this.completedQuestIds.has(questId);
  }

  getQuestCompletionCount(questId: QuestId): number {
    return this.questCompletionCounts.get(questId) ?? 0;
  }

  getQuestRuntimeState(questId: QuestId): QuestRuntimeState | null {
    const state = this.activeQuests.get(questId);
    if (!state) return null;

    return {
      phaseIndex: state.phaseIndex,
      objectiveProgress: cloneObjectiveProgress(state.objectiveProgress),
    };
  }

  mutateQuestRuntimeState(
    questId: QuestId,
    mutate: (state: QuestRuntimeState) => void,
  ): boolean {
    const state = this.activeQuests.get(questId);
    if (!state) return false;

    mutate(state);
    state.phaseIndex = sanitizeCount(state.phaseIndex);
    return true;
  }

  completeQuest(questId: QuestId, repeatable: boolean): number {
    this.activeQuests.delete(questId);

    if (!repeatable) {
      this.completedQuestIds.add(questId);
    }

    const nextCount = this.getQuestCompletionCount(questId) + 1;
    this.questCompletionCounts.set(questId, nextCount);
    return nextCount;
  }

  createSaveSnapshot(): QuestJournalSaveState {
    return {
      activeQuests: Object.fromEntries(
        Array.from(this.activeQuests.entries()).map(([questId, state]) => [
          questId,
          {
            phaseIndex: state.phaseIndex,
            objectiveProgress: cloneObjectiveProgress(state.objectiveProgress),
          },
        ]),
      ),
      completedQuestIds: Array.from(this.completedQuestIds),
      questCompletionCounts: Object.fromEntries(this.questCompletionCounts.entries()),
    };
  }

  restoreSaveSnapshot(snapshot: QuestJournalSaveState): void {
    this.activeQuests.clear();
    this.completedQuestIds.clear();
    this.questCompletionCounts.clear();

    Object.entries(snapshot.activeQuests).forEach(([questId, state]) => {
      this.activeQuests.set(questId, {
        phaseIndex: sanitizeCount(state.phaseIndex),
        objectiveProgress: cloneObjectiveProgress(state.objectiveProgress),
      });
    });

    snapshot.completedQuestIds.forEach((questId) => {
      this.completedQuestIds.add(questId);
    });

    Object.entries(snapshot.questCompletionCounts).forEach(([questId, amount]) => {
      this.questCompletionCounts.set(questId, sanitizeCount(amount));
    });
  }
}

function cloneObjectiveProgress(
  progress: Record<string, QuestObjectiveProgress>,
): Record<string, QuestObjectiveProgress> {
  return Object.fromEntries(
    Object.entries(progress).map(([key, value]) => [
      key,
      {
        count: value.count === undefined ? undefined : sanitizeCount(value.count),
        completed: value.completed === true,
        sequenceIndex: value.sequenceIndex === undefined
          ? undefined
          : sanitizeCount(value.sequenceIndex),
      },
    ]),
  );
}

