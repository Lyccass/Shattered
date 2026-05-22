import type { InteractionTarget } from '../../interactions/InteractionTypes';
import { isPlacedObjectTarget } from '../../interactions/InteractionTypes';

export function getInteractionMenuTitle(target: InteractionTarget): string {
  const { interactionType } = target.definition;
  if (interactionType === 'map_transition') return 'Travel';
  if (interactionType === 'resource_node') return 'Resource';
  if (interactionType === 'npc') return 'Interaction';
  if (interactionType === 'workbench') return 'Workbench';
  if (interactionType === 'contract_board') return 'Contracts';
  if (isPlacedObjectTarget(target)) return target.placedObjectKind === 'campfire' ? 'Campfire' : 'Firestarter';
  if (interactionType === 'generic_debug') return 'Inspect';
  if (interactionType === 'ground_item') return 'Item';
  throw new Error(`Unhandled interaction type: ${interactionType}`);
}

export function getInteractionUseLabel(target: InteractionTarget): string {
  const { interactionType } = target.definition;
  if (interactionType === 'map_transition') return 'Use Route';
  if (interactionType === 'resource_node') return 'Gather';
  if (interactionType === 'npc') return 'Talk';
  if (interactionType === 'workbench') return 'Use Workbench';
  if (interactionType === 'contract_board') return 'Read Contracts';
  if (isPlacedObjectTarget(target)) return target.placedObjectKind === 'campfire' ? 'Use Campfire' : 'Light Firestarter';
  if (interactionType === 'generic_debug') return 'Use';
  if (interactionType === 'ground_item') return 'Pick Up';
  throw new Error(`Unhandled interaction type: ${interactionType}`);
}

export function getInteractionUseDetails(target: InteractionTarget): string {
  const { interactionType } = target.definition;
  if (interactionType === 'map_transition') return 'Travel onward.';
  if (interactionType === 'resource_node') return 'Harvest what you can carry.';
  if (interactionType === 'npc') return 'Start a conversation.';
  if (interactionType === 'workbench') return 'Craft using the workbench.';
  if (interactionType === 'contract_board') return 'Review and manage posted tasks.';
  if (isPlacedObjectTarget(target)) return target.placedObjectKind === 'campfire' ? 'Brew or use the fire.' : 'Try to light it.';
  if (interactionType === 'generic_debug') return 'Interact with it.';
  if (interactionType === 'ground_item') return 'Add to your inventory.';
  throw new Error(`Unhandled interaction type: ${interactionType}`);
}
