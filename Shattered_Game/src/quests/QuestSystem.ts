import type { InteractionResult } from '../interactions/InteractionTypes';
import type { PlayerSessionState } from '../player/PlayerSessionState';
import type { TaskJournalEntry } from '../tasks/TaskJournalTypes';
import type { QuestRegistry } from './QuestRegistry';
import type {
  DoActionAtQuestObjective,
  QuestActionAtEvent,
  QuestDefinition,
  QuestId,
  QuestInteractionEvent,
  QuestKillEvent,
  QuestObjective,
  QuestPrerequisite,
  QuestReward,
  QuestRuntimeState,
  QuestSpellCastEvent,
  QuestTargetRef,
  QuestTalkWithItemEvent,
  QuestUseItemOnEvent,
  QuestVisitEvent,
  SequenceQuestObjective,
} from './QuestTypes';

type QuestProgressResult =
  | { changed: false }
  | { changed: true; completedQuest?: QuestDefinition; message: string; reward?: QuestReward };

export class QuestSystem {
  constructor(private readonly questRegistry: QuestRegistry) {}

  getJournalEntries(playerSessionState: PlayerSessionState): TaskJournalEntry[] {
    const activeEntries = playerSessionState.getActiveQuestIds()
      .map((questId) => this.questRegistry.get(questId))
      .map((quest) => this.getActiveJournalEntry(quest, playerSessionState))
      .filter((entry): entry is TaskJournalEntry => entry !== null);

    const completedEntries = playerSessionState.getCompletedQuestIds()
      .filter((questId) => this.questRegistry.has(questId))
      .map((questId) => this.questRegistry.get(questId))
      .map((quest) => this.getCompletedJournalEntry(quest));

    return [...activeEntries, ...completedEntries];
  }

  getActivePhaseId(questId: QuestId, playerSessionState: PlayerSessionState): string | null {
    const state = playerSessionState.getQuestRuntimeState(questId);
    if (!state) return null;

    return this.questRegistry.get(questId).phases[state.phaseIndex]?.id ?? null;
  }

  canStartQuest(questId: QuestId, playerSessionState: PlayerSessionState): boolean {
    const quest = this.questRegistry.get(questId);

    if (playerSessionState.isQuestActive(quest.id)) {
      return false;
    }

    if (!quest.repeatable && playerSessionState.isQuestCompleted(quest.id)) {
      return false;
    }

    return this.arePrerequisitesMet(quest.prerequisites ?? [], playerSessionState);
  }

  getQuestMenuLabel(questId: QuestId, playerSessionState: PlayerSessionState): string {
    const quest = this.questRegistry.get(questId);

    if (playerSessionState.isQuestActive(quest.id)) {
      return `${quest.displayName} (Continue)`;
    }

    if (!quest.repeatable && playerSessionState.isQuestCompleted(quest.id)) {
      return `${quest.displayName} (Completed)`;
    }

    return quest.displayName;
  }

  getQuestMenuDisabledReason(questId: QuestId, playerSessionState: PlayerSessionState): string | undefined {
    const quest = this.questRegistry.get(questId);

    if (!quest.repeatable && playerSessionState.isQuestCompleted(quest.id)) {
      return 'Completed';
    }

    if (!this.arePrerequisitesMet(quest.prerequisites ?? [], playerSessionState)) {
      return this.getMissingPrerequisiteSummary(quest.prerequisites ?? [], playerSessionState);
    }

    return undefined;
  }

  handleQuestNpcInteraction(
    questId: QuestId,
    npcId: string,
    playerSessionState: PlayerSessionState,
    objectiveId?: string,
  ): InteractionResult {
    const quest = this.questRegistry.get(questId);

    if (!playerSessionState.isQuestActive(quest.id)) {
      return this.acceptQuest(quest.id, playerSessionState, npcId);
    }

    const progress = this.recordNpcInteraction(npcId, playerSessionState, quest.id, objectiveId);
    if (progress) {
      return progress;
    }

    const active = playerSessionState.getQuestRuntimeState(quest.id);
    const phase = active ? quest.phases[active.phaseIndex] : undefined;

    return {
      ok: true,
      interactionType: 'npc',
      targetId: npcId,
      message: phase?.journalHint ?? quest.description,
      toastKind: 'info',
    };
  }

  acceptQuest(
    questId: QuestId,
    playerSessionState: PlayerSessionState,
    npcId?: string,
  ): InteractionResult {
    const quest = this.questRegistry.get(questId);

    if (quest.start.npcId && npcId && quest.start.npcId !== npcId) {
      return this.questError(quest.id, `Talk to ${quest.start.npcId.replaceAll('_', ' ')} to start ${quest.displayName}.`);
    }

    if (!this.canStartQuest(quest.id, playerSessionState)) {
      return this.questError(
        quest.id,
        this.getMissingPrerequisiteSummary(quest.prerequisites ?? [], playerSessionState),
      );
    }

    playerSessionState.startQuest(quest.id);

    return {
      ok: true,
      sfxId: 'contract_accepted',
      interactionType: 'npc',
      targetId: quest.id,
      message: `Quest started: ${quest.displayName}. ${quest.start.dialogue}`,
      toastKind: 'success',
    };
  }

  recordEnemyKilled(
    event: QuestKillEvent,
    playerSessionState: PlayerSessionState,
  ): InteractionResult | null {
    return this.recordProgress(playerSessionState, (objective) => {
      if (
        objective.kind !== 'kill'
        && objective.kind !== 'kill_with_item'
        && objective.kind !== 'kill_count_at'
      ) {
        return false;
      }

      if (objective.kind === 'kill_count_at') {
        return (objective.enemyId === undefined || objective.enemyId === event.enemyId)
          && objective.mapId === event.mapId
          && (objective.areaId === undefined || objective.areaId === event.areaId);
      }

      if (objective.enemyId !== event.enemyId) return false;

      if (
        objective.kind === 'kill_with_item'
        && !this.playerHasItemForObjective(playerSessionState, objective.itemId, objective.itemSource ?? 'either')
      ) {
        return false;
      }

      return true;
    });
  }

  recordNpcInteraction(
    npcId: string,
    playerSessionState: PlayerSessionState,
    onlyQuestId?: QuestId,
    onlyObjectiveId?: string,
  ): InteractionResult | null {
    return this.recordInteraction(
      { target: { kind: 'npc', npcId } },
      playerSessionState,
      onlyQuestId,
      onlyObjectiveId,
    );
  }

  recordInteraction(
    event: QuestInteractionEvent,
    playerSessionState: PlayerSessionState,
    onlyQuestId?: QuestId,
    onlyObjectiveId?: string,
  ): InteractionResult | null {
    return this.recordProgress(playerSessionState, (objective) => {
      if (onlyObjectiveId && objective.id !== onlyObjectiveId) {
        return false;
      }

      if (objective.kind === 'interact') {
        return targetsMatch(objective.target, event.target);
      }

      if (
        objective.kind === 'talk_with_item'
        && event.target.kind === 'npc'
        && event.target.npcId === objective.npcId
      ) {
        return playerSessionState.getInventoryState().hasAtLeast(objective.itemId, objective.count ?? 1);
      }

      if (
        objective.kind === 'deliver_item_to'
        && event.target.kind === 'npc'
        && event.target.npcId === objective.npcId
      ) {
        return playerSessionState.getInventoryState().consume(objective.itemId, objective.count);
      }

      if (
        objective.kind === 'pay_currency_to'
        && event.target.kind === 'npc'
        && event.target.npcId === objective.npcId
      ) {
        return playerSessionState.getCurrencyState().spendCopper(objective.copper);
      }

      return false;
    }, onlyQuestId);
  }

  recordTalkWithItem(
    event: QuestTalkWithItemEvent,
    playerSessionState: PlayerSessionState,
    onlyQuestId?: QuestId,
  ): InteractionResult | null {
    return this.recordProgress(playerSessionState, (objective) =>
      objective.kind === 'talk_with_item'
      && objective.npcId === event.npcId
      && event.heldItemIds.includes(objective.itemId),
    onlyQuestId);
  }

  recordVisit(
    event: QuestVisitEvent,
    playerSessionState: PlayerSessionState,
  ): InteractionResult | null {
    return this.recordProgress(playerSessionState, (objective) =>
      objective.kind === 'visit'
      && objective.mapId === event.mapId
      && (objective.areaId === undefined || objective.areaId === event.areaId),
    );
  }

  recordActionAt(
    event: QuestActionAtEvent,
    playerSessionState: PlayerSessionState,
  ): InteractionResult | null {
    return this.recordProgress(playerSessionState, (objective) =>
      objective.kind === 'do_action_at'
      && actionAtMatches(objective, event),
    );
  }

  recordUseItemOn(
    event: QuestUseItemOnEvent,
    playerSessionState: PlayerSessionState,
  ): InteractionResult | null {
    return this.recordProgress(playerSessionState, (objective) =>
      objective.kind === 'use_item_on'
      && objective.itemId === event.itemId
      && targetsMatch(objective.target, event.target),
    );
  }

  recordSpellCast(
    event: QuestSpellCastEvent,
    playerSessionState: PlayerSessionState,
  ): InteractionResult | null {
    return this.recordProgress(playerSessionState, (objective) => {
      if (objective.kind === 'cast_spell') {
        return objective.spellId === event.spellId;
      }

      if (objective.kind === 'cast_spell_at') {
        return objective.spellId === event.spellId
          && objective.mapId === event.mapId
          && (objective.areaId === undefined || objective.areaId === event.areaId)
          && (
            objective.tile === undefined
            || (
              objective.tile.tileX === event.tile?.tileX
              && objective.tile.tileY === event.tile?.tileY
            )
          );
      }

      return false;
    });
  }

  private recordProgress(
    playerSessionState: PlayerSessionState,
    matches: (objective: QuestObjective) => boolean,
    onlyQuestId?: QuestId,
  ): InteractionResult | null {
    const questIds = onlyQuestId
      ? [onlyQuestId].filter((questId) => playerSessionState.isQuestActive(questId))
      : playerSessionState.getActiveQuestIds();

    for (const questId of questIds) {
      const quest = this.questRegistry.get(questId);
      const result = this.recordQuestProgress(quest, playerSessionState, matches);
      if (!result.changed) continue;

      return this.createProgressResult(quest, result, playerSessionState);
    }

    return null;
  }

  private recordQuestProgress(
    quest: QuestDefinition,
    playerSessionState: PlayerSessionState,
    matches: (objective: QuestObjective) => boolean,
  ): QuestProgressResult {
    let output: QuestProgressResult = { changed: false };

    playerSessionState.mutateQuestRuntimeState(quest.id, (state) => {
      const phase = quest.phases[state.phaseIndex];
      if (!phase) return;

      const changed = phase.objectives
        .map((objective) => this.applyObjectiveEvent(objective, state, matches, phase.id))
        .some(Boolean);

      const completed = this.arePhaseObjectivesComplete(phase.objectives, state, phase.id, playerSessionState);
      const waitingForTurnIn = Boolean(phase.turnInNpcId);

      if (!completed) {
        if (changed) {
          output = { changed: true, message: `Quest updated: ${quest.displayName}. ${phase.journalHint}` };
        }
        return;
      }

      if (waitingForTurnIn) {
        const turnInMatched = phase.turnInNpcId
          ? matches({
            id: `${phase.id}_turn_in`,
            kind: 'interact',
            target: { kind: 'npc', npcId: phase.turnInNpcId },
            journalHint: phase.journalHint,
            completedLog: phase.completedLog,
          })
          : false;

        if (!turnInMatched) {
          if (changed) {
            output = {
              changed: true,
              message: `Quest updated: ${quest.displayName}. Return to ${phase.turnInNpcId?.replaceAll('_', ' ')}.`,
            };
          }
          return;
        }
      }

      const nextPhaseIndex = state.phaseIndex + 1;
      if (nextPhaseIndex >= quest.phases.length) {
        output = {
          changed: true,
          completedQuest: quest,
          message: `Quest complete: ${quest.displayName}. ${phase.completeDialogue ?? phase.completedLog}`,
          reward: quest.rewards,
        };
        return;
      }

      state.phaseIndex = nextPhaseIndex;
      const nextPhase = quest.phases[nextPhaseIndex];
      output = {
        changed: true,
        message: `Quest updated: ${quest.displayName}. ${nextPhase.startDialogue ?? nextPhase.journalHint}`,
      };
    });

    return output;
  }

  private applyObjectiveEvent(
    objective: QuestObjective,
    state: QuestRuntimeState,
    matches: (objective: QuestObjective) => boolean,
    progressPath: string,
  ): boolean {
    const key = getObjectiveProgressKey(progressPath, objective.id);
    const progress = state.objectiveProgress[key] ?? {};

    if (this.isObjectiveComplete(objective, state, progressPath)) {
      return false;
    }

    if (objective.kind === 'sequence') {
      return this.applySequenceEvent(objective, state, matches, key);
    }

    if (objective.kind === 'any_of') {
      return this.applyAnyOfEvent(objective, state, matches, key);
    }

    if (!matches(objective)) {
      return false;
    }

    if (
      objective.kind === 'kill'
      || objective.kind === 'kill_with_item'
      || objective.kind === 'kill_count_at'
    ) {
      const nextCount = Math.min(objective.count, (progress.count ?? 0) + 1);
      state.objectiveProgress[key] = {
        ...progress,
        count: nextCount,
        completed: nextCount >= objective.count,
      };
      return true;
    }

    state.objectiveProgress[key] = {
      ...progress,
      completed: true,
    };
    return true;
  }

  private applyAnyOfEvent(
    objective: Extract<QuestObjective, { kind: 'any_of' }>,
    state: QuestRuntimeState,
    matches: (objective: QuestObjective) => boolean,
    progressPath: string,
  ): boolean {
    let changed = false;

    for (const option of objective.options) {
      if (this.isObjectiveComplete(option, state, progressPath)) {
        state.objectiveProgress[progressPath] = { completed: true };
        return changed;
      }

      changed = this.applyObjectiveEvent(option, state, matches, progressPath) || changed;

      if (this.isObjectiveComplete(option, state, progressPath)) {
        state.objectiveProgress[progressPath] = { completed: true };
        return true;
      }
    }

    return changed;
  }

  private applySequenceEvent(
    objective: SequenceQuestObjective,
    state: QuestRuntimeState,
    matches: (objective: QuestObjective) => boolean,
    progressPath: string,
  ): boolean {
    const progress = state.objectiveProgress[progressPath] ?? {};
    const index = Math.max(0, progress.sequenceIndex ?? 0);
    const activeStep = objective.steps[index];

    if (!activeStep) {
      state.objectiveProgress[progressPath] = { ...progress, completed: true };
      return false;
    }

    const changed = this.applyObjectiveEvent(activeStep, state, matches, progressPath);
    if (!changed || !this.isObjectiveComplete(activeStep, state, progressPath)) {
      return changed;
    }

    const nextIndex = index + 1;
    state.objectiveProgress[progressPath] = {
      ...progress,
      sequenceIndex: nextIndex,
      completed: nextIndex >= objective.steps.length,
    };
    return true;
  }

  private createProgressResult(
    quest: QuestDefinition,
    result: Extract<QuestProgressResult, { changed: true }>,
    playerSessionState: PlayerSessionState,
  ): InteractionResult {
    if (result.completedQuest) {
      this.applyRewards(result.reward, playerSessionState);
      playerSessionState.completeQuest(result.completedQuest.id, result.completedQuest.repeatable === true);

      return {
        ok: true,
        sfxId: 'contract_completed',
        interactionType: 'npc',
        targetId: quest.id,
        message: result.message,
        currencyDelta: result.reward?.copper ? { copper: result.reward.copper } : undefined,
        reputationDelta: result.reward?.harborReputation
          ? { harborReputation: result.reward.harborReputation }
          : undefined,
        itemDelta: result.reward?.itemDelta,
        xpDelta: result.reward?.xpRewards,
        toastKind: 'reward',
      };
    }

    return {
      ok: true,
      interactionType: 'npc',
      targetId: quest.id,
      message: result.message,
      toastKind: 'success',
    };
  }

  private getActiveJournalEntry(
    quest: QuestDefinition,
    playerSessionState: PlayerSessionState,
  ): TaskJournalEntry | null {
    const state = playerSessionState.getQuestRuntimeState(quest.id);
    if (!state) return null;

    const phase = quest.phases[state.phaseIndex];
    if (!phase) return null;

    const objectivesComplete = this.arePhaseObjectivesComplete(
      phase.objectives,
      state,
      phase.id,
      playerSessionState,
    );
    const waitingForTurnIn = objectivesComplete && phase.turnInNpcId;
    const completedLogs = quest.phases
      .slice(0, state.phaseIndex)
      .map((completedPhase) => completedPhase.completedLog);

    return {
      id: quest.id,
      kind: 'quest',
      displayName: quest.displayName,
      status: waitingForTurnIn ? 'ready' : 'active',
      completedLogs,
      activeHint: waitingForTurnIn
        ? `Return to ${phase.turnInNpcId?.replaceAll('_', ' ')}.`
        : phase.journalHint,
      rewardSummary: formatQuestRewardSummary(quest.rewards),
    };
  }

  private getCompletedJournalEntry(quest: QuestDefinition): TaskJournalEntry {
    return {
      id: quest.id,
      kind: 'quest',
      displayName: quest.displayName,
      status: 'completed',
      completedLogs: quest.phases.map((phase) => phase.completedLog),
      rewardSummary: formatQuestRewardSummary(quest.rewards),
    };
  }

  private arePhaseObjectivesComplete(
    objectives: QuestObjective[],
    state: QuestRuntimeState,
    progressPath: string,
    playerSessionState: PlayerSessionState,
  ): boolean {
    return objectives.every((objective) => {
      if (objective.kind === 'fetch') {
        return playerSessionState.getInventoryState().hasAtLeast(objective.itemId, objective.count);
      }

      return this.isObjectiveComplete(objective, state, progressPath);
    });
  }

  private isObjectiveComplete(
    objective: QuestObjective,
    state: QuestRuntimeState,
    progressPath: string,
  ): boolean {
    if (objective.kind === 'sequence') {
      const progress = state.objectiveProgress[getObjectiveProgressKey(progressPath, objective.id)];
      return progress?.completed === true || (progress?.sequenceIndex ?? 0) >= objective.steps.length;
    }

    if (objective.kind === 'any_of') {
      const key = getObjectiveProgressKey(progressPath, objective.id);
      const progress = state.objectiveProgress[key];
      return progress?.completed === true
        || objective.options.some((option) => this.isObjectiveComplete(option, state, key));
    }

    return state.objectiveProgress[getObjectiveProgressKey(progressPath, objective.id)]?.completed === true;
  }

  private playerHasItemForObjective(
    playerSessionState: PlayerSessionState,
    itemId: string,
    source: 'inventory' | 'equipment' | 'either',
  ): boolean {
    const hasInInventory = source !== 'equipment'
      && playerSessionState.getInventoryState().hasAtLeast(itemId, 1);

    if (hasInInventory) return true;
    if (source === 'inventory') return false;

    return Object.values(playerSessionState.getEquipmentState().createSaveSnapshot()).includes(itemId);
  }

  private arePrerequisitesMet(
    prerequisites: QuestPrerequisite[],
    playerSessionState: PlayerSessionState,
  ): boolean {
    return prerequisites.every((prerequisite) => {
      switch (prerequisite.kind) {
        case 'quest_complete':
          return playerSessionState.isQuestCompleted(prerequisite.questId);
        case 'skill_level':
          return playerSessionState.getSkillLevel(prerequisite.skillId) >= prerequisite.level;
        case 'item_owned':
          return playerSessionState.getInventoryState().hasAtLeast(prerequisite.itemId, prerequisite.count ?? 1);
        case 'reputation':
          return (playerSessionState.getReputationSnapshot()[prerequisite.faction] ?? 0) >= prerequisite.minimum;
      }
    });
  }

  private getMissingPrerequisiteSummary(
    prerequisites: QuestPrerequisite[],
    playerSessionState: PlayerSessionState,
  ): string {
    const missing = prerequisites.filter((prerequisite) =>
      !this.arePrerequisitesMet([prerequisite], playerSessionState),
    );

    if (missing.length === 0) {
      return 'Quest requirements are not met.';
    }

    return `Requires ${missing.map(formatPrerequisite).join(' + ')}.`;
  }

  private applyRewards(reward: QuestReward | undefined, playerSessionState: PlayerSessionState): void {
    if (!reward) return;

    if (reward.itemDelta) {
      playerSessionState.getInventoryState().addMany(reward.itemDelta);
    }

    if (reward.copper) {
      playerSessionState.getCurrencyState().addCopper(reward.copper);
    }

    if (reward.harborReputation) {
      playerSessionState.getReputationState().addHarborReputation(reward.harborReputation);
    }

    playerSessionState.getSkillProgressionSystem().addXpDelta(reward.xpRewards ?? {});
  }

  private questError(questId: string, message: string): InteractionResult {
    return {
      ok: false,
      sfxId: 'invalid_action',
      interactionType: 'npc',
      targetId: questId,
      message,
      toastKind: 'error',
    };
  }
}

function getObjectiveProgressKey(progressPath: string, objectiveId: string): string {
  return `${progressPath}/${objectiveId}`;
}

function targetsMatch(expected: QuestTargetRef, actual: QuestTargetRef): boolean {
  if (expected.kind !== actual.kind) return false;

  switch (expected.kind) {
    case 'npc':
      return actual.kind === 'npc' && expected.npcId === actual.npcId;
    case 'object':
      return actual.kind === 'object' && expected.objectId === actual.objectId;
    case 'object_definition':
      return actual.kind === 'object_definition'
        && expected.objectDefinitionId === actual.objectDefinitionId;
    case 'item':
      return actual.kind === 'item' && expected.itemId === actual.itemId;
  }
}

function actionAtMatches(objective: DoActionAtQuestObjective, event: QuestActionAtEvent): boolean {
  if (objective.actionId !== event.actionId) return false;
  if (objective.mapId !== event.mapId) return false;
  if (objective.areaId !== undefined && objective.areaId !== event.areaId) return false;

  if (!objective.tile) return true;
  return objective.tile.tileX === event.tile?.tileX && objective.tile.tileY === event.tile?.tileY;
}

function formatPrerequisite(prerequisite: QuestPrerequisite): string {
  switch (prerequisite.kind) {
    case 'quest_complete':
      return `quest ${prerequisite.questId.replaceAll('_', ' ')} complete`;
    case 'skill_level':
      return `${prerequisite.skillId} level ${prerequisite.level}`;
    case 'item_owned':
      return `${prerequisite.count ?? 1} ${prerequisite.itemId.replaceAll('_', ' ')}`;
    case 'reputation':
      return `${prerequisite.minimum} ${prerequisite.faction.replaceAll('_', ' ')}`;
  }
}

function formatQuestRewardSummary(reward: QuestReward | undefined): string {
  const parts: string[] = [];

  if (reward?.copper) parts.push(`${reward.copper} copper`);
  if (reward?.harborReputation) parts.push(`${reward.harborReputation} harbor reputation`);

  Object.entries(reward?.xpRewards ?? {}).forEach(([skillId, amount]) => {
    if ((amount ?? 0) > 0) parts.push(`${amount} ${skillId} XP`);
  });

  Object.entries(reward?.itemDelta ?? {}).forEach(([itemId, amount]) => {
    if ((amount ?? 0) > 0) parts.push(`${amount} ${itemId.replaceAll('_', ' ')}`);
  });

  reward?.unlocks?.forEach((unlock) => {
    parts.push(`unlock ${unlock.displayName ?? unlock.unlockId.replaceAll('_', ' ')}`);
  });

  return parts.join(' + ') || 'none';
}
