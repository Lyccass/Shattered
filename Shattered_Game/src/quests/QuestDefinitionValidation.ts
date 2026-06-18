import type {
  AnyOfQuestObjective,
  QuestDefinition,
  QuestObjective,
  QuestReward,
  SequenceQuestObjective,
} from './QuestTypes';

export type QuestDefinitionValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] };

export function validateQuestDefinitions(definitions: readonly QuestDefinition[]): QuestDefinitionValidationResult {
  const errors: string[] = [];
  const questIds = new Set<string>();

  definitions.forEach((definition, index) => {
    const label = `Quest ${definition.id || index}`;

    if (!definition.id) errors.push(`${label} is missing an id.`);
    if (questIds.has(definition.id)) errors.push(`Duplicate quest id "${definition.id}".`);
    questIds.add(definition.id);

    if (!definition.displayName) errors.push(`${label} is missing a displayName.`);
    if (!definition.description) errors.push(`${label} is missing a description.`);
    if (!definition.start.dialogue) errors.push(`${label} is missing start dialogue.`);
    if (definition.phases.length === 0) errors.push(`${label} must have at least one phase.`);

    const phaseIds = new Set<string>();
    definition.phases.forEach((phase) => {
      const phaseLabel = `${label} phase ${phase.id || phaseIds.size}`;

      if (!phase.id) errors.push(`${phaseLabel} is missing an id.`);
      if (phaseIds.has(phase.id)) errors.push(`${label} has duplicate phase id "${phase.id}".`);
      phaseIds.add(phase.id);

      if (!phase.title) errors.push(`${phaseLabel} is missing a title.`);
      if (!phase.journalHint) errors.push(`${phaseLabel} is missing a journalHint.`);
      if (!phase.completedLog) errors.push(`${phaseLabel} is missing a completedLog.`);
      if (phase.objectives.length === 0) errors.push(`${phaseLabel} must have at least one objective.`);

      validateObjectives(phase.objectives, `${phaseLabel} objectives`, errors);
    });

    validateReward(definition.rewards, label, errors);
  });

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

export function assertValidQuestDefinitions(definitions: readonly QuestDefinition[]): void {
  const result = validateQuestDefinitions(definitions);
  if (!result.ok) {
    throw new Error(`Invalid quest definitions:\n${result.errors.join('\n')}`);
  }
}

function validateObjectives(objectives: readonly QuestObjective[], path: string, errors: string[]): void {
  const objectiveIds = new Set<string>();

  objectives.forEach((objective) => {
    const objectivePath = `${path}/${objective.id || objectiveIds.size}`;

    if (!objective.id) errors.push(`${objectivePath} is missing an id.`);
    if (objectiveIds.has(objective.id)) errors.push(`${path} has duplicate objective id "${objective.id}".`);
    objectiveIds.add(objective.id);

    if (!objective.journalHint) errors.push(`${objectivePath} is missing a journalHint.`);
    if (!objective.completedLog) errors.push(`${objectivePath} is missing a completedLog.`);

    validateObjectiveShape(objective, objectivePath, errors);
  });
}

function validateObjectiveShape(objective: QuestObjective, path: string, errors: string[]): void {
  switch (objective.kind) {
    case 'kill':
    case 'kill_with_item':
    case 'kill_count_at':
    case 'fetch':
    case 'deliver_item_to':
      validatePositiveCount(objective.count, path, errors);
      break;
    case 'talk_with_item':
      if (objective.count !== undefined) validatePositiveCount(objective.count, path, errors);
      break;
    case 'pay_currency_to':
      validatePositiveCount(objective.copper, path, errors);
      break;
    case 'sequence':
      validateSequenceObjective(objective, path, errors);
      break;
    case 'any_of':
      validateAnyOfObjective(objective, path, errors);
      break;
    case 'interact':
    case 'visit':
    case 'do_action_at':
    case 'use_item_on':
    case 'cast_spell':
    case 'cast_spell_at':
      break;
  }
}

function validateSequenceObjective(objective: SequenceQuestObjective, path: string, errors: string[]): void {
  if (objective.steps.length === 0) {
    errors.push(`${path} sequence must have at least one step.`);
    return;
  }

  validateObjectives(objective.steps, `${path} steps`, errors);
}

function validateAnyOfObjective(objective: AnyOfQuestObjective, path: string, errors: string[]): void {
  if (objective.options.length < 2) {
    errors.push(`${path} any_of must have at least two options.`);
    return;
  }

  validateObjectives(objective.options, `${path} options`, errors);
}

function validateReward(reward: QuestReward | undefined, label: string, errors: string[]): void {
  if (!reward) return;

  if (reward.copper !== undefined) validatePositiveOrZero(reward.copper, `${label} reward copper`, errors);
  if (reward.harborReputation !== undefined) {
    validatePositiveOrZero(reward.harborReputation, `${label} reward harborReputation`, errors);
  }

  Object.entries(reward.itemDelta ?? {}).forEach(([itemId, amount]) => {
    if (!itemId) errors.push(`${label} reward itemDelta has an empty item id.`);
    validatePositiveCount(amount, `${label} reward itemDelta ${itemId}`, errors);
  });

  Object.entries(reward.xpRewards ?? {}).forEach(([skillId, amount]) => {
    validatePositiveOrZero(amount ?? 0, `${label} reward xpRewards ${skillId}`, errors);
  });
}

function validatePositiveCount(value: number, path: string, errors: string[]): void {
  if (!Number.isInteger(value) || value <= 0) {
    errors.push(`${path} must use a positive integer count.`);
  }
}

function validatePositiveOrZero(value: number, path: string, errors: string[]): void {
  if (!Number.isInteger(value) || value < 0) {
    errors.push(`${path} must be a non-negative integer.`);
  }
}
