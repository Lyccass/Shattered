import type { NpcDefinition, NpcDialogueOption, NpcDialogueTree, NpcDialogueTreeOption } from './NpcTypes';

export type NpcDefinitionValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] };

export function validateNpcDefinitions(definitions: readonly NpcDefinition[]): NpcDefinitionValidationResult {
  const errors: string[] = [];
  const npcIds = new Set<string>();

  definitions.forEach((definition, index) => {
    const label = `NPC ${definition.id || index}`;

    if (!definition.id) errors.push(`${label} is missing an id.`);
    if (npcIds.has(definition.id)) errors.push(`Duplicate NPC id "${definition.id}".`);
    npcIds.add(definition.id);

    if (!definition.displayName) errors.push(`${label} is missing a displayName.`);
    if (!definition.dialogue.length) errors.push(`${label} should have at least one dialogue line.`);

    if (definition.options?.length) {
      validateFlatOptions(definition.options, `${label} options`, errors);
    }

    if (definition.dialogueTree) {
      validateDialogueTree(definition.dialogueTree.startNodeId, definition.dialogueTree.nodes, label, errors);
    }
  });

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

export function assertValidNpcDefinitions(definitions: readonly NpcDefinition[]): void {
  const result = validateNpcDefinitions(definitions);
  if (!result.ok) {
    throw new Error(`Invalid NPC definitions:\n${result.errors.join('\n')}`);
  }
}

function validateDialogueTree(
  startNodeId: string,
  nodes: NpcDialogueTree['nodes'],
  label: string,
  errors: string[],
): void {
  if (!startNodeId) errors.push(`${label} dialogueTree is missing startNodeId.`);
  if (!nodes[startNodeId]) errors.push(`${label} dialogueTree start node "${startNodeId}" does not exist.`);

  Object.entries(nodes).forEach(([nodeId, node]) => {
    const nodeLabel = `${label} dialogueTree node ${nodeId}`;

    if (!node.npcText) errors.push(`${nodeLabel} is missing npcText.`);
    validateTreeOptions(node.options, `${nodeLabel} options`, errors);

    node.options.forEach((option) => validateTreeOption(option, nodeLabel, nodes, errors));
  });
}

function validateTreeOption(
  option: NpcDialogueTreeOption,
  nodeLabel: string,
  nodes: NpcDialogueTree['nodes'],
  errors: string[],
): void {
  if (!option.label) errors.push(`${nodeLabel} option ${option.id} is missing a label.`);

  const hasAction = Boolean(option.nextNodeId || option.outcome || option.questAction || option.end);
  if (!hasAction) errors.push(`${nodeLabel} option ${option.id} has no action.`);

  if (option.nextNodeId && !nodes[option.nextNodeId]) {
    errors.push(`${nodeLabel} option ${option.id} references missing node "${option.nextNodeId}".`);
  }
}

function validateFlatOptions(options: readonly NpcDialogueOption[], path: string, errors: string[]): void {
  validateOptionIds(options.map((option) => option.id), path, errors);

  const lastOption = options.at(-1);
  if (lastOption?.outcome.kind !== 'close') {
    errors.push(`${path} must end with a close option.`);
  }
}

function validateTreeOptions(options: readonly NpcDialogueTreeOption[], path: string, errors: string[]): void {
  validateOptionIds(options.map((option) => option.id), path, errors);

  const lastOption = options.at(-1);
  if (!lastOption || !isTreeExitOption(lastOption)) {
    errors.push(`${path} must end with an exit option.`);
  }
}

function validateOptionIds(optionIds: readonly string[], path: string, errors: string[]): void {
  const ids = new Set<string>();

  optionIds.forEach((id, index) => {
    if (!id) errors.push(`${path} option ${index} is missing an id.`);
    if (ids.has(id)) errors.push(`${path} has duplicate option id "${id}".`);
    ids.add(id);
  });
}

function isTreeExitOption(option: NpcDialogueTreeOption): boolean {
  return option.end === true || option.outcome?.kind === 'close';
}
